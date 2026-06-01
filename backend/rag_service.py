from __future__ import annotations

import asyncio
import base64
import json
import logging
import os
import re
from pathlib import Path
from datetime import datetime, timezone
from typing import Any, AsyncIterator, Literal, Optional
from urllib.parse import quote

from pydantic import BaseModel, Field, ValidationError, validator

from backend.config_loader import load_json_config
from backend.model_client import ChatModelClient, ModelRegistry
from docker_1 import (
    CourseNotFound,
    InvalidSlidePage,
    SlideCatalogError,
    SlideNotFound,
    build_course_deck,
    get_slide_page_path,
)


logger = logging.getLogger(__name__)

REPO_ROOT = Path(__file__).resolve().parents[1]
DEFAULT_CHROMA_DIR = "chroma_db"
DEFAULT_CHROMA_COLLECTION = "cs101_course_markdown"
DEFAULT_EMBEDDING_MODEL = "BAAI/bge-m3"

VISUAL_QUERY_RE = re.compile(r"(这页|这一页|这里|图中|图片|截图|公式|代码|这个图|这张图)")
COURSE_QUERY_RE = re.compile(
    r"(课件|课程|知识点|概念|定义|解释|说明|总结|复习|例子|算法|图灵机|复杂度|"
    r"递归|循环|布尔|逻辑|流水线|网络|协议|排序|NP|加法器)"
)
PAGE_START_RE = re.compile(r"\d+")
PAGE_REFERENCE_RE = re.compile(r"(?:\b[Pp]\s*|第\s*)(\d{1,3})\s*(?:页)?")


class ChatMessage(BaseModel):
    role: Literal["user", "assistant", "system"]
    content: str
    id: Optional[str] = None


class ChatRequest(BaseModel):
    courseId: str = Field(default="demo-course")
    currentPage: int = Field(default=1, ge=1)
    currentNote: str = Field(default="")
    answerMode: Literal["friendly", "serious"] = "friendly"
    messages: list[ChatMessage] = Field(default_factory=list)


class RouterDecision(BaseModel):
    intent: Literal["chat", "course_knowledge", "slide_visual"] = "chat"
    needs_vector_search: bool = False
    needs_slide_image: bool = False
    course_filter: Optional[str] = None
    target_page: Optional[int] = None
    reason: str = ""


class Citation(BaseModel):
    page: int
    courseName: str
    courseId: str
    label: Optional[str] = None
    source: Optional[str] = None
    section: Optional[str] = None
    imageUrl: str


class SlideImageContext(BaseModel):
    page: int
    courseName: str
    imageUrl: str
    dataUrl: str


class ChatMetadata(BaseModel):
    ragStatus: Literal["ok", "degraded"] = "ok"
    citations: list[Citation] = Field(default_factory=list)
    slideImage: Optional[Citation] = None
    warnings: list[str] = Field(default_factory=list)


class VectorSearchArgs(BaseModel):
    query: str
    course_id: Optional[str] = None
    course_filter: Optional[str] = None
    k: int = Field(default=5, ge=1, le=8)


class SlideImageArgs(BaseModel):
    course_id: str
    page: int = Field(ge=1)


class NoteAutocompleteRequest(BaseModel):
    courseId: str = Field(default="demo-course")
    currentPage: int = Field(default=1, ge=1)
    noteContent: str = Field(default="")
    cursorBefore: str = Field(default="")
    cursorAfter: str = Field(default="")
    lastAiAnswer: str = Field(default="")


class QuestionGenerateRequest(BaseModel):
    count: int = Field(default=5, ge=1, le=8)
    types: list[Literal["single_choice", "true_false"]] = Field(
        default_factory=lambda: ["single_choice", "true_false"]
    )
    currentNote: str = Field(default="")

    @validator("types")
    def validate_types(cls, value: list[str]) -> list[str]:
        if not value:
            raise ValueError("At least one question type is required.")
        return list(dict.fromkeys(value))


class RawGeneratedQuestion(BaseModel):
    type: Literal["single_choice", "true_false"]
    question: str
    options: list[str] = Field(default_factory=list)
    answerIndex: int
    explanation: str
    sourceIds: list[str] = Field(default_factory=list)


class HighlightGenerateRequest(BaseModel):
    count: int = Field(default=8, ge=1, le=10)
    currentNote: str = Field(default="")


class MindmapGenerateRequest(BaseModel):
    depth: int = Field(default=3, ge=2, le=4)
    focus: str = Field(default="")
    currentNote: str = Field(default="")


class RawGeneratedHighlight(BaseModel):
    title: str
    summary: str
    importance: Literal["high", "medium", "low"] = "medium"
    sourceIds: list[str] = Field(default_factory=list)


class QuizContextUnavailable(Exception):
    pass


class QuizGenerationError(Exception):
    pass


class HighlightContextUnavailable(Exception):
    pass


class HighlightGenerationError(Exception):
    pass


class MindmapContextUnavailable(Exception):
    pass


class MindmapGenerationError(Exception):
    pass


class CourseRAGService:
    def __init__(self) -> None:
        self.prompts = load_json_config("prompts.json")
        self.models = ModelRegistry()
        self.chat_client = ChatModelClient()
        self.chroma_dir = self._repo_path(os.getenv("CHROMA_PERSIST_DIR", DEFAULT_CHROMA_DIR))
        self.chroma_collection = os.getenv("CHROMA_COLLECTION_NAME", DEFAULT_CHROMA_COLLECTION)
        self.embedding_model = os.getenv("EMBEDDING_MODEL", DEFAULT_EMBEDDING_MODEL)
        self._vector_store: Optional[Any] = None
        self._vector_store_error: Optional[str] = None

    async def generate_course_starter(self, course_id: str) -> str:
        messages, fallback = await self._course_starter_messages(course_id)

        try:
            response = await self._complete_task("course_starter", messages)
            content = self._extract_message_content(response).strip()
        except Exception as exc:
            logger.exception("生成课程开场总结失败：%s", exc)
            content = ""

        return self._trim_text(content, 260) if content else fallback

    async def stream_course_starter(self, course_id: str) -> AsyncIterator[str]:
        messages, fallback = await self._course_starter_messages(course_id)
        has_delta = False

        try:
            async for delta in self._stream_task("course_starter", messages):
                has_delta = True
                yield delta
        except Exception as exc:
            logger.exception("流式生成课程开场总结失败：%s", exc)

        if not has_delta:
            yield fallback

    async def generate_conversation_title(self, first_user_query: str, course_name: str = "") -> str:
        query = self._trim_text(first_user_query, 500)
        prompt = self.prompts["conversation_title_user"].format(
            course_name=course_name or "CS101",
            query=query,
        )

        try:
            response = await self._complete_task(
                "conversation_title",
                messages=[
                    {"role": "system", "content": self.prompts["conversation_title_system"]},
                    {"role": "user", "content": prompt},
                ],
            )
            title = self._clean_generated_title(self._extract_message_content(response))
        except Exception as exc:
            logger.exception("生成对话标题失败：%s", exc)
            title = ""

        return title or self._fallback_title_from_query(query)

    async def generate_notebook_title(self, current_title: str, content: str) -> str:
        note_text = self._trim_text(content, 3000)
        prompt = self.prompts["notebook_title_user"].format(
            current_title=current_title or "未命名笔记",
            content=note_text,
        )

        response = await self._complete_task(
            "notebook_title",
            messages=[
                {"role": "system", "content": self.prompts["notebook_title_system"]},
                {"role": "user", "content": prompt},
            ],
        )
        return self._clean_generated_title(self._extract_message_content(response))

    async def generate_note_autocomplete(self, request_data: dict[str, Any]) -> dict[str, str]:
        try:
            autocomplete_request = self._model_validate(NoteAutocompleteRequest, request_data)
        except ValidationError as exc:
            raise ValueError("笔记补全请求格式不正确。") from exc

        slide_text = await asyncio.to_thread(
            self._slide_text_from_chroma,
            autocomplete_request.courseId,
            autocomplete_request.currentPage,
        )
        prompt = self.prompts["note_autocomplete_user"].format(
            slide_text=self._trim_text(slide_text, 2000) or "无",
            cursor_before=self._trim_text(autocomplete_request.cursorBefore, 1000) or "无",
            cursor_after=self._trim_text(autocomplete_request.cursorAfter, 800) or "无",
            last_ai_answer=self._trim_text(autocomplete_request.lastAiAnswer, 1200) or "无",
            note_text=self._trim_text(autocomplete_request.noteContent, 3000) or "无",
        )

        response = await self._complete_task(
            "note_autocomplete",
            messages=[
                {"role": "system", "content": self.prompts["note_autocomplete_system"]},
                {"role": "user", "content": prompt},
            ],
        )
        suggestion = self._clean_autocomplete_suggestion(
            self._extract_message_content(response),
            autocomplete_request.cursorBefore,
        )
        return {"suggestion": suggestion}

    async def generate_questions(self, course_id: str, request_data: dict[str, Any]) -> dict[str, Any]:
        try:
            quiz_request = self._model_validate(QuestionGenerateRequest, request_data)
        except ValidationError as exc:
            raise ValueError("Question generation request is invalid.") from exc

        deck = await asyncio.to_thread(build_course_deck, course_id)
        contexts = await asyncio.to_thread(self._quiz_contexts_from_chroma, deck)
        if not contexts:
            raise QuizContextUnavailable("当前课程没有可用文本资料，无法基于课件生成题目。")

        messages = self._build_question_generation_messages(deck, quiz_request, contexts)

        try:
            response = await self._complete_task("question_generation", messages)
            content = self._extract_message_content(response)
            data = json.loads(self._extract_json_object(content))
            questions = self._normalize_generated_questions(
                data,
                quiz_request,
                contexts,
                str(deck.get("courseId") or course_id),
            )
        except QuizGenerationError:
            raise
        except Exception as exc:
            raise QuizGenerationError("Question generation failed.") from exc

        return {
            "courseId": course_id,
            "resolvedCourseId": str(deck.get("resolvedCourseId") or deck.get("courseId") or course_id),
            "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "questions": questions,
        }

    async def generate_highlights(self, course_id: str, request_data: dict[str, Any]) -> dict[str, Any]:
        try:
            highlight_request = self._model_validate(HighlightGenerateRequest, request_data)
        except ValidationError as exc:
            raise ValueError("Highlight generation request is invalid.") from exc

        deck = await asyncio.to_thread(build_course_deck, course_id)
        contexts = await asyncio.to_thread(self._quiz_contexts_from_chroma, deck)
        if not contexts:
            raise HighlightContextUnavailable("当前课程没有可用文本资料，无法基于课件划重点。")

        messages = self._build_highlight_generation_messages(deck, highlight_request, contexts)

        try:
            response = await self._complete_task("highlight_generation", messages)
            content = self._extract_message_content(response)
            data = json.loads(self._extract_json_object(content))
            highlights = self._normalize_generated_highlights(
                data,
                highlight_request,
                contexts,
                str(deck.get("courseId") or course_id),
            )
        except HighlightGenerationError:
            raise
        except Exception as exc:
            raise HighlightGenerationError("Highlight generation failed.") from exc

        return {
            "courseId": course_id,
            "resolvedCourseId": str(deck.get("resolvedCourseId") or deck.get("courseId") or course_id),
            "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "highlights": highlights,
        }

    async def generate_mindmap(self, course_id: str, request_data: dict[str, Any]) -> dict[str, Any]:
        try:
            mindmap_request = self._model_validate(MindmapGenerateRequest, request_data)
        except ValidationError as exc:
            raise ValueError("Mind map generation request is invalid.") from exc

        deck = await asyncio.to_thread(build_course_deck, course_id)
        contexts = await asyncio.to_thread(self._quiz_contexts_from_chroma, deck)
        if not contexts:
            raise MindmapContextUnavailable("当前课程没有可用文本资料，无法生成思维导图。")

        messages = self._build_mindmap_generation_messages(deck, mindmap_request, contexts)

        try:
            response = await self._complete_task("mindmap_generation", messages)
            content = self._extract_message_content(response)
            data = json.loads(self._extract_json_object(content))
            mindmap = self._normalize_generated_mindmap(
                data,
                mindmap_request,
                contexts,
                str(deck.get("courseId") or course_id),
            )
        except MindmapGenerationError:
            raise
        except Exception as exc:
            raise MindmapGenerationError("Mind map generation failed.") from exc

        return {
            "courseId": course_id,
            "resolvedCourseId": str(deck.get("resolvedCourseId") or deck.get("courseId") or course_id),
            "generatedAt": datetime.now(timezone.utc).isoformat().replace("+00:00", "Z"),
            "mindmap": mindmap,
        }

    async def _course_starter_messages(self, course_id: str) -> tuple[list[dict[str, Any]], str]:
        deck = await asyncio.to_thread(build_course_deck, course_id)
        course_name = str(deck.get("title") or course_id)
        page_count = len(deck.get("slides") or [])
        outline = await asyncio.to_thread(self._course_outline_from_chroma, deck)
        outline_text = self._format_course_outline(outline)

        prompt = self.prompts["course_starter_user"].format(
            course_name=course_name,
            page_count=page_count,
            outline_text=outline_text or "无",
        )

        if outline_text:
            fallback = self._trim_text(
                f"你好，我是 CS101 Copliot。这节课围绕 {course_name} 展开，核心线索包括 {outline_text.replace(chr(10), '；')}。"
                "建议先按页码梳理主线，再回到关键例子和任务页动手验证。",
                180,
            )
        else:
            fallback = (
                f"你好，我是 CS101 Copliot。这节课是《{course_name}》，共 {page_count} 页。"
                "建议先快速浏览整体结构，再围绕核心概念、例题和实验任务做笔记，最后用自己的话复述学习主线。"
            )

        return (
            [
                {"role": "system", "content": self.prompts["course_starter_system"]},
                {"role": "user", "content": prompt},
            ],
            fallback,
        )

    async def answer_stream(self, request_data: dict[str, Any]) -> AsyncIterator[dict[str, Any]]:
        metadata = ChatMetadata()

        try:
            chat_request = self._model_validate(ChatRequest, request_data)
        except ValidationError as exc:
            yield {
                "type": "error",
                "error": "INVALID_CHAT_REQUEST",
                "message": "聊天请求格式不正确。",
                "details": exc.errors(),
            }
            return

        latest_query = self._latest_user_query(chat_request.messages)
        if not latest_query:
            yield {
                "type": "error",
                "error": "INVALID_CHAT_REQUEST",
                "message": "请求中必须包含用户问题。",
            }
            return

        yield {"type": "status", "label": "分析输入"}
        yield {"type": "status", "label": "判断问题类型"}

        decision = await self._route_query(chat_request, latest_query)
        contexts: list[dict[str, Any]] = []
        slide_image: Optional[SlideImageContext] = None
        referenced_pages = self._page_references_from_query(latest_query)
        if decision.target_page:
            referenced_pages = self._dedupe_ints([decision.target_page, *referenced_pages])

        if decision.needs_vector_search:
            yield {"type": "status", "label": "读取知识库"}
            try:
                contexts = await self.vector_search(
                    VectorSearchArgs(
                        query=latest_query,
                        course_id=chat_request.courseId,
                        course_filter=decision.course_filter,
                    )
                )
            except Exception as exc:
                logger.exception("Chroma 检索失败：%s", exc)
                metadata.ragStatus = "degraded"
                metadata.warnings.append("知识库暂不可用，已转为普通问答。")
                yield {"type": "status", "label": "知识库暂不可用，转为普通问答"}

        if referenced_pages:
            try:
                page_contexts = await asyncio.to_thread(
                    self._page_contexts_from_chroma,
                    chat_request.courseId,
                    referenced_pages,
                )
                contexts = self._merge_contexts(page_contexts, contexts)
            except Exception as exc:
                logger.warning("Failed to load referenced page contexts: %s", exc)

        if contexts:
            yield {"type": "status", "label": "整理课程资料"}
            metadata.citations = self._build_citations(chat_request.courseId, contexts)

        if decision.needs_slide_image:
            image_page = (
                decision.target_page
                or chat_request.currentPage
                or (metadata.citations[0].page if metadata.citations else None)
            )

            if image_page:
                yield {"type": "status", "label": "读取当前页图片"}
                try:
                    slide_image = await self.get_slide_image(
                        SlideImageArgs(course_id=chat_request.courseId, page=image_page)
                    )
                    image_citation = Citation(
                        page=slide_image.page,
                        courseName=slide_image.courseName,
                        courseId=chat_request.courseId,
                        label=self._citation_label(chat_request.courseId, chat_request.courseId, slide_image.page),
                        source=None,
                        section="当前 Slide 图片",
                        imageUrl=slide_image.imageUrl,
                    )
                    metadata.slideImage = image_citation
                    metadata.citations = self._merge_citations(
                        [image_citation],
                        metadata.citations,
                    )
                except Exception as exc:
                    logger.exception("读取 Slide 图片失败：%s", exc)
                    metadata.ragStatus = "degraded"
                    metadata.warnings.append("当前页图片读取失败，已改用文字资料。")
                    yield {"type": "status", "label": "当前页图片读取失败，改用文字资料"}

        yield {"type": "status", "label": "思考"}

        try:
            async for delta in self._stream_final_answer(
                chat_request=chat_request,
                contexts=contexts,
                citations=metadata.citations,
                slide_image=slide_image,
            ):
                yield {"type": "token", "delta": delta}
        except Exception as exc:
            logger.exception("Qwen 生成失败：%s", exc)
            yield {
                "type": "error",
                "error": "MODEL_PROVIDER_ERROR",
                "message": "模型服务调用失败。",
            }
            return

        yield {"type": "metadata", **self._model_dump(metadata)}
        yield {"type": "done"}

    async def vector_search(self, args: VectorSearchArgs) -> list[dict[str, Any]]:
        vector_store = await asyncio.to_thread(self._get_vector_store)
        search_filter = self._vector_search_filter(args)

        def run_search() -> list[Any]:
            return vector_store.similarity_search(
                args.query,
                k=args.k,
                filter=search_filter,
            )

        docs = await asyncio.to_thread(run_search)
        results: list[dict[str, Any]] = []

        for doc in docs:
            results.append(
                {
                    "content": getattr(doc, "page_content", ""),
                    "metadata": dict(getattr(doc, "metadata", {}) or {}),
                }
            )

        return results

    def _vector_search_filter(self, args: VectorSearchArgs) -> Optional[dict[str, Any]]:
        if args.course_id:
            try:
                deck = build_course_deck(args.course_id)
                source = self._course_source_from_deck(deck)
            except (CourseNotFound, SlideCatalogError):
                source = None

            if source:
                return {"source": source}

        if args.course_filter:
            return {"Course": args.course_filter}

        return None

    def _page_contexts_from_chroma(self, course_id: str, pages: list[int]) -> list[dict[str, Any]]:
        if not pages:
            return []

        try:
            import chromadb
        except ImportError as exc:
            logger.warning("Missing ChromaDB dependency for referenced pages: %s", exc)
            return []

        try:
            deck = build_course_deck(course_id)
        except (CourseNotFound, SlideCatalogError) as exc:
            logger.warning("Cannot resolve course for referenced pages: %s", exc)
            return []

        source = self._course_source_from_deck(deck)
        if not source:
            return []

        try:
            client = chromadb.PersistentClient(path=str(self.chroma_dir))
            collection = client.get_collection(self.chroma_collection)
            result = collection.get(
                where={"source": source},
                include=["documents", "metadatas"],
                limit=1000,
            )
        except Exception as exc:
            logger.warning("Failed to load referenced pages from Chroma: %s", exc)
            return []

        wanted_pages = set(pages)
        contexts: list[dict[str, Any]] = []
        for document, metadata in zip(result.get("documents") or [], result.get("metadatas") or []):
            if not isinstance(metadata, dict):
                continue
            if not any(self._page_range_contains(metadata.get("page"), page) for page in wanted_pages):
                continue
            content = str(document or "").strip()
            if not content:
                continue
            contexts.append({"content": content, "metadata": dict(metadata)})

        return sorted(contexts, key=lambda item: self._page_sort_key(item.get("metadata", {}).get("page")))[:8]

    def _merge_contexts(
        self,
        primary: list[dict[str, Any]],
        secondary: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        merged: list[dict[str, Any]] = []
        seen: set[tuple[str, str, str]] = set()

        for item in [*primary, *secondary]:
            metadata = item.get("metadata", {}) if isinstance(item, dict) else {}
            key = (
                str(metadata.get("source") or ""),
                str(metadata.get("page") or ""),
                self._trim_text(str(item.get("content") or ""), 120),
            )
            if key in seen:
                continue
            seen.add(key)
            merged.append(item)

        return merged[:8]

    async def get_slide_image(self, args: SlideImageArgs) -> SlideImageContext:
        image_path = await asyncio.to_thread(get_slide_page_path, args.course_id, args.page)
        deck = await asyncio.to_thread(build_course_deck, args.course_id)
        course_name = deck.get("title") or args.course_id

        data = await asyncio.to_thread(Path(image_path).read_bytes)
        encoded = base64.b64encode(data).decode("ascii")

        return SlideImageContext(
            page=args.page,
            courseName=course_name,
            imageUrl=self._slide_image_url(args.course_id, args.page),
            dataUrl=f"data:image/webp;base64,{encoded}",
        )

    def _get_vector_store(self) -> Any:
        if self._vector_store is not None:
            return self._vector_store

        if self._vector_store_error:
            raise RuntimeError(self._vector_store_error)

        try:
            from langchain_chroma import Chroma
            from langchain_huggingface import HuggingFaceEmbeddings
        except ImportError as exc:
            self._vector_store_error = f"缺少知识库依赖：{exc}"
            raise RuntimeError(self._vector_store_error) from exc

        try:
            embeddings = HuggingFaceEmbeddings(
                model_name=self.embedding_model,
                model_kwargs={"device": self._detect_embedding_device()},
                encode_kwargs={"normalize_embeddings": True},
            )
            self._vector_store = Chroma(
                collection_name=self.chroma_collection,
                embedding_function=embeddings,
                persist_directory=str(self.chroma_dir),
            )
        except Exception as exc:
            self._vector_store_error = f"知识库初始化失败：{exc}"
            raise RuntimeError(self._vector_store_error) from exc

        return self._vector_store

    def _detect_embedding_device(self) -> str:
        try:
            import torch
        except ImportError:
            return "cpu"

        if torch.cuda.is_available():
            return "cuda"

        mps = getattr(getattr(torch, "backends", None), "mps", None)
        if mps is not None and mps.is_available():
            return "mps"

        return "cpu"

    def _clean_generated_title(self, value: str) -> str:
        title = " ".join(value.strip().split())
        title = title.strip("「」『』“”\"'`。.!！?？：:")
        title = re.sub(r"^(标题|会话标题)\s*[:：]\s*", "", title).strip()
        return title[:20]

    def _clean_autocomplete_suggestion(self, value: str, cursor_before: str = "") -> str:
        text = str(value or "").strip()
        text = re.sub(r"^```[A-Za-z0-9_-]*\s*", "", text)
        text = re.sub(r"\s*```$", "", text).strip()
        text = re.sub(r"^(补全|建议|续写)\s*[:：]\s*", "", text).strip()
        text = re.sub(r"【P\d+】", "", text)
        text = re.sub(r"【[^】\n]+-\d+】", "", text)
        text = re.sub(r"\[引用第\d+页\]", "", text)
        text = text.strip(" \t\r\n\"'`“”")

        if text.lower() in {"", "null", "none"} or text in {"无", "空", "不需要补全", "无需补全"}:
            return ""

        before_tail = cursor_before.strip()[-120:]
        if before_tail and text.startswith(before_tail):
            text = text[len(before_tail) :].lstrip()

        return text[:500].strip()

    def _fallback_title_from_query(self, query: str) -> str:
        title = re.sub(r"\s+", "", query.strip())
        title = re.sub(r"[，。！？、,.!?；;：:「」『』“”\"'`]+", "", title)
        return title[:16] or "课程学习"

    def _course_outline_from_chroma(self, deck: dict[str, Any]) -> list[dict[str, Any]]:
        try:
            import chromadb
        except ImportError as exc:
            logger.warning("缺少 ChromaDB 依赖，无法提取标题大纲：%s", exc)
            return []

        source = self._course_source_from_deck(deck)
        if not source:
            return []

        try:
            client = chromadb.PersistentClient(path=str(self.chroma_dir))
            collection = client.get_collection(self.chroma_collection)
            result = collection.get(
                where={"source": source},
                include=["metadatas"],
                limit=1000,
            )
        except Exception as exc:
            logger.warning("从 Chroma 提取标题大纲失败：%s", exc)
            return []

        metadatas = result.get("metadatas") or []
        outline: list[dict[str, Any]] = []
        seen: set[tuple[str, str, str]] = set()

        for metadata in metadatas:
            if not isinstance(metadata, dict):
                continue

            section = str(metadata.get("Section") or "").strip()
            topic = str(metadata.get("Topic") or "").strip()
            page = str(metadata.get("page") or "").strip()

            if not section and not topic:
                continue

            key = (page, section, topic)
            if key in seen:
                continue

            seen.add(key)
            outline.append(
                {
                    "page": page,
                    "section": section,
                    "topic": topic,
                }
            )

        return sorted(outline, key=lambda item: self._page_sort_key(item.get("page")))[:32]

    def _slide_text_from_chroma(self, course_id: str, page: int) -> str:
        try:
            import chromadb
        except ImportError as exc:
            logger.warning("缺少 ChromaDB 依赖，无法提取当前页文字：%s", exc)
            return ""

        try:
            deck = build_course_deck(course_id)
        except (CourseNotFound, SlideCatalogError) as exc:
            logger.warning("无法读取当前课程，跳过当前页文字提取：%s", exc)
            return ""

        source = self._course_source_from_deck(deck)
        if not source:
            return ""

        try:
            client = chromadb.PersistentClient(path=str(self.chroma_dir))
            collection = client.get_collection(self.chroma_collection)
            result = collection.get(
                where={"source": source},
                include=["documents", "metadatas"],
                limit=1000,
            )
        except Exception as exc:
            logger.warning("从 Chroma 提取当前页文字失败：%s", exc)
            return ""

        documents = result.get("documents") or []
        metadatas = result.get("metadatas") or []
        chunks: list[str] = []

        for document, metadata in zip(documents, metadatas):
            if not isinstance(metadata, dict):
                continue

            if not self._page_range_contains(metadata.get("page"), page):
                continue

            content = str(document or "").strip()
            if not content:
                continue

            section = str(metadata.get("Section") or "").strip()
            topic = str(metadata.get("Topic") or "").strip()
            heading = " / ".join(part for part in (section, topic) if part)

            if heading:
                chunks.append(f"{heading}\n{content}")
            else:
                chunks.append(content)

        return self._trim_text("\n\n".join(chunks), 2000)

    def _quiz_contexts_from_chroma(self, deck: dict[str, Any]) -> list[dict[str, Any]]:
        source = self._course_source_from_deck(deck)
        if not source:
            return []

        candidates: list[dict[str, Any]] = []

        try:
            import chromadb
        except ImportError as exc:
            logger.warning("Missing ChromaDB dependency for quiz generation: %s", exc)
        except Exception as exc:
            logger.warning("Failed to import ChromaDB for quiz generation: %s", exc)
        else:
            try:
                client = chromadb.PersistentClient(path=str(self.chroma_dir))
                collection = client.get_collection(self.chroma_collection)
                result = collection.get(
                    where={"source": source},
                    include=["documents", "metadatas"],
                    limit=1000,
                )
                documents = result.get("documents") or []
                metadatas = result.get("metadatas") or []
                candidates = self._quiz_context_candidates(documents, metadatas)
            except Exception as exc:
                logger.warning("Failed to read quiz context from Chroma: %s", exc)

        if not candidates:
            candidates = self._quiz_context_candidates_from_export(source)

        return self._quiz_contexts_from_candidates(candidates)

    def _quiz_context_candidates(self, documents: list[Any], metadatas: list[Any]) -> list[dict[str, Any]]:
        candidates: list[dict[str, Any]] = []
        seen: set[tuple[int, str]] = set()

        for document, metadata in zip(documents, metadatas):
            if not isinstance(metadata, dict):
                continue

            page = self._page_start(metadata.get("page"))
            content = str(document or "").strip()
            if page is None or not content:
                continue

            dedupe_key = (page, content[:160])
            if dedupe_key in seen:
                continue
            seen.add(dedupe_key)

            candidates.append(
                {
                    "page": page,
                    "section": str(metadata.get("Section") or "").strip(),
                    "topic": str(metadata.get("Topic") or "").strip(),
                    "content": content,
                }
            )

        return sorted(candidates, key=lambda item: (item["page"], item["section"], item["topic"]))

    def _quiz_context_candidates_from_export(self, source: str) -> list[dict[str, Any]]:
        export_path = REPO_ROOT / "chroma_db_export.md"
        if not export_path.exists():
            return []

        try:
            export_text = export_path.read_text(encoding="utf-8")
        except OSError as exc:
            logger.warning("Failed to read Chroma export for quiz generation: %s", exc)
            return []

        documents: list[str] = []
        metadatas: list[dict[str, Any]] = []
        block_pattern = re.compile(
            r"### metadata\s*```json\s*(\{.*?\})\s*```\s*### document\s*```markdown\s*(.*?)\s*```",
            re.DOTALL,
        )

        for match in block_pattern.finditer(export_text):
            try:
                metadata = json.loads(match.group(1))
            except json.JSONDecodeError:
                continue

            if not isinstance(metadata, dict) or metadata.get("source") != source:
                continue

            metadatas.append(metadata)
            documents.append(match.group(2).strip())

        return self._quiz_context_candidates(documents, metadatas)

    def _quiz_contexts_from_candidates(self, candidates: list[dict[str, Any]]) -> list[dict[str, Any]]:
        candidates = sorted(candidates, key=lambda item: (item["page"], item["section"], item["topic"]))

        contexts: list[dict[str, Any]] = []
        total_chars = 0
        for item in candidates:
            if len(contexts) >= 24 or total_chars >= 16_000:
                break

            source_id = f"S{len(contexts) + 1}"
            label = f"P{item['page']}"
            heading = " / ".join(part for part in (item["section"], item["topic"]) if part)
            content = self._trim_text(item["content"], 900)
            total_chars += len(content)
            contexts.append(
                {
                    "sourceId": source_id,
                    "pageNumber": item["page"],
                    "label": label,
                    "heading": heading,
                    "content": content,
                }
            )

        return contexts

    def _build_question_generation_messages(
        self,
        deck: dict[str, Any],
        quiz_request: QuestionGenerateRequest,
        contexts: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        course_name = str(deck.get("title") or deck.get("courseId") or "CS101")
        type_text = ", ".join(quiz_request.types)
        context_text = "\n\n".join(
            (
                f"[{item['sourceId']}] page={item['pageNumber']} label={item['label']}"
                f"{' heading=' + item['heading'] if item.get('heading') else ''}\n"
                f"{item['content']}"
            )
            for item in contexts
        )
        note_text = self._trim_text(quiz_request.currentNote, 2500) or "无"
        prompt = self.prompts["question_generation_user"].format(
            course_name=course_name,
            count=quiz_request.count,
            question_types=type_text,
            context_text=context_text,
            note_text=note_text,
        )

        return [
            {"role": "system", "content": self.prompts["question_generation_system"]},
            {"role": "user", "content": prompt},
        ]

    def _build_highlight_generation_messages(
        self,
        deck: dict[str, Any],
        highlight_request: HighlightGenerateRequest,
        contexts: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        course_name = str(deck.get("title") or deck.get("courseId") or "CS101")
        context_text = "\n\n".join(
            (
                f"[{item['sourceId']}] page={item['pageNumber']} label={item['label']}"
                f"{' heading=' + item['heading'] if item.get('heading') else ''}\n"
                f"{item['content']}"
            )
            for item in contexts
        )
        note_text = self._trim_text(highlight_request.currentNote, 2500) or "无"
        prompt = self.prompts["highlight_generation_user"].format(
            course_name=course_name,
            count=highlight_request.count,
            context_text=context_text,
            note_text=note_text,
        )

        return [
            {"role": "system", "content": self.prompts["highlight_generation_system"]},
            {"role": "user", "content": prompt},
        ]

    def _build_mindmap_generation_messages(
        self,
        deck: dict[str, Any],
        mindmap_request: MindmapGenerateRequest,
        contexts: list[dict[str, Any]],
    ) -> list[dict[str, Any]]:
        course_name = str(deck.get("title") or deck.get("courseId") or "CS101")
        context_text = "\n\n".join(
            (
                f"[{item['sourceId']}] page={item['pageNumber']} label={item['label']}"
                f"{' heading=' + item['heading'] if item.get('heading') else ''}\n"
                f"{item['content']}"
            )
            for item in contexts
        )
        note_text = self._trim_text(mindmap_request.currentNote, 2500) or "无"
        focus_text = self._trim_text(mindmap_request.focus, 120) or "整节课"
        prompt = self.prompts["mindmap_generation_user"].format(
            course_name=course_name,
            depth=mindmap_request.depth,
            focus=focus_text,
            context_text=context_text,
            note_text=note_text,
        )

        return [
            {"role": "system", "content": self.prompts["mindmap_generation_system"]},
            {"role": "user", "content": prompt},
        ]

    def _normalize_generated_questions(
        self,
        data: dict[str, Any],
        quiz_request: QuestionGenerateRequest,
        contexts: list[dict[str, Any]],
        course_id: str,
    ) -> list[dict[str, Any]]:
        raw_questions = data.get("questions") if isinstance(data, dict) else None
        if not isinstance(raw_questions, list):
            raise QuizGenerationError("Generated response does not contain questions.")

        source_map = {item["sourceId"]: item for item in contexts}
        normalized: list[dict[str, Any]] = []

        for raw_item in raw_questions:
            try:
                item = self._model_validate(RawGeneratedQuestion, raw_item)
            except ValidationError as exc:
                raise QuizGenerationError("Generated question has invalid shape.") from exc

            question = " ".join(item.question.strip().split())
            explanation = item.explanation.strip()
            if not question or not explanation:
                raise QuizGenerationError("Generated question is missing text.")

            if item.type == "single_choice":
                options = [" ".join(option.strip().split()) for option in item.options]
                if len(options) != 4 or any(not option for option in options):
                    raise QuizGenerationError("Single choice questions must have four options.")
            else:
                options = ["正确", "错误"]

            if item.answerIndex < 0 or item.answerIndex >= len(options):
                raise QuizGenerationError("Generated answer index is out of range.")

            source_ids = [source_id for source_id in item.sourceIds if source_id in source_map]
            if not source_ids:
                raise QuizGenerationError("Generated question does not cite valid course context.")

            citations = []
            seen_pages: set[int] = set()
            for source_id in source_ids[:2]:
                source = source_map[source_id]
                page = int(source["pageNumber"])
                if page in seen_pages:
                    continue
                seen_pages.add(page)
                citations.append(
                    {
                        "pageNumber": page,
                        "label": source["label"],
                        "imageUrl": self._slide_image_url(course_id, page),
                    }
                )

            normalized.append(
                {
                    "id": f"q_{len(normalized) + 1}",
                    "type": item.type,
                    "question": question[:500],
                    "options": options,
                    "answerIndex": item.answerIndex,
                    "explanation": explanation[:800],
                    "citations": citations,
                }
            )

            if len(normalized) >= quiz_request.count:
                break

        if len(normalized) < quiz_request.count:
            raise QuizGenerationError("Generated fewer valid questions than requested.")

        return normalized

    def _normalize_generated_highlights(
        self,
        data: dict[str, Any],
        highlight_request: HighlightGenerateRequest,
        contexts: list[dict[str, Any]],
        course_id: str,
    ) -> list[dict[str, Any]]:
        raw_highlights = data.get("highlights") if isinstance(data, dict) else None
        if not isinstance(raw_highlights, list):
            raise HighlightGenerationError("Generated response does not contain highlights.")

        source_map = {item["sourceId"]: item for item in contexts}
        normalized: list[dict[str, Any]] = []

        for raw_item in raw_highlights:
            try:
                item = self._model_validate(RawGeneratedHighlight, raw_item)
            except ValidationError as exc:
                raise HighlightGenerationError("Generated highlight has invalid shape.") from exc

            title = " ".join(item.title.strip().split())
            summary = item.summary.strip()
            if not title or not summary:
                raise HighlightGenerationError("Generated highlight is missing text.")

            source_ids = [source_id for source_id in item.sourceIds if source_id in source_map]
            if not source_ids:
                raise HighlightGenerationError("Generated highlight does not cite valid course context.")

            citations = []
            seen_pages: set[int] = set()
            for source_id in source_ids[:2]:
                source = source_map[source_id]
                page = int(source["pageNumber"])
                if page in seen_pages:
                    continue
                seen_pages.add(page)
                citations.append(
                    {
                        "pageNumber": page,
                        "label": source["label"],
                        "imageUrl": self._slide_image_url(course_id, page),
                    }
                )

            normalized.append(
                {
                    "id": f"h_{len(normalized) + 1}",
                    "title": title[:80],
                    "summary": summary[:700],
                    "importance": item.importance,
                    "citations": citations,
                }
            )

            if len(normalized) >= highlight_request.count:
                break

        if len(normalized) < highlight_request.count:
            raise HighlightGenerationError("Generated fewer valid highlights than requested.")

        return normalized

    def _normalize_generated_mindmap(
        self,
        data: dict[str, Any],
        mindmap_request: MindmapGenerateRequest,
        contexts: list[dict[str, Any]],
        course_id: str,
    ) -> dict[str, Any]:
        raw_root = data.get("mindmap") if isinstance(data, dict) else None
        if not isinstance(raw_root, dict):
            raise MindmapGenerationError("Generated response does not contain a mindmap.")

        source_map = {item["sourceId"]: item for item in contexts}

        def citations_from_source_ids(source_ids: Any) -> list[dict[str, Any]]:
            if not isinstance(source_ids, list):
                return []

            citations = []
            seen_pages: set[int] = set()
            for source_id in source_ids:
                source = source_map.get(str(source_id))
                if not source:
                    continue
                page = int(source["pageNumber"])
                if page in seen_pages:
                    continue
                seen_pages.add(page)
                citations.append(
                    {
                        "pageNumber": page,
                        "label": source["label"],
                        "imageUrl": self._slide_image_url(course_id, page),
                    }
                )
                if len(citations) >= 2:
                    break

            return citations

        def normalize_node(raw_node: Any, depth: int, path: str) -> Optional[dict[str, Any]]:
            if not isinstance(raw_node, dict):
                return None

            title = " ".join(str(raw_node.get("title") or "").strip().split())
            if not title:
                return None

            summary = " ".join(str(raw_node.get("summary") or "").strip().split())
            children = []
            if depth < mindmap_request.depth:
                raw_children = raw_node.get("children")
                if isinstance(raw_children, list):
                    for index, raw_child in enumerate(raw_children[:8], start=1):
                        child = normalize_node(raw_child, depth + 1, f"{path}_{index}")
                        if child:
                            children.append(child)

            return {
                "id": f"m_{path}",
                "title": title[:90],
                "summary": summary[:500],
                "citations": citations_from_source_ids(raw_node.get("sourceIds")),
                "children": children,
            }

        mindmap = normalize_node(raw_root, 1, "1")
        if not mindmap:
            raise MindmapGenerationError("Generated mind map root is invalid.")

        if self._count_mindmap_nodes(mindmap) < 2:
            raise MindmapGenerationError("Generated mind map has too few nodes.")

        return mindmap

    def _count_mindmap_nodes(self, node: dict[str, Any]) -> int:
        return 1 + sum(
            self._count_mindmap_nodes(child)
            for child in node.get("children", [])
            if isinstance(child, dict)
        )

    def _course_source_from_deck(self, deck: dict[str, Any]) -> Optional[str]:
        resolved_course_id = str(deck.get("resolvedCourseId") or deck.get("courseId") or "")
        if "--" not in resolved_course_id:
            return None

        week, title = resolved_course_id.split("--", 1)
        if not week or not title:
            return None

        return f"course_data/{week}/{title}.md"

    def _format_course_outline(self, outline: list[dict[str, Any]]) -> str:
        lines: list[str] = []

        for item in outline[:24]:
            page = str(item.get("page") or "").strip()
            section = str(item.get("section") or "").strip()
            topic = str(item.get("topic") or "").strip()
            title = " / ".join(part for part in (section, topic) if part)

            if not title:
                continue

            if page:
                lines.append(f"- P{page}: {title}")
            else:
                lines.append(f"- {title}")

        return "\n".join(lines)

    def _page_sort_key(self, value: Any) -> tuple[int, str]:
        page = self._page_start(value)
        return (page if page is not None else 99999, str(value or ""))

    async def _route_query(self, chat_request: ChatRequest, latest_query: str) -> RouterDecision:
        short_history = self._router_history(chat_request.messages)
        course_starter_context = self._course_starter_context(chat_request.messages)
        prompt = self.prompts["router_user"].format(
            course_id=chat_request.courseId,
            current_page=chat_request.currentPage,
            course_starter_context=course_starter_context,
            short_history_json=json.dumps(short_history, ensure_ascii=False),
            latest_query=latest_query,
        )

        try:
            response = await self._complete_task(
                "router",
                messages=[
                    {"role": "system", "content": self.prompts["router_system"]},
                    {"role": "user", "content": prompt},
                ],
            )
            content = self._extract_message_content(response).strip()
            return self._model_validate_json(RouterDecision, self._extract_json_object(content))
        except Exception as exc:
            logger.warning("Router 调用失败，使用规则兜底：%s", exc)
            return self._fallback_route(latest_query)

    def _fallback_route(self, query: str) -> RouterDecision:
        needs_slide_image = bool(VISUAL_QUERY_RE.search(query))
        needs_vector_search = bool(COURSE_QUERY_RE.search(query)) or needs_slide_image
        intent: Literal["chat", "course_knowledge", "slide_visual"]

        if needs_slide_image:
            intent = "slide_visual"
        elif needs_vector_search:
            intent = "course_knowledge"
        else:
            intent = "chat"

        return RouterDecision(
            intent=intent,
            needs_vector_search=needs_vector_search,
            needs_slide_image=needs_slide_image,
            reason="router fallback",
        )

    async def _stream_final_answer(
        self,
        chat_request: ChatRequest,
        contexts: list[dict[str, Any]],
        citations: list[Citation],
        slide_image: Optional[SlideImageContext],
    ) -> AsyncIterator[str]:
        messages = self._build_answer_messages(
            chat_request=chat_request,
            contexts=contexts,
            citations=citations,
            slide_image=slide_image,
        )

        async for delta in self._stream_task("final_answer", messages):
            yield delta

    async def _complete_task(self, task: str, messages: list[dict[str, Any]]) -> dict[str, Any]:
        return await self.chat_client.complete_with_fallback(
            self.models.for_task_chain(task),
            messages,
        )

    async def _stream_task(
        self,
        task: str,
        messages: list[dict[str, Any]],
    ) -> AsyncIterator[str]:
        async for delta in self.chat_client.stream_with_fallback(
            self.models.for_task_chain(task),
            messages,
        ):
            yield delta

    def _build_answer_messages(
        self,
        chat_request: ChatRequest,
        contexts: list[dict[str, Any]],
        citations: list[Citation],
        slide_image: Optional[SlideImageContext],
    ) -> list[dict[str, Any]]:
        citation_text = "\n".join(
            f"- {item.label or self._citation_label(chat_request.courseId, item.courseId, item.page)}："
            f"{item.courseName} 第 {item.page} 页"
            f"{' / ' + item.section if item.section else ''}"
            for item in citations
        ) or "无结构化引用。"
        context_text = self._format_contexts(contexts)
        history = self._trim_history(chat_request.messages)
        note = self._trim_text(chat_request.currentNote, 4000)
        tone_prompt = self.prompts.get(
            f"final_answer_tone_{chat_request.answerMode}",
            self.prompts.get("final_answer_tone_friendly", ""),
        )
        system_prompt = "\n".join(
            part for part in (self.prompts["final_answer_system"], tone_prompt) if part
        )
        user_context = self.prompts["final_answer_context"].format(
            citation_text=citation_text,
            context_text=context_text,
            note_text=note or "无",
        )

        messages: list[dict[str, Any]] = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_context},
        ]

        for message in history:
            messages.append({"role": message.role, "content": message.content})

        if slide_image:
            messages.append(
                {
                    "role": "user",
                    "content": [
                        {
                            "type": "text",
                            "text": (
                                f"这是当前或目标 Slide 第 {slide_image.page} 页图片。"
                                f"回答涉及图片时请引用 "
                                f"{self._citation_label(chat_request.courseId, chat_request.courseId, slide_image.page)}。"
                            ),
                        },
                        {
                            "type": "image_url",
                            "image_url": {"url": slide_image.dataUrl},
                        },
                    ],
                }
            )

        return messages

    def _format_contexts(self, contexts: list[dict[str, Any]]) -> str:
        if not contexts:
            return "无"

        formatted: list[str] = []
        for index, item in enumerate(contexts[:5], start=1):
            metadata = item.get("metadata", {})
            page = metadata.get("page", "未知")
            course = metadata.get("Course", "未知课程")
            section = metadata.get("Section", "")
            content = self._trim_text(str(item.get("content", "")).strip(), 1200)
            formatted.append(
                f"[资料 {index}] 课程：{course}；页码：{page}；章节：{section}\n{content}"
            )

        return "\n\n".join(formatted)

    def _build_citations(self, course_id: str, contexts: list[dict[str, Any]]) -> list[Citation]:
        deck_title = self._safe_course_title(course_id)
        citations: list[Citation] = []

        for item in contexts:
            metadata = item.get("metadata", {})
            page = self._page_start(metadata.get("page"))
            if page is None:
                continue

            citation_course_id = self._course_id_from_source(metadata.get("source")) or course_id
            citation = Citation(
                page=page,
                courseName=str(metadata.get("Course") or deck_title),
                courseId=citation_course_id,
                label=self._citation_label(course_id, citation_course_id, page),
                source=metadata.get("source"),
                section=metadata.get("Section"),
                imageUrl=self._slide_image_url(citation_course_id, page),
            )
            citations = self._merge_citations(citations, [citation])

        return citations

    def _merge_citations(self, primary: list[Citation], secondary: list[Citation]) -> list[Citation]:
        merged: list[Citation] = []
        seen: set[tuple[str, int]] = set()

        for citation in [*primary, *secondary]:
            key = (citation.courseId, citation.page)
            if key in seen:
                continue
            seen.add(key)
            merged.append(citation)

        return merged

    def _safe_course_title(self, course_id: str) -> str:
        try:
            deck = build_course_deck(course_id)
        except (CourseNotFound, SlideCatalogError):
            return course_id

        return str(deck.get("title") or course_id)

    def _course_id_from_source(self, source: Any) -> Optional[str]:
        if not isinstance(source, str):
            return None

        path = Path(source)
        parts = path.parts
        if len(parts) != 3 or parts[0] != "course_data" or path.suffix != ".md":
            return None

        course_id = f"{parts[1]}--{path.stem}"

        try:
            build_course_deck(course_id)
        except (CourseNotFound, SlideCatalogError):
            return None

        return course_id

    def _citation_label(self, current_course_id: str, citation_course_id: str, page: int) -> str:
        current_resolved = self._resolve_course_id(current_course_id)
        citation_resolved = self._resolve_course_id(citation_course_id)

        if citation_resolved == current_resolved:
            return f"【P{page}】"

        return f"【{citation_resolved}-{page}】"

    def _resolve_course_id(self, course_id: str) -> str:
        try:
            deck = build_course_deck(course_id)
        except (CourseNotFound, SlideCatalogError):
            return course_id

        return str(deck.get("resolvedCourseId") or course_id)

    def _router_history(self, messages: list[ChatMessage]) -> list[dict[str, str]]:
        short_messages = messages[-4:-1]
        return [
            {
                "role": message.role,
                "content": self._trim_text(message.content, 240),
            }
            for message in short_messages
            if message.content.strip()
        ]

    def _course_starter_context(self, messages: list[ChatMessage]) -> str:
        for message in messages:
            message_id = str(message.id or "")
            if (
                message.role == "assistant"
                and message_id.startswith("assistant-starter-")
                and message.content.strip()
            ):
                return self._trim_text(message.content, 600)

        for message in messages:
            if message.role == "user":
                break

            if message.role == "assistant" and message.content.strip():
                return self._trim_text(message.content, 600)

        return ""

    def _trim_history(self, messages: list[ChatMessage]) -> list[ChatMessage]:
        trimmed: list[ChatMessage] = []
        total_chars = 0

        for message in reversed(messages[-12:]):
            content = self._trim_text(message.content, 2000)
            total_chars += len(content)
            if total_chars > 12000:
                break
            trimmed.append(ChatMessage(role=message.role, content=content, id=message.id))

        return list(reversed(trimmed))

    def _latest_user_query(self, messages: list[ChatMessage]) -> str:
        for message in reversed(messages):
            if message.role == "user" and message.content.strip():
                return message.content.strip()
        return ""

    def _page_references_from_query(self, query: str) -> list[int]:
        pages = []
        for match in PAGE_REFERENCE_RE.finditer(query or ""):
            page = int(match.group(1))
            if page > 0:
                pages.append(page)
        return self._dedupe_ints(pages)

    def _dedupe_ints(self, values: list[int]) -> list[int]:
        result: list[int] = []
        seen: set[int] = set()
        for value in values:
            if value in seen:
                continue
            seen.add(value)
            result.append(value)
        return result

    def _page_start(self, value: Any) -> Optional[int]:
        if value is None:
            return None

        match = PAGE_START_RE.search(str(value))
        if not match:
            return None

        page = int(match.group(0))
        return page if page > 0 else None

    def _page_range_contains(self, value: Any, page: int) -> bool:
        numbers = [int(match) for match in PAGE_START_RE.findall(str(value or ""))]
        if not numbers:
            return False
        if len(numbers) == 1:
            return numbers[0] == page
        return min(numbers[0], numbers[-1]) <= page <= max(numbers[0], numbers[-1])

    def _slide_image_url(self, course_id: str, page: int) -> str:
        return f"/api/slides/{quote(course_id, safe='')}/pages/{page}"

    def _repo_path(self, value: str) -> Path:
        path = Path(value).expanduser()
        if path.is_absolute():
            return path
        return REPO_ROOT / path

    def _extract_message_content(self, response: dict[str, Any]) -> str:
        choices = response.get("choices") or []
        if not choices:
            return ""
        message = choices[0].get("message") or {}
        content = message.get("content")
        return content if isinstance(content, str) else ""

    def _extract_stream_delta(self, chunk: dict[str, Any]) -> str:
        choices = chunk.get("choices") or []
        if not choices:
            return ""
        delta = choices[0].get("delta") or {}
        content = delta.get("content")
        return content if isinstance(content, str) else ""

    def _extract_json_object(self, content: str) -> str:
        start = content.find("{")
        end = content.rfind("}")
        if start == -1 or end == -1 or end <= start:
            raise ValueError("router response does not contain a JSON object")
        return content[start : end + 1]

    def _trim_text(self, value: str, limit: int) -> str:
        text = value.strip()
        if len(text) <= limit:
            return text
        return f"{text[:limit]}..."

    def _model_validate(self, model_cls: type[BaseModel], data: Any) -> Any:
        if hasattr(model_cls, "model_validate"):
            return model_cls.model_validate(data)
        return model_cls.parse_obj(data)

    def _model_validate_json(self, model_cls: type[BaseModel], data: str) -> Any:
        if hasattr(model_cls, "model_validate_json"):
            return model_cls.model_validate_json(data)
        return model_cls.parse_raw(data)

    def _model_dump(self, model: BaseModel) -> dict[str, Any]:
        if hasattr(model, "model_dump"):
            return model.model_dump()
        return model.dict()
