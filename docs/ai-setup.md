# AI provider setup and verification

The application calls real providers through AI SDK 6. It never returns demo AI answers. Provider credentials stay on the server.

## Environment and database

- `NVIDIA_API_KEY`: NVIDIA hosted NIM; fixed base `https://integrate.api.nvidia.com/v1`.
- `GROQ_API_KEY`: Groq official API.
- `OLLAMA_API_KEY`: Ollama Cloud; fixed OpenAI-compatible base `https://ollama.com/v1` (not a user's local machine).
- `OPENAI_API_KEY`: optional legacy OpenAI integration; no OpenAI model is selectable until an actual model verification is recorded.
- `AI_PROVIDER=nvidia` and `AI_MODEL=nvidia/nemotron-3-ultra-550b-a55b`: preferred startup selection. Missing/retired model settings fall back to the first verified model in that configured provider. A provider without any verified model is not selectable.
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY` (or `SUPABASE_SECRET_KEY`), `AI_COOKIE_SECRET` (random, at least 32 characters).

Apply SQL 001 and `supabase/migrations/002_ai_usage.sql`. AI usage is atomically accounted in PostgreSQL once per logical request; provider retries/failover do not consume extra application quotas. Guest limit 20/day; member 80/day; UTC resets. Guests use an HttpOnly signed cookie; Vercel ingress IP is HMAC-hashed and separately limited. Other forwarded IP headers are ignored. The RPC is service-role-only and locks identity buckets in stable order. Missing settings or an unavailable quota backend fail closed. `USAGE_BACKEND_UNAVAILABLE` means the service key/project/RPC permissions need checking; it does not bypass the limiter. RPC network calls have an 8 second deadline.

## Models and real health verification

`GET /api/ai/models` returns only configured providers, curated verified selectable models, an initial selection, discovery status and excluded-model diagnostics. NVIDIA `/v1/models` and Ollama `/api/tags` inventory are queried with a 4 second bound and 60 second cache. Inventory never expands the server allowlist or proves inference health. Client-selected provider/model pairs are validated on the server; arbitrary URLs and unknown models are rejected.

Real synthetic Korean JSON probes on 2026-11-04:

| Provider | Model | Result |
| --- | --- | --- |
| NVIDIA | nvidia/nemotron-3-ultra-550b-a55b | HTTP200, Korean JSON validated, 2.8s; default |
| NVIDIA | nvidia/nemotron-3-super-120b-a12b | HTTP404; excluded |
| NVIDIA | google/gemma-4-31b-it |45 s timeout; excluded |
| NVIDIA | openai/gpt-oss-20b |45 s timeout; excluded |
| Groq | openai/gpt-oss-20b /120b | HTTP200, Korean JSON validated, 0.7–0.8s |
| Ollama | gemma4:31b / gpt-oss:20b / gpt-oss:120b / nemotron-3-super | HTTP200, Korean JSON validated, 0.5–2.0s |

A small JSON probe establishes connectivity and format support, not comparative interview quality. Every real result is independently schema-validated. See [official model and cost research](model-research.md). NVIDIA Ultra explicitly lists Korean support in its [official model card](https://build.nvidia.com/nvidia/nemotron-3-ultra-550b-a55b/modelcard). Ollama's [official compatibility documentation](https://github.com/ollama/ollama/blob/main/docs/api/openai-compatibility.mdx) defines the Cloud base. Groq's [structured-output documentation](https://console.groq.com/docs/structured-outputs) states the upstream streaming limitation.

## Request, status and failure contract

`POST /api/ai` accepts the action-specific object plus optional `selection:{provider,model}` and `allowFallback:boolean` (default true, shown as an explicit checkbox). If fallback is enabled, the same input may be sent to another configured provider; the UI states this before use. Disable it to restrict processing to the selected provider. The candidate order starts with the selected model, then the first verified model from each other configured provider.

- analyze: `{action:"analyze",documents,settings}`; documents 1–45,000 characters.
- generate: `{action:"generate",analysis,settings}`; exactly 5/10/15 complete questions as selected.
- evaluate/followup: `{action,question,answer,history?}`; current fields each ≤8,000 characters. History is the latest ≤6 prior turns, each question ≤1,000 and answer ≤1,200 characters, with head/tail excerpts and omission markers. The current answer remains separate.
- summary: `{action:"summary",excerpted:true,turns}`;1–45 turns, every score/dimension retained with bounded evidence. Serialized UTF8 payload stays under 180 KB even with JSON escaping. Full original transcript remains in the UI.

Settings: role, level, count, mode, optional company/division ≤100 characters each, optional jobPosting ≤12,000, interviewType technical/project/personality/motivation/comprehensive, difficulty BASIC/INTERMEDIATE/ADVANCED. These fields explicitly guide analysis/generation without inventing company facts or experience.

Maximum body 220,000 bytes and 200,000 characters; a bounded reader cancels oversized chunked input before buffering it all. Same-origin validation accepts the request URL or actual Host; forwarded Host/protocol are trusted only on Vercel.

SSE events:

- `status`: initializing/connecting/processing/validating/retrying/fallback/completed, message, provider/model, attempt, elapsedMs, correlationId and optional safe error code/retryAfterMs.
- `progress`: real processing heartbeat every 8 seconds.
- `preview`: OpenAI-only transient human-readable upstream partial text, clearly labelled unvalidated and never persisted.
- `complete`: full schema-validated result only.
- `error`: sanitized message/code, provider/model, elapsedMs and correlationId. No raw provider error, credentials, document or response body is logged.

The UI displays elapsed time, actual provider/model, retries, fallback, rate limits, timeout, missing configuration and correlation ID. Before SSE, errors use JSON `{error,code,correlationId}` with the appropriate HTTP status.

401/403 authentication/access failures are never retried on that provider.429 uses bounded Retry-After backoff; network/5xx may retry once.404/410, invalid responses and timeouts may proceed to a configured fallback when permitted. Per-attempt deadline ≤40 s; total execution ≤105 s inside an absolute 110 s request deadline and 120 s Vercel function limit. Cancellation stops subsequent retry/fallback. AI SDK built-in retries are disabled so the shared policy owns the budget.

Groq uses non-streaming strict `generateText`+`Output.object`. NVIDIA/Ollama use `generateText`+`Output.json` with the complete JSON Schema in the prompt and mandatory Zod/domain validation after generation. OpenAI uses native structured streaming with an explicit no-op error logger. Non-streaming providers emit honest status/heartbeat followed by completion; token previews are never fabricated.

## Documents, sessions and saving

Browser extraction: PDF/pdfjs with local worker, DOCX/mammoth raw text, TXT. Maximum 3 files, 5 MB each, 15,000 extracted characters each and 45,000 combined. Drag/drop, additive selection, duplicate detection, removable file list and parsing status are supported. Empty/scanned/unreadable documents are distinguished. Raw files are neither uploaded nor stored; extracted text goes to the selected provider for analysis then is discarded by the UI. PDF cancellation destroys its task; pending TXT/DOCX results are ignored after cancellation; a post-extraction guard prevents any cancelled content from reaching the server. Extraction deadline 60 s.

Reviewed analysis is editable. Question learning supports independent model-answer/follow-up disclosures, personal answer editing and per-question AI evaluation, then transition into a chat using the same generated list. Every evaluation exposes a revised-answer example. Prompts prohibit attributing invented experience/numbers to the candidate. AI scores are estimates, not hiring decisions.

Current-tab sessionStorage contains only reviewed analysis, generated questions, answers/evaluations, chosen provider and fallback preference. Storage operations are guarded. `/interview/[id]` displays only its matching current-tab session, otherwise an explicit unmatched state. Generated IDs use a session namespace before display/save; raw model IDs are checked for duplicates first. Authenticated Save opens the company-selection dialog; guests see login/signup/later.

Provider-only smoke tests do not prove database setup. The latest full `/api/ai` synthetic check reached the persistent limiter but returned `USAGE_BACKEND_UNAVAILABLE`; database/service-key verification must pass before claiming the full live route works. No quota bypass was added.

