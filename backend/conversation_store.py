import json
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4

from docker_1 import CourseNotFound, SlideCatalogError, build_course_deck


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def read_json_store(path: Path, default):
    if not path.exists():
        return default

    try:
        with path.open("r", encoding="utf-8") as file:
            data = json.load(file)
    except (OSError, json.JSONDecodeError):
        return default

    return data


def write_json_store(path: Path, data) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)

    with path.open("w", encoding="utf-8") as file:
        json.dump(data, file, ensure_ascii=False, indent=2)
        file.write("\n")


def read_notes_store(path: Path) -> dict:
    data = read_json_store(path, {})
    return data if isinstance(data, dict) else {}


def write_notes_store(path: Path, notes: dict) -> None:
    write_json_store(path, notes)


def read_chat_store(path: Path) -> dict:
    data = read_json_store(path, {"conversations": {}})
    conversations = data.get("conversations") if isinstance(data, dict) else None
    if not isinstance(conversations, dict):
        return {"conversations": {}}
    return {"conversations": conversations}


def write_chat_store(path: Path, store: dict) -> None:
    write_json_store(path, store)


def resolve_existing_course_id(course_id: str) -> str:
    deck = build_course_deck(course_id)
    return deck["resolvedCourseId"]


def chat_message_from_payload(message):
    if not isinstance(message, dict):
        return None

    role = message.get("role")
    content = message.get("content")

    if role not in {"user", "assistant", "system"} or not isinstance(content, str):
        return None

    cleaned = {
        "id": str(message.get("id") or f"{role}-{uuid4().hex[:10]}"),
        "role": role,
        "content": content,
    }

    citations = message.get("citations")
    if isinstance(citations, list):
        cleaned["citations"] = citations

    return cleaned


def chat_messages_from_payload(messages):
    if not isinstance(messages, list):
        return []

    cleaned_messages = []
    for message in messages:
        cleaned = chat_message_from_payload(message)
        if cleaned:
            cleaned_messages.append(cleaned)

    return cleaned_messages


def conversation_title(messages, fallback):
    for role in ("user", "assistant"):
        for message in messages:
            if message.get("role") != role:
                continue

            content = " ".join(str(message.get("content") or "").split())
            if content:
                return content[:24]

    return fallback


def first_user_message(messages):
    for message in messages:
        if message.get("role") == "user" and str(message.get("content") or "").strip():
            return message

    return None


def conversation_summary(conversation):
    return {
        "id": conversation.get("id"),
        "courseId": conversation.get("courseId"),
        "courseName": conversation.get("courseName"),
        "title": conversation.get("title"),
        "createdAt": conversation.get("createdAt"),
        "updatedAt": conversation.get("updatedAt"),
        "messageCount": len(conversation.get("messages") or []),
    }


def conversation_sort_key(current_course_id):
    current_resolved = None
    if current_course_id:
        try:
            current_resolved = resolve_existing_course_id(current_course_id)
        except (CourseNotFound, SlideCatalogError):
            current_resolved = current_course_id

    def key(conversation):
        course_id = conversation.get("courseId") or ""
        try:
            resolved_course_id = resolve_existing_course_id(course_id)
        except (CourseNotFound, SlideCatalogError):
            resolved_course_id = course_id

        return 1 if current_resolved and resolved_course_id != current_resolved else 0

    return key


def build_conversation_shell(course_id: str, conversation_id=None):
    deck = build_course_deck(course_id)
    now = utc_now_iso()
    course_name = deck.get("title") or course_id

    return {
        "id": conversation_id or f"chat_{int(datetime.now(timezone.utc).timestamp() * 1000)}_{uuid4().hex[:6]}",
        "courseId": deck.get("resolvedCourseId") or course_id,
        "courseName": course_name,
        "title": f"{course_name} 学习建议",
        "createdAt": now,
        "updatedAt": now,
        "messages": [],
    }
