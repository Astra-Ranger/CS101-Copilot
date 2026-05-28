from __future__ import annotations

import json
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Any, AsyncIterator

import httpx

from backend.config_loader import load_json_config
from backend.settings_store import read_settings


logger = logging.getLogger(__name__)
BACKEND_DIR = Path(__file__).resolve().parent
USER_SETTINGS_PATH = BACKEND_DIR / "user_settings.json"


@dataclass(frozen=True)
class ChatModelConfig:
    name: str
    base_url: str
    chat_path: str
    api_key: str
    model: str
    enable_thinking: bool


class ModelRegistry:
    def __init__(
        self,
        models_config: dict[str, Any] | None = None,
        tasks_config: dict[str, Any] | None = None,
    ) -> None:
        self.models_config = models_config or self._load_models_config()
        self.tasks = tasks_config or load_json_config("model_tasks.json")
        self.providers = self.models_config.get("providers", {})

    def for_task(self, task: str) -> ChatModelConfig:
        return self.for_task_chain(task)[0]

    def for_task_chain(self, task: str) -> list[ChatModelConfig]:
        task_config = self.tasks.get(task)
        provider_names = self._task_provider_names(task_config)
        if not provider_names:
            raise KeyError(f"Model task is not configured: {task}")

        return [self.provider(provider_name) for provider_name in provider_names]

    def provider(self, name: str) -> ChatModelConfig:
        provider = self.providers.get(name)
        if not isinstance(provider, dict):
            raise KeyError(f"Model provider is not configured: {name}")

        provider = self._apply_provider_overrides(name, provider)

        return ChatModelConfig(
            name=name,
            base_url=str(provider["base_url"]).rstrip("/"),
            chat_path=str(provider["chat_path"]),
            api_key=str(provider.get("api_key", "")),
            model=str(provider["model"]),
            enable_thinking=bool(provider.get("enable_thinking", False)),
        )

    def _load_models_config(self) -> dict[str, Any]:
        providers: dict[str, Any] = {}

        for filename in ("local_models.json", "siliconflow_models.json"):
            config = load_json_config(filename)
            provider_config = config.get("providers", {})

            if isinstance(provider_config, dict):
                providers.update(provider_config)

        return {"providers": providers}

    def _apply_provider_overrides(self, name: str, provider: dict[str, Any]) -> dict[str, Any]:
        next_provider = dict(provider)
        settings = read_settings(USER_SETTINGS_PATH)

        if name in {"qwen", "deepseek"}:
            local_override = self._has_local_api_override(settings)

            if local_override:
                self._copy_setting(next_provider, settings, "base_url", "localBaseUrl")
                self._copy_setting(next_provider, settings, "chat_path", "localChatPath")
                self._copy_setting(next_provider, settings, "api_key", "localApiKey")
                self._copy_setting(next_provider, settings, "model", "localModel")
                next_provider["enable_thinking"] = bool(settings.get("localEnableThinking"))

            return next_provider

        if name == "siliconflow_glm":
            autocomplete_override = self._has_autocomplete_api_override(settings)

            if autocomplete_override:
                self._copy_setting(next_provider, settings, "base_url", "autocompleteBaseUrl")
                self._copy_setting(next_provider, settings, "chat_path", "autocompleteChatPath")
                self._copy_setting(next_provider, settings, "api_key", "autocompleteApiKey")
                self._copy_setting(next_provider, settings, "model", "autocompleteModel")
                next_provider["enable_thinking"] = bool(settings.get("autocompleteEnableThinking"))

            return next_provider

        return next_provider

    def _has_local_api_override(self, settings: dict[str, Any]) -> bool:
        return any(
            bool(str(settings.get(key) or "").strip())
            for key in ("localBaseUrl", "localChatPath", "localApiKey", "localModel")
        ) or bool(settings.get("localEnableThinking"))

    def _has_autocomplete_api_override(self, settings: dict[str, Any]) -> bool:
        return any(
            bool(str(settings.get(key) or "").strip())
            for key in (
                "autocompleteBaseUrl",
                "autocompleteChatPath",
                "autocompleteApiKey",
                "autocompleteModel",
            )
        ) or bool(settings.get("autocompleteEnableThinking"))

    def _copy_setting(
        self,
        provider: dict[str, Any],
        settings: dict[str, Any],
        provider_key: str,
        settings_key: str,
    ) -> None:
        value = settings.get(settings_key)

        if isinstance(value, str) and value.strip():
            provider[provider_key] = value.strip()

    def _task_provider_names(self, task_config: Any) -> list[str]:
        if isinstance(task_config, str):
            return [task_config]

        if not isinstance(task_config, dict):
            return []

        names: list[str] = []
        primary = task_config.get("primary")
        if isinstance(primary, str) and primary:
            names.append(primary)

        fallback = task_config.get("fallback")
        if isinstance(fallback, str) and fallback:
            names.append(fallback)
        elif isinstance(fallback, list):
            names.extend(item for item in fallback if isinstance(item, str) and item)

        return names


class ChatModelClient:
    async def complete_with_fallback(
        self,
        model_configs: list[ChatModelConfig],
        messages: list[dict[str, Any]],
        stream: bool = False,
    ) -> dict[str, Any]:
        last_exc: Exception | None = None

        for model_config in model_configs:
            try:
                return await self.complete(model_config, messages, stream=stream)
            except Exception as exc:
                last_exc = exc
                logger.warning("Model provider %s failed, trying fallback: %s", model_config.name, exc)

        if last_exc:
            raise last_exc

        raise RuntimeError("No model provider configured")

    async def stream_with_fallback(
        self,
        model_configs: list[ChatModelConfig],
        messages: list[dict[str, Any]],
    ) -> AsyncIterator[str]:
        last_exc: Exception | None = None

        for model_config in model_configs:
            emitted = False
            try:
                async for delta in self.stream(model_config, messages):
                    emitted = True
                    yield delta
                return
            except Exception as exc:
                if emitted:
                    raise
                last_exc = exc
                logger.warning("Model provider %s failed before streaming, trying fallback: %s", model_config.name, exc)

        if last_exc:
            raise last_exc

        raise RuntimeError("No model provider configured")

    async def complete(
        self,
        model_config: ChatModelConfig,
        messages: list[dict[str, Any]],
        stream: bool = False,
    ) -> dict[str, Any]:
        async with httpx.AsyncClient(timeout=60) as client:
            response = await client.post(
                self._url(model_config),
                headers=self._headers(model_config),
                json=self._payload(model_config, messages, stream),
            )
            response.raise_for_status()
            return response.json()

    async def stream(
        self,
        model_config: ChatModelConfig,
        messages: list[dict[str, Any]],
    ) -> AsyncIterator[str]:
        async with httpx.AsyncClient(timeout=None) as client:
            async with client.stream(
                "POST",
                self._url(model_config),
                headers=self._headers(model_config),
                json=self._payload(model_config, messages, stream=True),
            ) as response:
                response.raise_for_status()

                async for line in response.aiter_lines():
                    if not line.startswith("data:"):
                        continue

                    data = line.removeprefix("data:").strip()
                    if not data or data == "[DONE]":
                        continue

                    try:
                        chunk = json.loads(data)
                    except json.JSONDecodeError:
                        continue

                    delta = self._stream_delta(chunk)
                    if delta:
                        yield delta

    def _url(self, model_config: ChatModelConfig) -> str:
        return f"{model_config.base_url}{model_config.chat_path}"

    def _headers(self, model_config: ChatModelConfig) -> dict[str, str]:
        return {
            "Authorization": f"Bearer {model_config.api_key}",
            "Content-Type": "application/json",
        }

    def _payload(
        self,
        model_config: ChatModelConfig,
        messages: list[dict[str, Any]],
        stream: bool,
    ) -> dict[str, Any]:
        return {
            "model": model_config.model,
            "messages": messages,
            "stream": stream,
            "chat_template_kwargs": {
                "enable_thinking": model_config.enable_thinking,
            },
        }

    def _stream_delta(self, chunk: dict[str, Any]) -> str:
        choices = chunk.get("choices") or []
        if not choices:
            return ""
        delta = choices[0].get("delta") or {}
        content = delta.get("content")
        return content if isinstance(content, str) else ""
