from __future__ import annotations

import json
import os
from dataclasses import dataclass
from typing import Any, AsyncIterator

import httpx

from backend.config_loader import load_json_config


@dataclass(frozen=True)
class ChatModelConfig:
    base_url: str
    chat_path: str
    api_key: str
    model: str
    enable_thinking: bool


def env_bool(name: str, default: bool) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


class ModelRegistry:
    def __init__(
        self,
        models_config: dict[str, Any] | None = None,
        tasks_config: dict[str, Any] | None = None,
    ) -> None:
        self.models_config = models_config or load_json_config("models.json")
        self.tasks = tasks_config or load_json_config("model_tasks.json")
        self.providers = self.models_config.get("providers", {})

    def for_task(self, task: str) -> ChatModelConfig:
        provider_name = self.tasks.get(task)
        if not provider_name:
            raise KeyError(f"Model task is not configured: {task}")
        return self.provider(provider_name)

    def provider(self, name: str) -> ChatModelConfig:
        provider = self.providers.get(name)
        if not isinstance(provider, dict):
            raise KeyError(f"Model provider is not configured: {name}")

        return ChatModelConfig(
            base_url=os.getenv(provider["base_url_env"], provider["base_url"]).rstrip("/"),
            chat_path=os.getenv(provider["chat_path_env"], provider["chat_path"]),
            api_key=os.getenv(provider["api_key_env"], provider["api_key"]),
            model=os.getenv(provider["model_env"], provider["model"]),
            enable_thinking=env_bool(
                provider["enable_thinking_env"],
                bool(provider.get("enable_thinking", False)),
            ),
        )


class ChatModelClient:
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
