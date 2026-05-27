import os
import sys
import json
import asyncio
import queue
import re
import threading
from uuid import uuid4
from pathlib import Path
from datetime import datetime, timezone
from urllib.parse import quote

from flask import Flask, Response, jsonify, request, send_file, send_from_directory, stream_with_context

try:
    from dotenv import load_dotenv
except ModuleNotFoundError:
    def load_dotenv():
        return False


load_dotenv()

REPO_ROOT = Path(__file__).resolve().parents[1]
FRONTEND_DIR = REPO_ROOT / "frontend"
NOTES_PATH = Path(os.getenv("COURSE_NOTES_PATH", REPO_ROOT / "backend" / "user_notes.json"))
NOTEBOOKS_PATH = Path(REPO_ROOT / "backend" / "note_notebooks.json")
CHAT_HISTORY_PATH = Path(
    os.getenv("COURSE_CHAT_HISTORY_PATH", REPO_ROOT / "backend" / "chat_conversations.json")
)

if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from docker_1 import (  # noqa: E402
    CourseNotFound,
    InvalidSlidePage,
    SlideCatalogError,
    SlideNotFound,
    SlideRootNotFound,
    build_course_deck,
    build_course_index,
    get_slide_page_path,
)
from backend.conversation_store import (  # noqa: E402
    build_conversation_shell,
    chat_messages_from_payload,
    conversation_sort_key,
    conversation_summary,
    conversation_title,
    first_user_message,
    read_chat_store as read_chat_store_from_path,
    read_notes_store as read_notes_store_from_path,
    resolve_existing_course_id,
    utc_now_iso,
    write_chat_store as write_chat_store_to_path,
    write_notes_store as write_notes_store_to_path,
)
from backend.notebook_service import NotebookService  # noqa: E402
from backend.rag_service import CourseRAGService  # noqa: E402

app = Flask(__name__, static_folder=str(FRONTEND_DIR), static_url_path="")
rag_service = CourseRAGService()
notebook_service = NotebookService(NOTEBOOKS_PATH, rag_service)


def not_implemented(feature: str):
    return (
        jsonify(
            {
                "error": "NOT_IMPLEMENTED",
                "message": f"{feature} is reserved for the future backend implementation.",
            }
        ),
        501,
    )


def error_response(status_code: int, error: str, message: str, details=None):
    body = {
        "error": error,
        "message": message,
    }

    if details is not None:
        body["details"] = details

    return jsonify(body), status_code


def ascii_download_filename(filename: str) -> str:
    path = Path(str(filename or "notebook.md"))
    suffix = path.suffix or ".md"
    stem = path.stem or "notebook"
    ascii_stem = re.sub(r"[^A-Za-z0-9._-]+", "-", stem).strip("._-")
    ascii_suffix = re.sub(r"[^A-Za-z0-9.]+", "", suffix) or ".md"

    if not ascii_suffix.startswith("."):
        ascii_suffix = f".{ascii_suffix}"

    return f"{ascii_stem or 'notebook'}{ascii_suffix}"


def read_notes_store():
    return read_notes_store_from_path(NOTES_PATH)


def write_notes_store(notes):
    write_notes_store_to_path(NOTES_PATH, notes)


def read_chat_store():
    return read_chat_store_from_path(CHAT_HISTORY_PATH)


def write_chat_store(store):
    write_chat_store_to_path(CHAT_HISTORY_PATH, store)


def update_conversation_title(conversation, messages):
    first_user = first_user_message(messages)
    if not first_user:
        conversation["title"] = conversation_title(
            messages,
            f"{conversation.get('courseName') or '学习助手'} 对话",
        )
        return

    first_user_id = first_user.get("id") or ""
    if conversation.get("titleSourceUserId") == first_user_id and conversation.get("title"):
        return

    fallback = conversation_title(messages, f"{conversation.get('courseName') or '学习助手'} 对话")

    try:
        title = asyncio.run(
            rag_service.generate_conversation_title(
                str(first_user.get("content") or ""),
                str(conversation.get("courseName") or ""),
            )
        )
    except Exception:
        app.logger.exception("Failed to generate conversation title")
        title = fallback

    conversation["title"] = title or fallback
    conversation["titleSourceUserId"] = first_user_id


def sse_chunk(event: dict) -> str:
    event_type = event.get("type", "message")
    payload = {key: value for key, value in event.items() if key != "type"}

    return (
        f"event: {event_type}\n"
        f"data: {json.dumps(payload, ensure_ascii=False)}\n\n"
    )


def consume_rag_stream(request_payload, output_queue):
    async def consume():
        async for event in rag_service.answer_stream(request_payload):
            output_queue.put(sse_chunk(event))

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        loop.run_until_complete(consume())
    except Exception:
        app.logger.exception("RAG SSE stream failed")
        output_queue.put(
            sse_chunk(
                {
                    "type": "error",
                    "error": "CHAT_STREAM_ERROR",
                    "message": "聊天流生成失败。",
                }
            )
        )
    finally:
        loop.close()
        output_queue.put(None)


def consume_course_starter_stream(course_id, conversation, output_queue):
    async def consume():
        content_parts = []
        output_queue.put(sse_chunk({"type": "metadata", "conversation": conversation}))

        async for delta in rag_service.stream_course_starter(course_id):
            content_parts.append(delta)
            output_queue.put(sse_chunk({"type": "token", "delta": delta}))

        content = "".join(content_parts).strip()
        if content:
            conversation["messages"] = [
                {
                    "id": f"assistant-starter-{uuid4().hex[:10]}",
                    "role": "assistant",
                    "content": content,
                }
            ]
            conversation["title"] = conversation_title(
                conversation["messages"],
                f"{conversation.get('courseName') or '学习助手'} 学习建议",
            )
            conversation["updatedAt"] = utc_now_iso()

        output_queue.put(sse_chunk({"type": "metadata", "conversation": conversation_summary(conversation)}))
        output_queue.put(sse_chunk({"type": "done"}))

    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)

    try:
        loop.run_until_complete(consume())
    except Exception:
        app.logger.exception("Course starter SSE stream failed")
        output_queue.put(
            sse_chunk(
                {
                    "type": "error",
                    "error": "COURSE_STARTER_ERROR",
                    "message": "课程总结生成失败。",
                }
            )
        )
    finally:
        loop.close()
        output_queue.put(None)


@app.get("/")
def index():
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.get("/course/<path:_course_id>")
def course_page(_course_id: str):
    return send_from_directory(FRONTEND_DIR, "index.html")


@app.get("/health")
def health():
    return jsonify({"status": "ok"})


@app.get("/api/courses")
def list_courses():
    try:
        return jsonify(build_course_index())
    except SlideRootNotFound as exc:
        return error_response(500, "SLIDE_ROOT_NOT_FOUND", str(exc))
    except SlideCatalogError as exc:
        return error_response(500, "SLIDE_CATALOG_ERROR", str(exc))


@app.get("/api/slides/<path:course_id>")
def get_course_slides(course_id: str):
    try:
        return jsonify(build_course_deck(course_id))
    except CourseNotFound as exc:
        return error_response(404, "COURSE_NOT_FOUND", str(exc))
    except SlideCatalogError as exc:
        return error_response(500, "SLIDE_CATALOG_ERROR", str(exc))


@app.get("/api/slides/<path:course_id>/pages/<int:page_number>")
def get_course_slide_page(course_id: str, page_number: int):
    try:
        image_path = get_slide_page_path(course_id, page_number)
        return send_file(image_path, mimetype="image/webp")
    except InvalidSlidePage as exc:
        return error_response(400, "INVALID_SLIDE_PAGE", str(exc))
    except CourseNotFound as exc:
        return error_response(404, "COURSE_NOT_FOUND", str(exc))
    except SlideNotFound as exc:
        return error_response(404, "SLIDE_NOT_FOUND", str(exc))
    except SlideCatalogError as exc:
        return error_response(500, "SLIDE_CATALOG_ERROR", str(exc))


@app.get("/api/notes/<path:course_id>")
def get_course_note(course_id: str):
    try:
        resolved_course_id = resolve_existing_course_id(course_id)
    except CourseNotFound as exc:
        return error_response(404, "COURSE_NOT_FOUND", str(exc))
    except SlideCatalogError as exc:
        return error_response(500, "SLIDE_CATALOG_ERROR", str(exc))

    notes = read_notes_store()
    note = notes.get(resolved_course_id, {})

    return jsonify(
        {
            "courseId": course_id,
            "resolvedCourseId": resolved_course_id,
            "content": note.get("content", ""),
            "savedAt": note.get("savedAt"),
        }
    )


@app.post("/api/notes/<path:course_id>")
def save_course_note(course_id: str):
    payload = request.get_json(silent=True) or {}
    content = payload.get("content")

    if not isinstance(content, str):
        return error_response(
            400,
            "INVALID_NOTE_CONTENT",
            "Request body must include a string 'content' field.",
        )

    if len(content) > 200_000:
        return error_response(
            400,
            "INVALID_NOTE_CONTENT",
            "Note content is too large.",
        )

    try:
        resolved_course_id = resolve_existing_course_id(course_id)
    except CourseNotFound as exc:
        return error_response(404, "COURSE_NOT_FOUND", str(exc))
    except SlideCatalogError as exc:
        return error_response(500, "SLIDE_CATALOG_ERROR", str(exc))

    saved_at = utc_now_iso()
    notes = read_notes_store()
    notes[resolved_course_id] = {
        "content": content,
        "savedAt": saved_at,
    }
    write_notes_store(notes)

    return jsonify(
        {
            "success": True,
            "courseId": course_id,
            "resolvedCourseId": resolved_course_id,
            "savedAt": saved_at,
        }
    )


@app.get("/api/notebooks")
def list_notebooks():
    return jsonify({"notebooks": notebook_service.list_summaries()})


@app.post("/api/notebooks")
def create_notebook():
    notebook = notebook_service.create_notebook()
    return jsonify({"notebook": notebook})


@app.get("/api/notebooks/<notebook_id>")
def get_notebook(notebook_id: str):
    notebook = notebook_service.get_notebook(notebook_id)

    if not notebook:
        return error_response(404, "NOTEBOOK_NOT_FOUND", "Notebook not found.")

    return jsonify({"notebook": notebook})


@app.put("/api/notebooks/<notebook_id>")
def save_notebook(notebook_id: str):
    payload = request.get_json(silent=True) or {}
    content = payload.get("content")

    if not isinstance(content, str):
        return error_response(
            400,
            "INVALID_NOTEBOOK_CONTENT",
            "Request body must include a string 'content' field.",
        )

    try:
        result = notebook_service.save_notebook(
            notebook_id,
            content,
            force_title=bool(payload.get("forceTitle")),
        )
    except ValueError as exc:
        return error_response(400, "INVALID_NOTEBOOK_CONTENT", str(exc))

    if not result:
        return error_response(404, "NOTEBOOK_NOT_FOUND", "Notebook not found.")

    return jsonify(result)


@app.delete("/api/notebooks/<notebook_id>")
def delete_notebook(notebook_id: str):
    if not notebook_service.delete_notebook(notebook_id):
        return error_response(404, "NOTEBOOK_NOT_FOUND", "Notebook not found.")

    return jsonify({"success": True, "notebookId": notebook_id})


@app.get("/api/notebooks/<notebook_id>/export")
def export_notebook(notebook_id: str):
    notebook = notebook_service.get_notebook(notebook_id)

    if not notebook:
        return error_response(404, "NOTEBOOK_NOT_FOUND", "Notebook not found.")

    filename = notebook_service.export_filename(notebook)
    fallback_filename = ascii_download_filename(filename)
    encoded_filename = quote(filename, safe="")
    return Response(
        str(notebook.get("content") or ""),
        content_type="text/markdown; charset=utf-8",
        headers={
            "Content-Disposition": (
                f"attachment; filename=\"{fallback_filename}\"; "
                f"filename*=UTF-8''{encoded_filename}"
            ),
        },
    )


@app.get("/api/chat/conversations")
def list_chat_conversations():
    course_id = request.args.get("courseId", "")
    store = read_chat_store()
    conversations = list(store["conversations"].values())
    conversations.sort(
        key=lambda conversation: str(conversation.get("updatedAt") or conversation.get("createdAt") or ""),
        reverse=True,
    )
    conversations.sort(key=conversation_sort_key(course_id))

    return jsonify(
        {
            "conversations": [
                conversation_summary(conversation)
                for conversation in conversations
                if isinstance(conversation, dict)
            ]
        }
    )


@app.post("/api/chat/conversations")
def create_chat_conversation():
    payload = request.get_json(silent=True) or {}
    course_id = payload.get("courseId")

    if not isinstance(course_id, str) or not course_id.strip():
        return error_response(
            400,
            "INVALID_COURSE_ID",
            "Request body must include a string 'courseId' field.",
        )

    try:
        conversation = build_conversation_shell(course_id)
    except CourseNotFound as exc:
        return error_response(404, "COURSE_NOT_FOUND", str(exc))
    except SlideCatalogError as exc:
        return error_response(500, "SLIDE_CATALOG_ERROR", str(exc))

    course_name = conversation["courseName"]

    try:
        starter = asyncio.run(rag_service.generate_course_starter(course_id))
    except Exception:
        app.logger.exception("Failed to generate course starter")
        starter = (
            f"这节课是《{course_name}》，建议先浏览课件主线，再围绕核心概念、"
            "关键例子和实验任务做笔记。"
        )

    messages = [
        {
            "id": f"assistant-starter-{uuid4().hex[:10]}",
            "role": "assistant",
            "content": starter,
        }
    ]
    conversation["title"] = conversation_title(messages, f"{course_name} 学习建议")
    conversation["updatedAt"] = utc_now_iso()
    conversation["messages"] = messages

    store = read_chat_store()
    store["conversations"][conversation["id"]] = conversation
    write_chat_store(store)

    return jsonify({"conversation": conversation})


@app.post("/api/chat/conversations/stream")
def create_chat_conversation_stream():
    payload = request.get_json(silent=True) or {}
    course_id = payload.get("courseId")

    if not isinstance(course_id, str) or not course_id.strip():
        return error_response(
            400,
            "INVALID_COURSE_ID",
            "Request body must include a string 'courseId' field.",
        )

    try:
        conversation = build_conversation_shell(course_id)
    except CourseNotFound as exc:
        return error_response(404, "COURSE_NOT_FOUND", str(exc))
    except SlideCatalogError as exc:
        return error_response(500, "SLIDE_CATALOG_ERROR", str(exc))

    def generate():
        output_queue = queue.Queue(maxsize=100)
        worker = threading.Thread(
            target=consume_course_starter_stream,
            args=(course_id, conversation, output_queue),
            daemon=True,
        )
        worker.start()

        while True:
            chunk = output_queue.get()
            if chunk is None:
                break
            yield chunk

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


@app.get("/api/chat/conversations/<conversation_id>")
def get_chat_conversation(conversation_id: str):
    store = read_chat_store()
    conversation = store["conversations"].get(conversation_id)

    if not isinstance(conversation, dict):
        return error_response(404, "CONVERSATION_NOT_FOUND", "Conversation not found.")

    return jsonify({"conversation": conversation})


@app.put("/api/chat/conversations/<conversation_id>")
def update_chat_conversation(conversation_id: str):
    payload = request.get_json(silent=True) or {}
    messages = chat_messages_from_payload(payload.get("messages"))
    store = read_chat_store()
    conversation = store["conversations"].get(conversation_id)

    if not isinstance(conversation, dict):
        course_id = payload.get("courseId")
        if not isinstance(course_id, str) or not course_id.strip():
            return error_response(
                400,
                "INVALID_COURSE_ID",
                "Saving a new conversation requires a string 'courseId' field.",
            )

        try:
            conversation = build_conversation_shell(course_id, conversation_id=conversation_id)
        except CourseNotFound as exc:
            return error_response(404, "COURSE_NOT_FOUND", str(exc))
        except SlideCatalogError as exc:
            return error_response(500, "SLIDE_CATALOG_ERROR", str(exc))
        store["conversations"][conversation_id] = conversation

    conversation["messages"] = messages
    conversation["updatedAt"] = utc_now_iso()
    update_conversation_title(conversation, messages)
    write_chat_store(store)

    return jsonify({"conversation": conversation_summary(conversation)})


@app.delete("/api/chat/conversations/<conversation_id>")
def delete_chat_conversation(conversation_id: str):
    store = read_chat_store()

    if conversation_id not in store["conversations"]:
        return error_response(404, "CONVERSATION_NOT_FOUND", "Conversation not found.")

    del store["conversations"][conversation_id]
    write_chat_store(store)

    return jsonify({"success": True, "conversationId": conversation_id})


@app.post("/api/chat")
def chat():
    payload = request.get_json(silent=True) or {}

    def generate():
        output_queue = queue.Queue(maxsize=100)
        worker = threading.Thread(
            target=consume_rag_stream,
            args=(payload, output_queue),
            daemon=True,
        )
        worker.start()

        while True:
            chunk = output_queue.get()
            if chunk is None:
                break
            yield chunk

    return Response(
        stream_with_context(generate()),
        mimetype="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",
        },
    )


if __name__ == "__main__":
    host = os.getenv("FLASK_HOST", "127.0.0.1")
    port = int(os.getenv("FLASK_PORT", "5001"))
    debug = os.getenv("FLASK_DEBUG", "1").lower() in {"1", "true", "yes", "on"}

    app.run(host=host, port=port, debug=debug, use_reloader=False)
