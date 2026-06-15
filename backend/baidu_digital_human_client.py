from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path
from typing import Any
from urllib.parse import urlparse

import httpx


class BaiduDigitalHumanError(RuntimeError):
    def __init__(self, message: str, code: str = "BAIDU_DH_ERROR") -> None:
        super().__init__(message)
        self.code = code


@dataclass(frozen=True)
class BaiduDigitalHumanConfig:
    authorization: str
    base_url: str
    figure_id: int
    tts_person: str
    tts_speed: int
    tts_volume: int
    tts_pitch: int
    background_image_url: str
    video_width: int
    video_height: int
    poll_interval_seconds: int
    max_wait_seconds: int

    @classmethod
    def from_env(cls) -> "BaiduDigitalHumanConfig":
        return cls(
            authorization=str(os.getenv("BAIDU_DH_AUTHORIZATION") or "").strip(),
            base_url=str(os.getenv("BAIDU_DH_BASE_URL") or "https://open.xiling.baidu.com").rstrip("/"),
            figure_id=_env_int("BAIDU_DH_FIGURE_ID", 2646047),
            tts_person=str(os.getenv("BAIDU_DH_TTS_PERSON") or "5132").strip(),
            tts_speed=_env_int("BAIDU_DH_TTS_SPEED", 5),
            tts_volume=_env_int("BAIDU_DH_TTS_VOLUME", 5),
            tts_pitch=_env_int("BAIDU_DH_TTS_PITCH", 5),
            background_image_url=str(os.getenv("BAIDU_DH_BACKGROUND_IMAGE_URL") or "").strip(),
            video_width=_env_int("BAIDU_DH_VIDEO_WIDTH", 1280),
            video_height=_env_int("BAIDU_DH_VIDEO_HEIGHT", 720),
            poll_interval_seconds=max(2, _env_int("BAIDU_DH_POLL_INTERVAL_SECONDS", 10)),
            max_wait_seconds=max(60, _env_int("BAIDU_DH_MAX_WAIT_SECONDS", 1800)),
        )

    def validate(self) -> None:
        if not self.authorization:
            raise BaiduDigitalHumanError(
                "BAIDU_DH_AUTHORIZATION is not configured.",
                code="BAIDU_DH_AUTH_MISSING",
            )

        if not self.background_image_url:
            raise BaiduDigitalHumanError(
                "BAIDU_DH_BACKGROUND_IMAGE_URL is not configured.",
                code="BAIDU_DH_BACKGROUND_MISSING",
            )


class BaiduDigitalHumanClient:
    def __init__(self, config: BaiduDigitalHumanConfig | None = None) -> None:
        self.config = config or BaiduDigitalHumanConfig.from_env()

    def submit_text_video(self, text: str) -> dict[str, Any]:
        self.config.validate()
        payload = {
            "figureId": self.config.figure_id,
            "driveType": "TEXT",
            "text": text,
            "ttsParams": {
                "person": self.config.tts_person,
                "speed": self.config.tts_speed,
                "volume": self.config.tts_volume,
                "pitch": self.config.tts_pitch,
            },
            "backgroundImageUrl": self.config.background_image_url,
            "videoParams": {
                "width": self.config.video_width,
                "height": self.config.video_height,
                "transparent": False,
            },
            "dhParams": {
                "positionV2": {
                    "location": {
                        "top": 0,
                        "left": 0,
                        "width": self.config.video_width,
                        "height": self.config.video_height,
                    }
                }
            },
            "subtitleParams": {
                "enabled": True,
                "subtitlePolicy": "SRT",
            },
            "callbackUrl": "",
        }

        with httpx.Client(timeout=60) as client:
            response = client.post(
                f"{self.config.base_url}/api/digitalhuman/open/v1/video/submit",
                headers=self._headers(),
                json=payload,
            )
        return self._parse_submit_response(self._response_json(response))

    def query_video(self, task_id: str) -> dict[str, Any]:
        self.config.validate()
        with httpx.Client(timeout=60) as client:
            response = client.get(
                f"{self.config.base_url}/api/digitalhuman/open/v1/video/task",
                headers=self._headers(),
                params={"taskId": task_id},
            )
        return self._parse_query_response(self._response_json(response))

    def download_file(self, url: str, output_path: Path) -> None:
        if not url:
            raise BaiduDigitalHumanError("Download URL is empty.", code="BAIDU_DH_DOWNLOAD_URL_EMPTY")

        output_path.parent.mkdir(parents=True, exist_ok=True)
        tmp_path = output_path.with_suffix(f"{output_path.suffix}.tmp")

        try:
            with httpx.Client(timeout=None, follow_redirects=True) as client:
                with client.stream("GET", url) as response:
                    response.raise_for_status()
                    with tmp_path.open("wb") as file:
                        for chunk in response.iter_bytes():
                            if chunk:
                                file.write(chunk)
        except Exception:
            tmp_path.unlink(missing_ok=True)
            raise

        tmp_path.replace(output_path)

    def subtitle_extension(self, url: str) -> str:
        suffix = Path(urlparse(url).path).suffix.lower()
        return suffix if suffix in {".srt", ".json", ".txt", ".vtt"} else ".srt"

    def _headers(self) -> dict[str, str]:
        return {
            "Authorization": self.config.authorization,
            "Content-Type": "application/json",
        }

    def _response_json(self, response: httpx.Response) -> dict[str, Any]:
        try:
            response.raise_for_status()
            data = response.json()
        except httpx.HTTPStatusError as exc:
            raise BaiduDigitalHumanError(
                f"Baidu digital human HTTP error: {exc.response.status_code}",
                code="BAIDU_DH_HTTP_ERROR",
            ) from exc
        except ValueError as exc:
            raise BaiduDigitalHumanError(
                "Baidu digital human response is not valid JSON.",
                code="BAIDU_DH_INVALID_JSON",
            ) from exc

        if not isinstance(data, dict):
            raise BaiduDigitalHumanError(
                "Baidu digital human response must be a JSON object.",
                code="BAIDU_DH_INVALID_RESPONSE",
            )

        code = data.get("code")
        success = code in {None, 0, "0", "SUCCESS", "success"}
        if not success:
            message = str(data.get("message") or data.get("msg") or "Baidu digital human request failed.")
            raise BaiduDigitalHumanError(message, code=str(code or "BAIDU_DH_API_ERROR"))

        return data

    def _parse_submit_response(self, data: dict[str, Any]) -> dict[str, Any]:
        payload = self._result_payload(data)
        task_id = payload.get("taskId") or payload.get("taskID") or payload.get("id")

        if not task_id:
            raise BaiduDigitalHumanError(
                "Baidu digital human submit response did not include taskId.",
                code="BAIDU_DH_TASK_ID_MISSING",
            )

        return {
            "taskId": str(task_id),
            "raw": data,
        }

    def _parse_query_response(self, data: dict[str, Any]) -> dict[str, Any]:
        payload = self._result_payload(data)
        status = str(
            payload.get("status")
            or payload.get("taskStatus")
            or payload.get("state")
            or ""
        ).upper()
        video_url = payload.get("videoUrl") or payload.get("resultUrl") or payload.get("url")
        subtitle_url = payload.get("subtitleFileUrl") or payload.get("subtitleUrl")

        if not status and video_url:
            status = "SUCCESS"

        return {
            "status": status or "UNKNOWN",
            "videoUrl": str(video_url or ""),
            "subtitleFileUrl": str(subtitle_url or ""),
            "duration": payload.get("duration"),
            "errorCode": str(payload.get("errorCode") or payload.get("failedCode") or payload.get("code") or ""),
            "errorMessage": str(payload.get("errorMessage") or payload.get("failedMessage") or payload.get("message") or ""),
            "raw": data,
        }

    def _result_payload(self, data: dict[str, Any]) -> dict[str, Any]:
        for key in ("result", "data"):
            payload = data.get(key)
            if isinstance(payload, dict):
                return payload
        return data


def _env_int(name: str, default: int) -> int:
    try:
        return int(str(os.getenv(name) or "").strip() or default)
    except ValueError:
        return default
