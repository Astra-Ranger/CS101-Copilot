from __future__ import annotations

import asyncio
import json
import logging
import re
import threading
import time
from pathlib import Path
from typing import Any, Literal, Optional
from uuid import uuid4

from pydantic import BaseModel, Field, ValidationError, validator

from backend.baidu_digital_human_client import (
    BaiduDigitalHumanClient,
    BaiduDigitalHumanError,
)
from backend.digital_human_store import DigitalHumanLectureStore, utc_now_iso
from docker_1 import build_course_deck


logger = logging.getLogger(__name__)
CITATION_RE = re.compile(r"【([^】]+)】")
LECTURE_ID_RE = re.compile(r"^dh_[A-Za-z0-9_-]+$")
SAFE_MEDIA_NAME_RE = re.compile(r"^[A-Za-z0-9_.-]+$")
SENTENCE_BOUNDARY_RE = re.compile(r"[。！？!?；;\n]")


class DigitalHumanRequest(BaseModel):
    courseId: str = Field(default="demo-course")
    currentPage: int = Field(default=1, ge=1)
    mode: Literal["topic", "lesson"]
    topic: str = ""
    durationMinutes: int = Field(default=1, ge=1, le=5)
    conversationId: Optional[str] = None

    @validator("topic")
    def normalize_topic(cls, value: str) -> str:
        return str(value or "").strip()


class DigitalHumanService:
    def __init__(
        self,
        *,
        rag_service: Any,
        store_path: Path,
        media_root: Path,
        client: BaiduDigitalHumanClient | None = None,
    ) -> None:
        self.rag_service = rag_service
        self.store = DigitalHumanLectureStore(store_path)
        self.media_root = media_root
        self.client = client or BaiduDigitalHumanClient()

    def create_lecture(self, request_data: dict[str, Any]) -> dict[str, Any]:
        try:
            request = _model_validate(DigitalHumanRequest, request_data)
        except ValidationError as exc:
            raise ValueError(json.dumps(exc.errors(), ensure_ascii=False)) from exc

        if request.mode == "topic" and not request.topic:
            raise ValueError("知识点模式必须输入知识点。")

        self.client.config.validate()
        deck = build_course_deck(request.courseId)
        lecture_id = f"dh_{int(time.time() * 1000)}_{uuid4().hex[:8]}"
        now = utc_now_iso()
        lecture = {
            "id": lecture_id,
            "status": "queued",
            "courseId": str(deck.get("resolvedCourseId") or request.courseId),
            "courseName": str(deck.get("title") or request.courseId),
            "currentPage": request.currentPage,
            "mode": request.mode,
            "topic": request.topic,
            "durationMinutes": request.durationMinutes,
            "conversationId": request.conversationId or "",
            "displayScript": "",
            "spokenText": "",
            "citations": [],
            "citationAnchors": [],
            "slideTriggers": [],
            "baiduTaskId": "",
            "baiduStatus": "",
            "baiduVideoUrl": "",
            "baiduSubtitleFileUrl": "",
            "duration": None,
            "videoUrl": "",
            "subtitleUrl": "",
            "errorCode": "",
            "errorMessage": "",
            "createdAt": now,
            "updatedAt": now,
        }
        self.store.create(lecture)

        worker = threading.Thread(
            target=self._run_lecture,
            args=(lecture_id,),
            daemon=True,
        )
        worker.start()
        return self.public_lecture(lecture)

    def get_lecture(self, lecture_id: str) -> dict[str, Any] | None:
        lecture = self.store.get(lecture_id)
        return self.public_lecture(lecture) if lecture else None

    def list_lectures(self, course_id: str | None = None) -> list[dict[str, Any]]:
        return [
            self.public_lecture(lecture)
            for lecture in self.store.list(course_id=course_id)
            if str(lecture.get("status") or "") != "failed"
        ]

    def media_path(self, lecture_id: str, filename: str) -> Path:
        if not LECTURE_ID_RE.match(lecture_id):
            raise ValueError("Invalid lecture id.")
        if not SAFE_MEDIA_NAME_RE.match(filename):
            raise ValueError("Invalid media filename.")

        path = (self.media_root / lecture_id / filename).resolve()
        media_root = self.media_root.resolve()
        if media_root not in path.parents:
            raise ValueError("Invalid media path.")
        return path

    def public_lecture(self, lecture: dict[str, Any]) -> dict[str, Any]:
        allowed = {
            "id",
            "status",
            "courseId",
            "courseName",
            "currentPage",
            "mode",
            "topic",
            "durationMinutes",
            "conversationId",
            "displayScript",
            "citations",
            "slideTriggers",
            "baiduTaskId",
            "baiduStatus",
            "duration",
            "videoUrl",
            "subtitleUrl",
            "errorCode",
            "errorMessage",
            "createdAt",
            "updatedAt",
        }
        return {key: lecture.get(key) for key in allowed if key in lecture}

    def _run_lecture(self, lecture_id: str) -> None:
        lecture = self.store.get(lecture_id)
        if not lecture:
            return

        try:
            self.client.config.validate()
            self.store.update(lecture_id, {"status": "scripting"})
            script_result = asyncio.run(
                self.rag_service.generate_digital_human_script(
                    course_id=str(lecture.get("courseId") or "demo-course"),
                    current_page=int(lecture.get("currentPage") or 1),
                    mode=str(lecture.get("mode") or "lesson"),
                    topic=str(lecture.get("topic") or ""),
                    duration_minutes=int(lecture.get("durationMinutes") or 1),
                )
            )
            display_script = normalize_digital_human_citations(
                str(script_result.get("displayScript") or "").strip(),
                script_result.get("citations") or [],
            )
            spoken_result = spoken_text_and_anchors(display_script, str(lecture.get("courseId") or ""))
            self.store.update(
                lecture_id,
                {
                    "displayScript": display_script,
                    "spokenText": spoken_result["spokenText"],
                    "citationAnchors": spoken_result["anchors"],
                    "citations": script_result.get("citations") or [],
                },
            )

            self.store.update(lecture_id, {"status": "submitted"})
            submit_result = self.client.submit_text_video(spoken_result["spokenText"])
            task_id = submit_result["taskId"]
            self.store.update(
                lecture_id,
                {
                    "baiduTaskId": task_id,
                    "status": "rendering",
                    "baiduStatus": "SUBMIT",
                },
            )

            query_result = self._wait_for_baidu_video(lecture_id, task_id)
            self.store.update(
                lecture_id,
                {
                    "status": "downloading",
                    "baiduStatus": query_result["status"],
                    "baiduVideoUrl": query_result["videoUrl"],
                    "baiduSubtitleFileUrl": query_result["subtitleFileUrl"],
                    "duration": query_result.get("duration"),
                },
            )
            self._download_and_finish(lecture_id, query_result)
        except Exception as exc:
            logger.exception("Digital human lecture failed: %s", exc)
            self.store.update(
                lecture_id,
                {
                    "status": "failed",
                    "errorCode": str(getattr(exc, "code", "") or "DIGITAL_HUMAN_FAILED"),
                    "errorMessage": str(exc) or "数字人讲解生成失败。",
                },
            )

    def _wait_for_baidu_video(self, lecture_id: str, task_id: str) -> dict[str, Any]:
        start = time.monotonic()
        while True:
            result = self.client.query_video(task_id)
            status = str(result.get("status") or "UNKNOWN").upper()
            self.store.update(
                lecture_id,
                {
                    "status": "rendering",
                    "baiduStatus": status,
                    "errorCode": result.get("errorCode") or "",
                    "errorMessage": result.get("errorMessage") or "",
                },
            )

            if status in {"SUCCESS", "SUCCEED", "DONE", "COMPLETED"} and result.get("videoUrl"):
                if result.get("subtitleFileUrl"):
                    return result
                self.store.update(
                    lecture_id,
                    {
                        "baiduStatus": "SUCCESS_WAITING_SUBTITLE",
                        "errorMessage": "百度已返回视频，正在等待字幕文件。",
                    },
                )

            if status in {"FAILED", "FAIL", "ERROR"}:
                message = result.get("errorMessage") or "百度数字人视频生成失败。"
                raise BaiduDigitalHumanError(str(message), code=str(result.get("errorCode") or "BAIDU_DH_FAILED"))

            if time.monotonic() - start > self.client.config.max_wait_seconds:
                raise BaiduDigitalHumanError("百度数字人视频生成超时。", code="BAIDU_DH_TIMEOUT")

            time.sleep(self.client.config.poll_interval_seconds)

    def _download_and_finish(self, lecture_id: str, query_result: dict[str, Any]) -> None:
        lecture = self.store.get(lecture_id) or {}
        media_dir = self.media_root / lecture_id
        video_path = media_dir / "lecture.mp4"
        self.client.download_file(str(query_result.get("videoUrl") or ""), video_path)

        subtitle_url = str(query_result.get("subtitleFileUrl") or "")
        subtitle_public_url = ""
        subtitle_path = None
        subtitle_track_path = None
        subtitle_error = ""
        if subtitle_url:
            subtitle_ext = self.client.subtitle_extension(subtitle_url)
            subtitle_path = media_dir / f"subtitle{subtitle_ext}"
            try:
                self.client.download_file(subtitle_url, subtitle_path)
                subtitle_track_path = webvtt_subtitle_path(subtitle_path)
                if subtitle_track_path:
                    subtitle_public_url = f"/api/digital-human/media/{lecture_id}/{subtitle_track_path.name}"
            except Exception as exc:
                logger.exception("Digital human subtitle download failed: %s", exc)
                subtitle_path = None
                subtitle_error = str(exc) or "字幕下载失败。"

        duration_seconds = _duration_to_seconds(query_result.get("duration"))
        slide_triggers = build_slide_triggers(
            spoken_text=str(lecture.get("spokenText") or ""),
            anchors=lecture.get("citationAnchors") or [],
            subtitle_path=subtitle_path or subtitle_track_path,
            fallback_duration_seconds=duration_seconds,
        )

        self.store.update(
            lecture_id,
            {
                "status": "ready",
                "videoUrl": f"/api/digital-human/media/{lecture_id}/lecture.mp4",
                "subtitleUrl": subtitle_public_url,
                "slideTriggers": slide_triggers,
                "errorCode": "DIGITAL_HUMAN_SUBTITLE_DOWNLOAD_FAILED" if subtitle_error else "",
                "errorMessage": f"字幕下载失败，视频已保存：{subtitle_error}" if subtitle_error else "",
                "completedAt": utc_now_iso(),
            },
        )


def webvtt_subtitle_path(subtitle_path: Path) -> Path | None:
    suffix = subtitle_path.suffix.lower()
    if suffix == ".vtt":
        return subtitle_path
    if suffix != ".srt":
        return None

    vtt_path = subtitle_path.with_suffix(".vtt")
    text = subtitle_path.read_text(encoding="utf-8-sig", errors="ignore")
    vtt_path.write_text(srt_to_webvtt(text), encoding="utf-8")
    return vtt_path


def srt_to_webvtt(text: str) -> str:
    body = str(text or "").replace("\r\n", "\n").replace("\r", "\n").strip()
    if body.startswith("WEBVTT"):
        return f"{body}\n"

    body = re.sub(r"(\d{2}:\d{2}:\d{2}),(\d{1,3})", lambda match: f"{match.group(1)}.{match.group(2).ljust(3, '0')[:3]}", body)
    return f"WEBVTT\n\n{body}\n"


def normalize_digital_human_citations(text: str, citations: list[Any] | None = None) -> str:
    allowed_labels = citation_labels(citations or [])
    return move_trailing_citations_to_sentence_start(text, allowed_labels).strip()


def citation_labels(citations: list[Any]) -> list[str]:
    labels: list[str] = []
    for citation in citations:
        if isinstance(citation, dict):
            label = citation.get("label")
        else:
            label = getattr(citation, "label", None)
        text = str(label or "").strip()
        if text and text not in labels:
            labels.append(text)
    return labels


def move_trailing_citations_to_sentence_start(
    text: str,
    allowed_labels: list[str] | None = None,
) -> str:
    value = str(text or "")
    if not value.strip():
        return value

    rebuilt: list[str] = []
    pending_labels: list[str] = []
    allowed = set(allowed_labels or [])

    for segment in split_sentence_segments(value):
        if not segment.strip():
            continue

        labels = [
            match.group(0)
            for match in CITATION_RE.finditer(segment)
            if not allowed or match.group(0) in allowed
        ]
        segment_without_citations = CITATION_RE.sub("", segment).strip()
        if not segment_without_citations:
            if labels and rebuilt:
                rebuilt[-1] = "".join(unique_labels(labels)) + rebuilt[-1]
            else:
                pending_labels.extend(labels)
            continue

        next_labels = unique_labels([*pending_labels, *labels])
        rebuilt.append(f"{''.join(next_labels)}{segment_without_citations}")
        pending_labels = []

    if pending_labels and rebuilt:
        rebuilt[-1] = "".join(unique_labels(pending_labels)) + rebuilt[-1]

    return "".join(rebuilt)


def split_sentence_segments(value: str) -> list[str]:
    segments: list[str] = []
    start = 0
    for index, char in enumerate(value):
        if SENTENCE_BOUNDARY_RE.match(char):
            segments.append(value[start : index + 1])
            start = index + 1
    if start < len(value):
        segments.append(value[start:])
    return segments


def unique_labels(labels: list[str]) -> list[str]:
    unique: list[str] = []
    for label in labels:
        if label and label not in unique:
            unique.append(label)
    return unique


def spoken_text_and_anchors(display_script: str, current_course_id: str) -> dict[str, Any]:
    raw_anchors: list[dict[str, Any]] = []

    for match in CITATION_RE.finditer(display_script):
        target = parse_citation_target(match.group(1), current_course_id)
        if target:
            raw_prefix = CITATION_RE.sub("", display_script[: match.start()])
            raw_anchors.append(
                {
                    "rawOffset": sentence_start_offset(raw_prefix),
                    "courseId": target["courseId"],
                    "page": target["page"],
                    "label": match.group(0),
                }
            )

    raw_text = CITATION_RE.sub("", display_script)
    normalized = normalize_spoken_text_with_anchors(raw_text, raw_anchors)
    return {
        "spokenText": normalized["text"],
        "anchors": normalized["anchors"],
    }


def sentence_start_offset(raw_prefix: str) -> int:
    prefix = str(raw_prefix or "")
    trimmed_length = len(prefix.rstrip())
    if trimmed_length <= 0:
        return 0

    boundary_index = -1
    for match in SENTENCE_BOUNDARY_RE.finditer(prefix[:trimmed_length]):
        boundary_index = match.end()

    while boundary_index < len(prefix) and boundary_index >= 0 and prefix[boundary_index].isspace():
        boundary_index += 1

    return max(0, boundary_index)


def parse_citation_target(raw_label: str, current_course_id: str) -> dict[str, Any] | None:
    label = str(raw_label or "").strip()
    current_match = re.match(r"^P\s*(\d+)$", label, flags=re.IGNORECASE)
    if current_match:
        return {"courseId": current_course_id, "page": int(current_match.group(1))}

    cross_match = re.match(r"^(.+)-\s*(\d+)$", label)
    if not cross_match:
        return None

    return {"courseId": cross_match.group(1).strip(), "page": int(cross_match.group(2))}


def normalize_spoken_text_with_anchors(text: str, anchors: list[dict[str, Any]]) -> dict[str, Any]:
    anchors_by_offset: dict[int, list[dict[str, Any]]] = {}
    for anchor in anchors:
        anchors_by_offset.setdefault(int(anchor.get("rawOffset") or 0), []).append(anchor)

    result: list[str] = []
    normalized_anchors: list[dict[str, Any]] = []
    previous_space = True

    for index, char in enumerate(text):
        for anchor in anchors_by_offset.pop(index, []):
            next_anchor = dict(anchor)
            next_anchor.pop("rawOffset", None)
            next_anchor["offset"] = len(result)
            normalized_anchors.append(next_anchor)

        if char.isspace():
            if not previous_space and result:
                result.append(" ")
            previous_space = True
            continue

        result.append(char)
        previous_space = False

    for anchor_group in anchors_by_offset.values():
        for anchor in anchor_group:
            next_anchor = dict(anchor)
            next_anchor.pop("rawOffset", None)
            next_anchor["offset"] = len(result)
            normalized_anchors.append(next_anchor)

    return {
        "text": "".join(result).strip(),
        "anchors": normalized_anchors,
    }


def build_slide_triggers(
    *,
    spoken_text: str,
    anchors: list[dict[str, Any]],
    subtitle_path: Path | None,
    fallback_duration_seconds: float | None,
) -> list[dict[str, Any]]:
    segments = subtitle_segments(subtitle_path) if subtitle_path else []
    if not anchors:
        return []
    if not segments and not fallback_duration_seconds:
        return []

    triggers: list[dict[str, Any]] = []
    text_length = max(1, len(spoken_text))
    for anchor in anchors:
        offset = max(0, int(anchor.get("offset") or 0))
        time_ms = time_for_offset(offset, segments)
        if time_ms is None and fallback_duration_seconds:
            time_ms = int((offset / text_length) * fallback_duration_seconds * 1000)
        if time_ms is None:
            time_ms = 0

        triggers.append(
            {
                "timeMs": time_ms,
                "courseId": anchor.get("courseId"),
                "page": anchor.get("page"),
                "label": anchor.get("label"),
            }
        )

    return dedupe_slide_triggers(triggers)


def subtitle_segments(path: Path | None) -> list[dict[str, Any]]:
    if not path or not path.exists():
        return []

    try:
        text = path.read_text(encoding="utf-8")
    except UnicodeDecodeError:
        text = path.read_text(encoding="utf-8-sig", errors="ignore")
    except OSError:
        return []

    stripped = text.strip()
    if not stripped:
        return []

    if stripped[0] in "[{":
        try:
            data = json.loads(stripped)
        except json.JSONDecodeError:
            data = None
        segments = json_subtitle_segments(data)
        if segments:
            return segments

    return srt_subtitle_segments(stripped)


def json_subtitle_segments(data: Any) -> list[dict[str, Any]]:
    segments: list[dict[str, Any]] = []

    def visit(value: Any) -> None:
        if isinstance(value, dict):
            text = value.get("text") or value.get("word") or value.get("content") or value.get("sentence")
            start = first_present(value, ["start", "startTime", "start_time", "begin", "beginTime", "bg"])
            end = first_present(value, ["end", "endTime", "end_time", "finish", "ed"])
            if text is not None and start is not None:
                segments.append(
                    {
                        "text": normalize_subtitle_text(str(text)),
                        "startMs": parse_time_ms(start) or 0,
                        "endMs": parse_time_ms(end) if end is not None else None,
                    }
                )
            for item in value.values():
                visit(item)
        elif isinstance(value, list):
            for item in value:
                visit(item)

    visit(data)
    return [segment for segment in segments if segment["text"]]


def srt_subtitle_segments(text: str) -> list[dict[str, Any]]:
    segments: list[dict[str, Any]] = []
    blocks = re.split(r"\n\s*\n", text)
    for block in blocks:
        lines = [line.strip() for line in block.splitlines() if line.strip()]
        time_line = next((line for line in lines if "-->" in line), "")
        if not time_line:
            continue
        start_text, end_text = [part.strip() for part in time_line.split("-->", 1)]
        body_lines = [line for line in lines if line != time_line and not line.isdigit()]
        body = normalize_subtitle_text("".join(body_lines))
        if not body:
            continue
        segments.append(
            {
                "text": body,
                "startMs": parse_time_ms(start_text) or 0,
                "endMs": parse_time_ms(end_text),
            }
        )
    return segments


def time_for_offset(offset: int, segments: list[dict[str, Any]]) -> int | None:
    if not segments:
        return None

    cursor = 0
    for segment in segments:
        text = segment.get("text") or ""
        length = len(text)
        if offset < cursor + length:
            return int(segment.get("startMs") or 0)
        cursor += length

    return int(segments[-1].get("startMs") or 0)


def dedupe_slide_triggers(triggers: list[dict[str, Any]]) -> list[dict[str, Any]]:
    deduped: list[dict[str, Any]] = []
    seen: set[tuple[str, int, int]] = set()
    for trigger in sorted(triggers, key=lambda item: int(item.get("timeMs") or 0)):
        course_id = str(trigger.get("courseId") or "")
        page = int(trigger.get("page") or 0)
        bucket = int(trigger.get("timeMs") or 0) // 1500
        key = (course_id, page, bucket)
        if page <= 0 or key in seen:
            continue
        seen.add(key)
        deduped.append(trigger)
    return deduped


def normalize_subtitle_text(value: str) -> str:
    return re.sub(r"\s+", "", value or "")


def parse_time_ms(value: Any) -> int | None:
    if isinstance(value, (int, float)):
        number = float(value)
        return int(number if number > 1000 else number * 1000)

    text = str(value or "").strip()
    if not text:
        return None

    time_match = re.match(r"(?:(\d+):)?(\d{1,2}):(\d{1,2})(?:[,.](\d{1,3}))?$", text)
    if time_match:
        hours = int(time_match.group(1) or 0)
        minutes = int(time_match.group(2) or 0)
        seconds = int(time_match.group(3) or 0)
        millis = int((time_match.group(4) or "0").ljust(3, "0")[:3])
        return ((hours * 60 + minutes) * 60 + seconds) * 1000 + millis

    try:
        number = float(text)
    except ValueError:
        return None

    return int(number if number > 1000 else number * 1000)


def first_present(data: dict[str, Any], keys: list[str]) -> Any:
    for key in keys:
        if key in data:
            return data[key]
    return None


def _duration_to_seconds(value: Any) -> float | None:
    milliseconds = parse_time_ms(value)
    return milliseconds / 1000 if milliseconds is not None else None


def _model_validate(model_cls: type[BaseModel], data: Any) -> Any:
    if hasattr(model_cls, "model_validate"):
        return model_cls.model_validate(data)
    return model_cls.parse_obj(data)
