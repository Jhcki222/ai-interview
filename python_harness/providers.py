"""Fixed outbound endpoints. The transport performs exactly one provider call."""

import json
import logging
import math
import os
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
from pathlib import Path

import httpx
from pydantic import ValidationError

from .contracts import Selection, TOOLS
from .prompts import SYSTEM

LOG = logging.getLogger("uvicorn.error")
MODELS = json.loads(Path(__file__).with_name("models.json").read_text(encoding="utf-8"))
ENDPOINTS = {
    "nvidia": "https://integrate.api.nvidia.com/v1/chat/completions",
    "groq": "https://api.groq.com/openai/v1/chat/completions",
    "ollama": "https://ollama.com/v1/chat/completions",
    "openai": "https://api.openai.com/v1/chat/completions",
}
DISCOVERY = {
    "nvidia": "https://integrate.api.nvidia.com/v1/models",
    "ollama": "https://ollama.com/api/tags",
}
MESSAGES = {
    "AUTH_ERROR": "AI 제공자 인증 또는 접근 권한을 확인해 주세요.",
    "RATE_LIMIT": "AI 제공자의 요청 한도에 도달했습니다.",
    "MODEL_UNAVAILABLE": "선택한 모델을 현재 제공자가 지원하지 않습니다.",
    "TIMEOUT": "AI 응답 제한 시간을 초과했습니다.",
    "INVALID_RESPONSE": "AI 응답 형식 검증에 실패했습니다.",
    "PROVIDER_UNAVAILABLE": "AI 제공자 서비스가 일시적으로 응답하지 않습니다.",
    "PROVIDER_REQUEST": "선택한 모델이 요청 형식을 처리하지 못했습니다.",
    "NETWORK_ERROR": "AI 제공자 연결이 원활하지 않습니다.",
    "MISSING_CONFIG": "사용 가능한 AI 제공자가 없습니다.",
    "INTERNAL_ERROR": "AI 요청 처리 중 오류가 발생했습니다.",
}


class Failure(Exception):
    def __init__(self, code: str, retry_after: float | None = None):
        super().__init__(code)
        self.code = code
        self.message = MESSAGES[code]
        self.retry_after = retry_after

    @property
    def retryable(self):
        return self.code in {"RATE_LIMIT", "PROVIDER_UNAVAILABLE", "NETWORK_ERROR"}


def retry_after(value: str) -> float:
    try:
        seconds = float(value)
    except ValueError:
        try:
            seconds = (parsedate_to_datetime(value) - datetime.now(timezone.utc)).total_seconds()
        except (ValueError, TypeError, OverflowError):
            return 1
    return min(3600, max(0, seconds)) if math.isfinite(seconds) else 1


def response_failure(response: httpx.Response) -> Failure:
    status = response.status_code
    if status == 429:
        return Failure("RATE_LIMIT", retry_after(response.headers.get("retry-after", "1")))
    if status in {401, 403}:
        return Failure("AUTH_ERROR")
    if status in {404, 410}:
        return Failure("MODEL_UNAVAILABLE")
    return Failure("PROVIDER_UNAVAILABLE" if status >= 500 else "PROVIDER_REQUEST")


class Providers:
    def __init__(self, client: httpx.AsyncClient):
        self.client = client
        self.keys = {
            provider: key
            for provider in ENDPOINTS
            if (key := os.getenv(f"{provider.upper()}_API_KEY"))
        }

    async def discover(self, provider: str):
        allowed = MODELS[provider]
        if provider not in DISCOVERY:
            return {"provider": provider, "models": allowed, "discovery": "allowlist"}
        try:
            response = await self.client.get(
                DISCOVERY[provider], headers=self.headers(provider), timeout=4
            )
            response.raise_for_status()
            data = response.json()
            ids = (
                {model["id"] for model in data["data"]}
                if provider == "nvidia"
                else {model["name"].removesuffix("-cloud") for model in data["models"]}
            )
            models = [model for model in allowed if model in ids]
            if models:
                return {"provider": provider, "models": models, "discovery": "live"}
        except (httpx.HTTPError, ValueError, KeyError, TypeError, AttributeError):
            pass
        return {"provider": provider, "models": allowed, "discovery": "allowlist", "warn": True}

    def headers(self, provider: str):
        return {"Authorization": f"Bearer {self.keys[provider]}"}

    async def complete(self, selection: Selection, action: str, prompt: str, run_id: str, batch: int):
        output, max_tokens = TOOLS[action]
        body = {
            "model": selection.model,
            "messages": [
                {"role": "system", "content": SYSTEM},
                {"role": "user", "content": prompt},
            ],
            "response_format": {"type": "json_object"},
            "max_completion_tokens" if selection.provider == "groq" else "max_tokens": max_tokens,
        }
        if selection.provider == "nvidia":
            body["chat_template_kwargs"] = {"enable_thinking": False}
        try:
            response = await self.client.post(
                ENDPOINTS[selection.provider], headers=self.headers(selection.provider), json=body
            )
        except httpx.TimeoutException:
            raise Failure("TIMEOUT") from None
        except httpx.RequestError:
            raise Failure("NETWORK_ERROR") from None

        try:
            data = response.json()
        except ValueError:
            data = None
        request_id = response.headers.get("x-request-id", "")
        if selection.provider == "groq" and isinstance(data, dict):
            metadata = data.get("x_groq")
            if isinstance(metadata, dict):
                request_id = metadata.get("id") or request_id
        if not isinstance(request_id, str) or len(request_id) > 128 or not all(
            c.isascii() and (c.isalnum() or c in "-_") for c in request_id
        ):
            request_id = ""
        LOG.info(
            "provider_call run=%s action=%s provider=%s model=%s batch=%d http=%d upstream=%s",
            run_id, action, selection.provider, selection.model, batch, response.status_code,
            request_id or "-",
        )
        if not response.is_success:
            raise response_failure(response)
        try:
            choice = data["choices"][0]
            if choice["finish_reason"] != "stop":
                raise Failure("INVALID_RESPONSE")
            return output.model_validate_json(choice["message"]["content"])
        except (ValueError, KeyError, IndexError, TypeError, ValidationError):
            raise Failure("INVALID_RESPONSE") from None
