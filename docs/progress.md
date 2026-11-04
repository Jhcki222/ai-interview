# SDD ledger — plan: docs/superpowers/plans/2026-11-04-interview-platform.md

User approved design on 2026-11-04 and requested implementation with updated Figma reference.

Ruling: Use the provided empty C:/interview-ai checkout without creating another worktree — there is no existing repository or branch to isolate.
Ruling: Keep Next.js/Vercel deployment path from explicit user specification; do not replace it with Sites hosting.
Ruling: hallmark/impeccable are absent from installed skill directories and optional; continue with available Figma skills.

| Tasks | Shared interface | Preflight result |
| --- | --- | --- |
| 1,2,5 | types/question.ts and Question | Contract defined before dispatch |
| 1,3,5 | Auth provider and semantic UI styles | Auth owns provider; root owns shared UI |
| 3,4 | Supabase and migrations | 001 auth CRUD; 002 AI rate limit, separate files |
| 4,5 | Question and save endpoint | Question follows shared type |
| 1–6 | Dependency manifest | Root owns package edits and installation |

Task 1: complete — common tokens, shadcn/Radix primitives, responsive home/sidebar, dark mode; initial production build and browser desktop/mobile review passed.
Task 2: in progress — content author delivered CS100/BACKEND100/AI82, remaining categories and required topic coverage being finalized.
Task 3: implementation complete, final fixes in progress — SSR auth, RLS SQL, member CRUD and dashboards. Independent reviewer findings fixed: saved-question learning entry; DB JSON validation; parent deletion race; account owner gates. Live database/email tests await Supabase configuration.
Task 4: implementation complete, final fixes in progress — real provider analysis/generation, forms, uploads, session state, evaluations, bounded conversation history. Groq live connectivity and synthetic analysis + five-question generation/save validation passed. Groq structured mode uses generateText because upstream structured streaming failed; OpenAI keeps native streaming preview.
Task 5: complete pending final whole-app verification — question search/filter/independent toggles/guest drafts/member persistence. Independent review fixes: auth epoch guards, logout clearing, URL filter synchronization, pagination clamp, guest progress consent import. Browser draft refresh and combined search/difficulty filters passed.
Task 6: in progress — README, env example, design mapping, Vercel config present. Reviewer and final content/build verification pending.

Ruling: New user-supplied key is a Groq server credential. Stored only in ignored .env.local; no key material in source/docs/output. Official Groq SDK added. Public app AI stays fail-closed until persistent Supabase limiter is configured.
Ruling: User is creating a Supabase project. Provided field-by-field setup guidance; no external project/account creation or deployment claimed.
