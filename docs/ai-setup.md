# AI setup and API contract

AI calls use AI SDK 6 `Output.object` with the configured provider. Groq (default) uses `generateText` with structuredOutputs/strictJsonSchema enabled; OpenAI uses `streamText` with real previews. No demo/fallback answers are returned.

## Server environment

- `OPENAI_API_KEY`: provider API key (server only).
- `AI_MODEL`: an OpenAI model supporting structured output; choose an enabled model with an output budget of at least 24,000 tokens for 15-question requests.
- `NEXT_PUBLIC_SUPABASE_URL`: project URL.
- `SUPABASE_SERVICE_ROLE_KEY`: service key, never expose to browser.
- `AI_COOKIE_SECRET`: random secret of at least 32 characters for signed guest cookies and IP HMAC. Rotate to invalidate guest identities.

Apply `supabase/migrations/002_ai_usage.sql` after the member-data migration. Only service_role can execute the limiter. Requests fail closed when any AI/limiter configuration is absent or when the RPC is unavailable. Daily UTC limits are 20 requests per guest and 80 per member; on Vercel each request also consumes a hashed IP bucket. Every AI action, including failed provider attempts, consumes one request. Guest cookies are HttpOnly, SameSite=Lax, Secure in production, expire after 30 days. Outside Vercel generic client IP headers are ignored; the signed guest identity is used. For public non-Vercel deployments add a trusted ingress IP implementation before relying on guest abuse prevention. No raw IP is persisted.

The SQL acquires transaction advisory locks in a stable order, checks all identity buckets, then increments all buckets in one transaction. No in-memory counter is used. Usage rows contain subject keys, UTC date and request count; prune old usage rows with your database maintenance policy.

## POST `/api/ai`

Same-origin JSON only (foreign Origin rejected). Maximum request body: 200,000 characters and 220,000 declared Content-Length bytes. Summary requests are kept below 180,000 UTF-8 bytes. Request schema is `lib/ai/schemas.ts`:

- `{action:"analyze", documents, settings}`: documents 1–45,000 characters.
- `{action:"generate", analysis, settings}`: exactly settings.count questions (5/10/15), unique IDs, full model answers and at least two answered follow-ups.
- `{action:"evaluate", question, answer}`: each at most 8,000 characters; exactly five unique scored dimensions.
- `{action:"followup", question, answer}`: one targeted follow-up with rationale and model answer.
- `{action:"summary", excerpted:true, turns:[{question,answer,evaluation}]}`: 1–45 turns. The browser keeps every turn, each overall score, all five dimension scores/evidence, and the first strength/improvement. Question excerpts are at most 120 characters, answers 360 (beginning and conclusion), dimension evidence 80 and strength/improvement 80. Omission is marked `[…]`; the summary system instruction explicitly disallows assumptions about omitted text. Full original answers/evaluations remain in the UI transcript and session. The serialized UTF-8 request is measured and excerpts reduced further if JSON escaping would exceed 180,000 bytes.

Settings: `{role:string,level:"신입"|"주니어"|"시니어",count:5|10|15,mode:"learn"|"chat"}`.

Before streaming: JSON `{error:string}` with 400/403/413/429/503 as appropriate. On success, SSE `event: progress` with `{message,chunks?}`, followed by exactly one `event: complete` with the full validated result. Failure after stream headers is `event: error` with `{message}`. Partial JSON is never returned as a completed result. The browser validates completion independently, limits response buffering, supports AbortController cancellation and a 115-second deadline. Server deadline is 110 seconds; SDK has one provider retry. UI manual retries are limited to two. Vercel deployment/function plan must permit the route's 120-second maximum duration.

## Documents and sessions

Browser-only PDF (`pdfjs-dist`, local public worker), DOCX (`mammoth` raw text) and TXT extraction. Maximum three files, 5MB each, 15,000 extracted characters each, 45,000 combined including document labels. Scanned PDFs without text need OCR before upload; no OCR service is included. Parsing failures and empty text are shown explicitly. Raw files are not uploaded or stored; extracted text is sent to the AI provider for analysis, then discarded by the UI after success. Directly entered context is limited to 12,000 characters and validated against the combined API ceiling. Reviewed analysis and interview records are stored only in this tab's sessionStorage. Starting a new interview clears that record. Refresh during an operation restores only the last stable state. Analysis is editable before generation. AI scores are estimates and do not represent hiring decisions.

`POST /api/me/questions` receives `{question: Question}` only on explicit Save; member auth and RLS are enforced by that route. Guests see a login prompt. Generated questions use independent native details disclosures for model answers, follow-up questions and their answers.

Local validation does not prove live provider credentials, deployed Supabase RPC concurrency or production gateway IP behavior. Verify those with actual deployment secrets before launch.

Generated question validation extends the same client-safe savedQuestionSchema used by member persistence, with tighter AI-only list counts; every accepted generated Question therefore meets persistence field bounds.


## Targeting and complete learning workflow

Settings now include `company` and `division` (optional, 100 characters each), `jobPosting` (optional, 12,000 characters), `interviewType` (`technical`, `project`, `personality`, `motivation`, `comprehensive`), and `difficulty` (`BASIC`, `INTERMEDIATE`, `ADVANCED`). Legacy sessions default these new values. Analyze/generate prompts explicitly apply all targeting fields and use only factual requirements from the supplied posting, without inventing company facts.

Upload supports drag/drop, additive file selection, duplicate detection and individual removal. The list reports file size and extraction status. Learning mode stores independent per-question personal answers/evaluations in this tab, supports editing with stale feedback invalidation, shows revised answers, and can start a chat interview using the existing generated list. Every evaluation card, including the final transcript, exposes the improved/revised answer. Guest Save opens a login/signup/later dialog.

Sessions carry an ID. `/interview/[id]` restores only the matching current-tab record; an arbitrary or missing ID shows an explicit unmatched state and never displays a different stored interview. `/interview` restores the active current-tab session; a link to its address is available in learning mode. Browser storage reads/writes/removal are guarded against disabled storage or quota exceptions. Legacy unnumbered sessions receive an ID on their next restore.

For OpenAI, SSE emits `event: preview` with `{text}`: a bounded human-readable question/analysis/answer/summary preview, shown transiently and labelled unvalidated. Previews are never persisted or accepted as completed output. Final completion still undergoes independent full-schema validation. Input is consumed through a bounded byte reader; even chunked requests are cancelled as soon as they exceed 220,000 bytes, before reading the entire body.

The AI route uses the central `lib/ai/provider.ts` selection helper; provider credentials are server-only. A configured provider does not bypass the required persistent Supabase usage limiter.

## Groq structured-output transport

Groq structured outputs do not support upstream response streaming ([Groq documentation](https://console.groq.com/docs/structured-outputs)). The production route therefore uses non-streaming `generateText` + `Output.object` for every Groq action, with `providerOptions.groq.structuredOutputs=true` and `strictJsonSchema=true`. While waiting, the SSE connection sends real processing status and an eight-second heartbeat, then the full schema-validated `complete` event. It does not invent token or answer previews. OpenAI continues to use upstream `streamText` and transient previews. Both branches share complete-result validation, question-count/ID checks, evaluation dimension checks, timeout/cancellation, usage accounting and user-friendly sanitized errors. The streaming branch supplies an explicit sanitized/no-op `onError` to suppress SDK default logging of provider error objects that may contain request data.

Real Groq verification was run separately with a synthetic document: non-streaming strict generation returned five fully validated questions compatible with member persistence (3,682 tokens). Production `/api/ai` remains dependent on the configured Supabase limiter; a provider-only smoke test does not verify that deployment prerequisite.

## Bounded conversation context

Evaluate and follow-up requests accept optional `history`, containing at most six previous `{question,answer}` turns (question ≤1,000 characters and answer ≤1,200). The browser selects the latest six and retains the beginning/conclusion of longer text with `[…]` omission markers. The current `question`/`answer` remain separate and unabridged up to their existing 8,000-character limits. Even maximum JSON escaping for six excerpts plus both full current fields stays below 180,000 bytes. Follow-up excludes the current turn from history to avoid duplication; independent learning-card evaluation has an empty history. The server validates all bounds.

Prompts use history as context only, evaluate the current answer, avoid repeating sufficiently answered questions, and explicitly prohibit inventing omitted context, work experience or numerical outcomes. Revised answers are labelled improvement examples; unsupported experience must be marked as requiring confirmation rather than attributed to the candidate.

Document extraction creates its AbortController before reading files. Cancel immediately rejects the extraction pipeline and prevents subsequent AI transmission, including when TXT/DOCX readers finish late. PDF cancellation destroys its pdfjs loading/parsing task; every async extraction boundary checks the signal. Extraction has a 60-second deadline. Generated question and follow-up IDs are replaced only after the provider result passes complete validation and original ID uniqueness checks. IDs use the active session namespace (`ai-<session>-<question number>`), keeping distinct interviews separate for member-save deduplication; namespaced IDs stay below 100 characters.
