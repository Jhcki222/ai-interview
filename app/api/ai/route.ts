import { isSameAIOrigin } from "@/lib/ai/origin";
import { getModelCatalog, harnessFetch } from "@/lib/ai/provider";
import { chooseSelection } from "@/lib/ai/catalog";
import { requestSchema } from "@/lib/ai/schemas";
import { AIError, consumeUsage } from "@/lib/ai/usage";
import { readBoundedText, RequestBodyTooLarge } from "@/lib/ai/request-body";

export const runtime = "nodejs";
export const maxDuration = 120;
export async function POST(request: Request) {
  const correlationId = crypto.randomUUID();
  const started = performance.now();
  const abort = AbortSignal.any([request.signal, AbortSignal.timeout(110000)]);
  try {
    if (!isSameAIOrigin(request, process.env.VERCEL === "1"))
      throw new AIError("허용되지 않은 요청 출처입니다.", 403);
    if (Number(request.headers.get("content-length") || 0) > 220000)
      throw new AIError("요청이 너무 큽니다.", 413);
    const raw = await readBoundedText(request.body);
    if (raw.length > 200000) throw new AIError("요청이 너무 큽니다.", 413);
    let body: unknown;
    try {
      body = JSON.parse(raw);
    } catch {
      throw new AIError("올바른 JSON 요청이 필요합니다.", 400);
    }
    const parsed = requestSchema.safeParse(body);
    if (!parsed.success) throw new AIError("입력 형식이나 길이를 확인해 주세요.", 400);
    const input = parsed.data;
    const catalog = await getModelCatalog(abort);
    let selected;
    try {
      selected = chooseSelection(catalog, input.selection || {}, process.env);
    } catch (error) {
      throw new AIError(
        error instanceof Error && error.message === "INVALID_MODEL"
          ? "허용되지 않은 AI 모델입니다."
          : "사용 가능한 AI 제공자 설정이 필요합니다.",
        error instanceof Error && error.message === "INVALID_MODEL" ? 400 : 503,
      );
    }
    await consumeUsage(request);
    abort.throwIfAborted();
    const budgetMs = Math.floor(105000 - (performance.now() - started));
    if (budgetMs < 1) throw new AIError("요청 시간이 초과되었습니다.", 504, "TIMEOUT");

    console.info("ai_gateway run=%s route=/api/ai action=%s", correlationId, input.action);
    const upstream = await harnessFetch("/v1/runs", {
      method: "POST",
      signal: abort,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        runId: correlationId,
        budgetMs,
        input: { ...input, selection: selected },
      }),
    });
    if (upstream.status === 400) {
      await upstream.body?.cancel().catch(() => {});
      throw new AIError("Python 하네스가 요청 형식 또는 모델을 거부했습니다.", 400);
    }
    if (upstream.status === 413) {
      await upstream.body?.cancel().catch(() => {});
      throw new AIError("요청이 너무 큽니다.", 413, "REQUEST_TOO_LARGE");
    }
    if (
      !upstream.ok ||
      !upstream.body ||
      !upstream.headers.get("content-type")?.startsWith("text/event-stream")
    ) {
      await upstream.body?.cancel().catch(() => {});
      throw new AIError("AI 실행 서비스에 연결할 수 없습니다.", 503, "MISSING_CONFIG");
    }
    return new Response(upstream.body, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-store, no-transform",
        "X-Accel-Buffering": "no",
      },
    });
  } catch (error) {
    if (error instanceof RequestBodyTooLarge)
      return Response.json(
        { error: error.message, code: "REQUEST_TOO_LARGE", correlationId },
        { status: 413 },
      );
    if (abort.aborted && !request.signal.aborted)
      return Response.json(
        { error: "요청 시간이 초과되었습니다.", code: "TIMEOUT", correlationId },
        { status: 504 },
      );
    const known = error instanceof AIError;
    return Response.json(
      {
        error: known ? error.message : "AI 요청 처리 중 오류가 발생했습니다.",
        code: known
          ? error.code ||
            (error.status === 429
              ? "RATE_LIMIT"
              : error.status === 503
                ? "MISSING_CONFIG"
                : "INVALID_REQUEST")
          : "INTERNAL_ERROR",
        correlationId,
      },
      { status: known ? error.status : 500 },
    );
  }
}
