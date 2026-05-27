from __future__ import annotations

import asyncio
import logging
import re
from pathlib import Path

from backend.conversation_store import utc_now_iso
from backend.notebook_store import (
    build_notebook_shell,
    read_notebook_store,
    sorted_notebook_summaries,
    write_notebook_store,
)


logger = logging.getLogger(__name__)

FIRST_SAVE_MIN_CHARS = 20
TITLE_REGEN_CHARS = 50
MAX_NOTEBOOK_CONTENT_CHARS = 200_000


class NotebookService:
    def __init__(self, store_path: Path, rag_service) -> None:
        self.store_path = store_path
        self.rag_service = rag_service

    def list_summaries(self) -> list[dict]:
        return sorted_notebook_summaries(read_notebook_store(self.store_path))

    def create_notebook(self) -> dict:
        store = read_notebook_store(self.store_path)
        notebook = build_notebook_shell()
        store["notebooks"][notebook["id"]] = notebook
        write_notebook_store(self.store_path, store)
        return notebook

    def get_notebook(self, notebook_id: str) -> dict | None:
        notebook = read_notebook_store(self.store_path)["notebooks"].get(notebook_id)
        return notebook if isinstance(notebook, dict) else None

    def delete_notebook(self, notebook_id: str) -> bool:
        store = read_notebook_store(self.store_path)

        if notebook_id not in store["notebooks"]:
            return False

        del store["notebooks"][notebook_id]
        write_notebook_store(self.store_path, store)
        return True

    def save_notebook(
        self,
        notebook_id: str,
        content: str,
        force_title: bool = False,
    ) -> dict | None:
        if len(content) > MAX_NOTEBOOK_CONTENT_CHARS:
            raise ValueError("Notebook content is too large.")

        store = read_notebook_store(self.store_path)
        notebook = store["notebooks"].get(notebook_id)

        if not isinstance(notebook, dict):
            return None

        char_count = len(content.strip())
        has_saved_content = bool(notebook.get("contentSavedAt"))

        if not has_saved_content and char_count <= FIRST_SAVE_MIN_CHARS:
            return {
                "notebook": notebook,
                "saved": False,
                "titleUpdated": False,
            }

        now = utc_now_iso()
        notebook["content"] = content
        notebook["updatedAt"] = now

        if not notebook.get("contentSavedAt"):
            notebook["contentSavedAt"] = now

        title_updated = False
        should_generate_title = self._should_generate_title(notebook, char_count, force_title)

        if should_generate_title:
            current_title = str(notebook.get("title") or "未命名笔记")
            generated_title = self._generate_title(current_title, content)

            if generated_title:
                cleaned_title = self._clean_title(generated_title) or current_title
                title_updated = cleaned_title != current_title
                notebook["title"] = cleaned_title
                notebook["titleGeneratedAt"] = utc_now_iso()
                notebook["titleGeneratedContentLength"] = char_count

        write_notebook_store(self.store_path, store)

        return {
            "notebook": notebook,
            "saved": True,
            "titleUpdated": title_updated,
        }

    def export_filename(self, notebook: dict) -> str:
        title = self._clean_filename(str(notebook.get("title") or "未命名笔记"))
        return f"{title or '未命名笔记'}.md"

    def _should_generate_title(self, notebook: dict, char_count: int, force_title: bool) -> bool:
        if char_count <= FIRST_SAVE_MIN_CHARS:
            return False

        if force_title:
            return True

        if not notebook.get("titleGeneratedAt"):
            return True

        last_length = int(notebook.get("titleGeneratedContentLength") or 0)
        return char_count - last_length >= TITLE_REGEN_CHARS

    def _generate_title(self, current_title: str, content: str) -> str:
        try:
            return asyncio.run(
                self.rag_service.generate_notebook_title(
                    current_title=current_title,
                    content=content,
                )
            )
        except Exception:
            logger.exception("生成笔记本标题失败")
            return ""

    def _clean_title(self, value: str) -> str:
        title = " ".join(str(value or "").strip().split())
        title = title.strip("「」『』“”\"'`。.!！?？：:")
        title = re.sub(r"^(标题|笔记标题)\s*[:：]\s*", "", title).strip()
        return title[:20]

    def _clean_filename(self, value: str) -> str:
        name = " ".join(value.strip().split())
        name = re.sub(r"[\\/:*?\"<>|]+", "-", name)
        return name.strip(". ")[:80]
