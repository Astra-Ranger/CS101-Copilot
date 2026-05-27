from __future__ import annotations

from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from backend.conversation_store import read_json_store, utc_now_iso, write_json_store


def read_notebook_store(path: Path) -> dict:
    data = read_json_store(path, {"notebooks": {}})
    notebooks = data.get("notebooks") if isinstance(data, dict) else None

    if not isinstance(notebooks, dict):
        return {"notebooks": {}}

    return {"notebooks": notebooks}


def write_notebook_store(path: Path, store: dict) -> None:
    write_json_store(path, store)


def build_notebook_shell(notebook_id: str | None = None) -> dict:
    now = utc_now_iso()

    return {
        "id": notebook_id
        or f"note_{int(datetime.now(timezone.utc).timestamp() * 1000)}_{uuid4().hex[:6]}",
        "title": "未命名笔记",
        "content": "",
        "createdAt": now,
        "updatedAt": now,
        "contentSavedAt": None,
        "titleGeneratedAt": None,
        "titleGeneratedContentLength": 0,
    }


def notebook_summary(notebook: dict) -> dict:
    content = str(notebook.get("content") or "")
    preview = " ".join(content.split())[:80]

    return {
        "id": notebook.get("id"),
        "title": notebook.get("title") or "未命名笔记",
        "createdAt": notebook.get("createdAt"),
        "updatedAt": notebook.get("updatedAt"),
        "contentSavedAt": notebook.get("contentSavedAt"),
        "titleGeneratedAt": notebook.get("titleGeneratedAt"),
        "contentLength": len(content.strip()),
        "preview": preview,
    }


def sorted_notebook_summaries(store: dict) -> list[dict]:
    notebooks = [
        notebook
        for notebook in store.get("notebooks", {}).values()
        if isinstance(notebook, dict)
    ]
    notebooks.sort(
        key=lambda notebook: str(notebook.get("updatedAt") or notebook.get("createdAt") or ""),
        reverse=True,
    )
    return [notebook_summary(notebook) for notebook in notebooks]
