# Interview Platform Implementation Plan

> For agentic workers: use subagent-driven-development to execute bounded subsystems and review their integration.

**Goal:** 실제 질문 학습, Supabase 개인 저장과 문서 기반 AI 면접을 제공한다.
**Architecture:** 단일 Next.js App Router 앱, 정적 JSON, Supabase SSR/RLS, 서버 전용 AI SDK.
**Tech Stack:** TypeScript, Next.js 16, React 19, Tailwind 4, shadcn/ui, Supabase, AI SDK 6, Zod 4.
**Spec:** docs/superpowers/specs/2026-11-04-interview-platform-design.md (사용자 승인 완료)

## Global Constraints

별도 백엔드/Redis/컨테이너 금지. 가짜 AI/인증 성공 금지. 비회원 sessionStorage, 회원 RLS. 문서 원본 영구 저장 금지. 전체 라우트와 최소 380문항 목표. 사용자 지정 C:/interview-ai 체크아웃에서 작업한다. 신규 빈 폴더이므로 worktree를 만들지 않는다.

## Task 1: Scaffold and visual shell

Files: package.json, tsconfig.json, next.config.ts, app/layout.tsx, app/globals.css, components/ui/*, components/layout/*, app/page.tsx.

- [ ] Install dependencies and record resolved versions in lockfile.
- [ ] Implement shadcn-compatible Button/Dialog and theme provider; sidebar/header from Figma reference.
- [ ] Create compact Korean home with both task entry points and true seed question counts.
- [ ] Run typecheck/build and browser desktop/mobile review.

## Task 2: Question content and filtering

Files: data/questions/*.json, lib/questions.ts, scripts/validate-content.ts, tests/questions.test.ts.
Interface: Question from types/question.ts; export questions: Question[], categories: {id: CategoryId; name: string; description: string}[], getQuestion(id): Question | undefined.

- [ ] Write content validation test rejecting duplicate IDs and missing follow-up answers; run and observe failure.
- [ ] Author 380 technically reviewed base questions with model answers and two follow-ups each.
- [ ] Implement filtering for search, category, subcategory, difficulty, importance.
- [ ] Validate content, category totals and run tests.

## Task 3: Authentication and member persistence

Files: lib/supabase/*, lib/auth/*, proxy.ts, app/api/me/*, app/(auth)/*, app/auth/*, app/(protected)/*, supabase/migrations/*.sql, tests/security.test.ts.
Interface: server getUser(): Promise<User|null>; browser createClient(); API GET /api/me/state -> {answers: Record<string,string>, progress: Record<string,Progress>}; POST /api/me/answers {question_key,answer_text}; POST /api/me/progress {question_key,status,bookmarked}; GET/POST /api/me/questions; PATCH/DELETE /api/me/questions/[id]. Auth provider exposed through components/auth/auth-provider.tsx: useAuth() -> {user: {id:string,email?:string,nickname?:string}|null, configured:boolean, loading:boolean, signOut:()=>Promise<void>}.

- [ ] Write tests for safe redirects and payload validation, observe failure.
- [ ] Add SSR cookies, server user verification, safe redirects, auth forms and recovery.
- [ ] Implement ownership-checked CRUD and four RLS tables; rate limiter SQL owned by AI task in separate migration.
- [ ] Add protected account pages, actual database progress, CRUD editor, settings.
- [ ] Run tests and typecheck; document credential-dependent integration checks.

## Task 4: AI and document processing

Files: lib/ai/*, lib/documents/*, app/api/ai/*, components/interview/*, app/interview/*, supabase/migrations/002_ai_usage.sql, tests/interview.test.ts.
Interface: shared Question type; server AI env OPENAI_API_KEY/AI_MODEL; use /api/me/questions to persist generated questions. Main UI primitives are button, dialog and class utilities. Use plain CSS classes from global semantic styles when useful.

- [ ] Write tests for illegal state transitions, file limits and invalid AI responses, observe failure.
- [ ] Implement server validated analyze/generate/evaluate/follow-up/interview endpoints, SSE progress then validated completion event.
- [ ] Implement persistent atomic Supabase usage limit with signed guest identity/IP hash; fail closed when unavailable.
- [ ] Implement PDF/DOCX/TXT extraction, editable analysis, setup and generated question list.
- [ ] Implement restorable interview state machine, answer evaluation and follow-up dialogue, cancellation/retry and final summary.
- [ ] Run tests and typecheck; record live-provider verification boundary.

## Task 5: Learning UI and integration

Files: components/questions/*, hooks/use-learning.ts, app/questions/*, tests/learning.test.ts.

- [ ] Test independent filtering and safe session restore before implementing data handling.
- [ ] Implement question list, independent answer/follow-up toggles, editor, save/login dialog, bookmarks and status.
- [ ] Connect authenticated persistence, guest session drafts and consent-based import.
- [ ] Review all route integration; run content validation, unit tests, typecheck, production build and browser flows.

## Task 6: Final review and handoff

Files: README.md, .env.example, docs/verification.md, docs/design-system.md.

- [ ] Review specification compliance and code quality with a separate reviewer.
- [ ] Address observed security, state and UI defects and rerun affected checks.
- [ ] Document local setup, migrations, Supabase redirect allowlist, Vercel secrets, AI limits, external integration status.
- [ ] Handoff a runnable local application and accurate completed/pending verification record.
