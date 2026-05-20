import os
import sys
import json
from pathlib import Path
from datetime import datetime, timezone

from flask import Flask, jsonify, request, send_file, send_from_directory

try:
    from dotenv import load_dotenv
except ModuleNotFoundError:
    def load_dotenv():
        return False


load_dotenv()

REPO_ROOT = Path(__file__).resolve().parents[1]
FRONTEND_DIR = REPO_ROOT / "frontend"
NOTES_PATH = Path(os.getenv("COURSE_NOTES_PATH", REPO_ROOT / "backend" / "user_notes.json"))

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

app = Flask(__name__, static_folder=str(FRONTEND_DIR), static_url_path="")


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


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def read_notes_store():
    if not NOTES_PATH.exists():
        return {}

    try:
        with NOTES_PATH.open("r", encoding="utf-8") as file:
            data = json.load(file)
    except (OSError, json.JSONDecodeError):
        return {}

    return data if isinstance(data, dict) else {}


def write_notes_store(notes):
    NOTES_PATH.parent.mkdir(parents=True, exist_ok=True)

    with NOTES_PATH.open("w", encoding="utf-8") as file:
        json.dump(notes, file, ensure_ascii=False, indent=2)
        file.write("\n")


def resolve_existing_course_id(course_id: str) -> str:
    deck = build_course_deck(course_id)
    return deck["resolvedCourseId"]


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


@app.post("/api/chat")
def chat():
    request.get_json(silent=True)
    return not_implemented("POST /api/chat")


if __name__ == "__main__":
    host = os.getenv("FLASK_HOST", "127.0.0.1")
    port = int(os.getenv("FLASK_PORT", "5001"))
    debug = os.getenv("FLASK_DEBUG", "1").lower() in {"1", "true", "yes", "on"}

    app.run(host=host, port=port, debug=debug, use_reloader=False)
