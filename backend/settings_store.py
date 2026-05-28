from __future__ import annotations

import json
from pathlib import Path
from typing import Any


DEFAULT_SETTINGS = {
    "answerMode": "friendly",
    "localBaseUrl": "",
    "localChatPath": "",
    "localApiKey": "",
    "localModel": "",
    "localEnableThinking": False,
    "autocompleteBaseUrl": "",
    "autocompleteChatPath": "",
    "autocompleteApiKey": "",
    "autocompleteModel": "",
    "autocompleteEnableThinking": False,
}


def normalize_answer_mode(value: Any) -> str:
    mode = value if isinstance(value, str) else ""
    return mode if mode in {"friendly", "serious"} else "friendly"


def read_settings(path: Path) -> dict[str, Any]:
    settings = dict(DEFAULT_SETTINGS)

    if not path.exists():
        return settings

    try:
        with path.open("r", encoding="utf-8") as file:
            data = json.load(file)
    except (OSError, json.JSONDecodeError):
        return settings

    if not isinstance(data, dict):
        return settings

    for key in DEFAULT_SETTINGS:
        value = data.get(key)
        if isinstance(DEFAULT_SETTINGS[key], bool):
            if isinstance(value, bool):
                settings[key] = value
        elif isinstance(value, str):
            settings[key] = value

    settings["answerMode"] = normalize_answer_mode(settings.get("answerMode"))
    return settings


def write_settings(path: Path, settings: dict[str, Any]) -> None:
    path.parent.mkdir(parents=True, exist_ok=True)

    with path.open("w", encoding="utf-8") as file:
        json.dump(settings, file, ensure_ascii=False, indent=2)
        file.write("\n")


def update_settings(path: Path, payload: dict[str, Any]) -> dict[str, Any]:
    settings = read_settings(path)

    if "answerMode" in payload:
        settings["answerMode"] = normalize_answer_mode(payload.get("answerMode"))

    for key in (
        "localBaseUrl",
        "localChatPath",
        "localModel",
        "autocompleteBaseUrl",
        "autocompleteChatPath",
        "autocompleteModel",
    ):
        value = payload.get(key)

        if isinstance(value, str):
            settings[key] = value.strip()

    if "localEnableThinking" in payload:
        settings["localEnableThinking"] = bool(payload.get("localEnableThinking"))

    if "autocompleteEnableThinking" in payload:
        settings["autocompleteEnableThinking"] = bool(payload.get("autocompleteEnableThinking"))

    for key in ("localApiKey", "autocompleteApiKey"):
        value = payload.get(key)

        if isinstance(value, str) and value.strip():
            settings[key] = value.strip()

    write_settings(path, settings)
    return settings


def public_settings(settings: dict[str, Any]) -> dict[str, Any]:
    local_override_set = any(
        bool(str(settings.get(key) or "").strip())
        for key in ("localBaseUrl", "localChatPath", "localApiKey", "localModel")
    ) or bool(settings.get("localEnableThinking"))

    autocomplete_override_set = any(
        bool(str(settings.get(key) or "").strip())
        for key in (
            "autocompleteBaseUrl",
            "autocompleteChatPath",
            "autocompleteApiKey",
            "autocompleteModel",
        )
    ) or bool(settings.get("autocompleteEnableThinking"))

    return {
        "answerMode": normalize_answer_mode(settings.get("answerMode")),
        "localBaseUrl": str(settings.get("localBaseUrl") or ""),
        "localChatPath": str(settings.get("localChatPath") or ""),
        "localModel": str(settings.get("localModel") or ""),
        "localEnableThinking": bool(settings.get("localEnableThinking")),
        "localApiOverrideSet": local_override_set,
        "localApiKeySet": bool(settings.get("localApiKey")),
        "autocompleteBaseUrl": str(settings.get("autocompleteBaseUrl") or ""),
        "autocompleteChatPath": str(settings.get("autocompleteChatPath") or ""),
        "autocompleteModel": str(settings.get("autocompleteModel") or ""),
        "autocompleteEnableThinking": bool(settings.get("autocompleteEnableThinking")),
        "autocompleteApiOverrideSet": autocomplete_override_set,
        "autocompleteApiKeySet": bool(settings.get("autocompleteApiKey")),
    }
