"""Private HTTP boundary for the Next.js gateway."""

import asyncio
import json
import os
import secrets
from contextlib import asynccontextmanager
from time import monotonic

import httpx
from fastapi import Depends, FastAPI, HTTPException, Request
from fastapi.responses import JSONResponse, StreamingResponse
from pydantic import ValidationError
from starlette.types import Receive, Scope, Send

from .contracts import RunRequest, Selection
from .providers import Providers
from .runtime import run_harness

MAX_BODY_BYTES = 221000


class Catalog:
    def __init__(self, providers: Providers):
        self.providers = providers
        self.entries = []
        self.expires = 0.0
        self.lock = asyncio.Lock()

    async def get(self):
        async with self.lock:
            if monotonic() >= self.expires:
                self.entries = await asyncio.gather(
                    *(self.providers.discover(provider) for provider in self.providers.keys)
                )
                self.expires = monotonic() + 60
            return self.entries


@asynccontextmanager
async def lifespan(app: FastAPI):
    token = os.getenv("AI_HARNESS_TOKEN", "")
    if len(token) < 32 or not token.isascii():
        raise RuntimeError("AI_HARNESS_TOKEN must be an ASCII secret of at least 32 characters")
    async with httpx.AsyncClient(
        timeout=httpx.Timeout(75, connect=5),
        limits=httpx.Limits(max_connections=24, max_keepalive_connections=12),
        follow_redirects=False,
        trust_env=False,
    ) as client:
        app.state.token = token
        app.state.providers = Providers(client)
        app.state.catalog = Catalog(app.state.providers)
        yield


app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)


async def authorize(request: Request):
    header = request.headers.get("authorization", "").encode("utf-8")
    expected = f"Bearer {request.app.state.token}".encode("ascii")
    if not secrets.compare_digest(header, expected):
        raise HTTPException(401)


@app.get("/healthz")
async def health():
    return {"status": "ok"}


@app.get("/v1/catalog", dependencies=[Depends(authorize)])
async def catalog(request: Request):
    return await request.app.state.catalog.get()


def failure(status: int, code: str, message: str):
    return JSONResponse({"code": code, "error": message}, status_code=status)


def sse(event, payload):
    return f"event: {event}\ndata: {json.dumps(payload, ensure_ascii=False, separators=(',', ':'))}\n\n"


async def stream(run, candidates, providers):
    queue = asyncio.Queue()

    def emit(event, payload):
        queue.put_nowait(sse(event, payload))

    async def execute():
        try:
            await run_harness(run, candidates, providers, emit)
        finally:
            queue.put_nowait(None)

    worker = asyncio.create_task(execute())
    try:
        while True:
            try:
                message = await asyncio.wait_for(queue.get(), timeout=8)
            except TimeoutError:
                yield sse("progress", {"message": "AI가 응답을 생성하고 있습니다. 완료 후 검증합니다."})
                continue
            if message is None:
                break
            yield message
    finally:
        worker.cancel()
        await asyncio.gather(worker, return_exceptions=True)


class RunStream(StreamingResponse):
    async def __call__(self, scope: Scope, receive: Receive, send: Send):
        try:
            await super().__call__(scope, receive, send)
        finally:
            # A failed ASGI send can leave the generator suspended at its last yield.
            await self.body_iterator.aclose()


@app.post("/v1/runs", dependencies=[Depends(authorize)])
async def run(request: Request):
    body = bytearray()
    async for chunk in request.stream():
        if len(body) + len(chunk) > MAX_BODY_BYTES:
            return failure(413, "REQUEST_TOO_LARGE", "요청이 너무 큽니다.")
        body.extend(chunk)
    try:
        run_request = RunRequest.model_validate_json(body)
    except ValidationError:
        return failure(400, "INVALID_REQUEST", "입력 형식이나 길이를 확인해 주세요.")
    selected = run_request.input.selection
    if selected is None:
        return failure(400, "INVALID_REQUEST", "AI 모델 선택이 필요합니다.")
    entries = await request.app.state.catalog.get()
    entry = next((item for item in entries if item["provider"] == selected.provider), None)
    if entry is None or not entry["models"]:
        return failure(503, "MISSING_CONFIG", "사용 가능한 AI 제공자 설정이 필요합니다.")
    if selected.model not in entry["models"]:
        return failure(400, "MODEL_UNAVAILABLE", "허용되지 않은 AI 모델입니다.")
    candidates = [selected] + [
        Selection(provider=item["provider"], model=item["models"][0])
        for item in entries if item["provider"] != selected.provider and item["models"]
    ]
    return RunStream(
        stream(run_request, candidates, request.app.state.providers),
        media_type="text/event-stream",
        headers={"Cache-Control": "no-store, no-transform", "X-Accel-Buffering": "no"},
    )
