# Platform Refinements — approved user steering

The user requested these extensions while the original platform implementation was active. Preserve current committed social-login and carousel work in this shared checkout.

1. Company library: rename to 내가 만든 질문, persist owner-scoped company collections, organize cards by preparation/application/interview/completion, assign questions and preserve existing unassigned records. Delete collection moves records to unassigned. Separate SQL003 migration, RLS and API validation.
2. AI model choice: NVIDIA default, server-only NVIDIA/Groq/Ollama/OpenAI credentials, Korean-capable model allowlist, explicit selection UI, readiness status, elapsed time and sanitized actionable errors. Bounded retries and opt-in cross-provider fallback must work within Vercel request limits. Never expose secrets or accept arbitrary provider URLs.
3. Bookmarks: stable list/grid cards, independent answer disclosures, consistent compact control positions, separate status and bookmark writes to avoid racing updates, optimistic unbookmark with undo and reliable rollback, filters/count/loading/error/empty states.
4. Home category carousel: preserve user-added CircularCarousel behavior, replace saturated dark category colors with light slate/indigo coordinated palettes and readable typography. Respect dark mode/reduced motion.
5. Finish known hydration/import defect: gate read-dependent member writes until successful state hydration, retry failed reads, conditional non-overwriting server import, byte-bounded batches. Verify before new UI relies on the store.

Validation: meaningful unit tests, actual synthetic NVIDIA/Korean/provider fallback checks, Supabase schema readiness without leaking keys, typecheck, full tests/content validation, production build and browser responsive checks. User already added Vercel env vars; do not request the same values again. Apply additive migrations to deployed schema before claiming new database features live.
