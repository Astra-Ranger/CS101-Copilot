from __future__ import annotations

from typing import Literal, Optional

from pydantic import BaseModel, Field, validator


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
    scope: Literal["current"] = "current"
    currentNote: str = Field(default="")


class MindmapGenerateRequest(BaseModel):
    depth: int = Field(default=3, ge=2, le=4)
    scope: Literal["current", "all"] = "current"
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
