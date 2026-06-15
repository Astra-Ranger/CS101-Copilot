from __future__ import annotations

import json
import threading
from datetime import datetime, timezone
from pathlib import Path
from typing import Any


def utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


class DigitalHumanLectureStore:
    def __init__(self, path: Path) -> None:
        self.path = path
        self._lock = threading.RLock()

    def create(self, lecture: dict[str, Any]) -> dict[str, Any]:
        with self._lock:
            store = self._read()
            store["lectures"][lecture["id"]] = lecture
            self._write(store)
        return lecture

    def get(self, lecture_id: str) -> dict[str, Any] | None:
        with self._lock:
            lecture = self._read()["lectures"].get(lecture_id)
        return dict(lecture) if isinstance(lecture, dict) else None

    def list(self, course_id: str | None = None) -> list[dict[str, Any]]:
        with self._lock:
            lectures = list(self._read()["lectures"].values())

        if course_id:
            lectures = [
                lecture
                for lecture in lectures
                if str(lecture.get("courseId") or "") == course_id
            ]

        lectures.sort(
            key=lambda item: str(item.get("updatedAt") or item.get("createdAt") or ""),
            reverse=True,
        )
        return [dict(lecture) for lecture in lectures if isinstance(lecture, dict)]

    def update(self, lecture_id: str, updates: dict[str, Any]) -> dict[str, Any] | None:
        with self._lock:
            store = self._read()
            lecture = store["lectures"].get(lecture_id)
            if not isinstance(lecture, dict):
                return None

            lecture.update(updates)
            lecture["updatedAt"] = utc_now_iso()
            store["lectures"][lecture_id] = lecture
            self._write(store)
            return dict(lecture)

    def delete(self, lecture_id: str) -> bool:
        with self._lock:
            store = self._read()
            if lecture_id not in store["lectures"]:
                return False

            del store["lectures"][lecture_id]
            self._write(store)
            return True

    def _read(self) -> dict[str, Any]:
        if not self.path.exists():
            return {"lectures": {}}

        try:
            with self.path.open("r", encoding="utf-8") as file:
                data = json.load(file)
        except (OSError, json.JSONDecodeError):
            return {"lectures": {}}

        lectures = data.get("lectures") if isinstance(data, dict) else None
        return {"lectures": lectures if isinstance(lectures, dict) else {}}

    def _write(self, data: dict[str, Any]) -> None:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        with self.path.open("w", encoding="utf-8") as file:
            json.dump(data, file, ensure_ascii=False, indent=2)
            file.write("\n")
