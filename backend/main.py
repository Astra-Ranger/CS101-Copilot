import os
import sys
from pathlib import Path

from flask import Flask, jsonify, request, send_file, send_from_directory

try:
    from dotenv import load_dotenv
except ModuleNotFoundError:
    def load_dotenv():
        return False


load_dotenv()

REPO_ROOT = Path(__file__).resolve().parents[1]
FRONTEND_DIR = REPO_ROOT / "frontend"

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


@app.post("/api/notes/<course_id>")
def save_course_note(course_id: str):
    request.get_json(silent=True)
    return not_implemented(f"POST /api/notes/{course_id}")


@app.post("/api/chat")
def chat():
    request.get_json(silent=True)
    return not_implemented("POST /api/chat")


if __name__ == "__main__":
    host = os.getenv("FLASK_HOST", "127.0.0.1")
    port = int(os.getenv("FLASK_PORT", "5001"))
    debug = os.getenv("FLASK_DEBUG", "1").lower() in {"1", "true", "yes", "on"}

    app.run(host=host, port=port, debug=debug, use_reloader=False)
