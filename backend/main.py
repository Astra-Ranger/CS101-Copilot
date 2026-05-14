import os
from pathlib import Path

from dotenv import load_dotenv
from flask import Flask, jsonify, request, send_from_directory

load_dotenv()

REPO_ROOT = Path(__file__).resolve().parents[1]
FRONTEND_DIR = REPO_ROOT / "frontend"

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
    return not_implemented("GET /api/courses")


@app.get("/api/slides/<course_id>")
def get_course_slides(course_id: str):
    return not_implemented(f"GET /api/slides/{course_id}")


@app.get("/api/slides/<course_id>/pages/<int:page_number>")
def get_course_slide_page(course_id: str, page_number: int):
    return not_implemented(f"GET /api/slides/{course_id}/pages/{page_number}")


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

    app.run(host=host, port=port, debug=debug)
