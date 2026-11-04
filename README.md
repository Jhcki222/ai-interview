# interview.ai

한국어 IT 면접 학습 플랫폼. Next.js 한 프로젝트에서 정적 질문 학습, Supabase 회원 저장, 문서 기반 AI 질문 생성과 대화형 면접을 제공합니다.

## 로컬 실행

Node.js 22 이상을 권장합니다. 개발 환경은 Node 24에서 확인했습니다.

```powershell
npm ci
Copy-Item .env.example .env.local
# .env.local에 연결 값을 입력합니다. 이미 있으면 덮어쓰지 마세요.
npm run dev
```

http://localhost:3000 을 엽니다. 질문 학습은 외부 서비스 없이 동작합니다. 로그인과 영구 저장에는 Supabase가, AI 기능에는 제공자 키와 Supabase 사용량 제한 RPC가 필요합니다. 미설정 기능은 명확한 설정 안내를 표시하며 임의의 성공 결과를 만들지 않습니다.

`.env.local`은 비밀 키가 있는 로컬 파일로 Git과 공유 산출물에서 제외합니다. 실제 키를 `.env.example`, 코드, 문서에 넣지 마세요. 이미 제공한 로컬 Groq 키가 있는 경우 예시 파일로 덮어쓰지 않습니다.

## Supabase 설정

1. Supabase 프로젝트를 준비하고 `.env.local`에 프로젝트 URL, 공개 anon 키와 서버 전용 service role 키를 설정합니다.
2. SQL Editor에서 `supabase/migrations/001_core.sql`, `002_ai_usage.sql` 순서로 실행합니다. 또는 Supabase CLI로 프로젝트에 연결 후 `supabase db push`를 사용합니다.
3. Authentication의 Site URL과 허용 Redirect URLs에 로컬/배포 도메인의 `/auth/callback`을 등록합니다. 개발 도메인 `http://localhost:3000/auth/callback`과 필요하면 `http://127.0.0.1:3000/auth/callback`을 추가합니다.
4. 이메일 확인 정책, SMTP, 로그인/회원가입 요청 제한을 설정합니다. Supabase 내장 Auth 요청 제한과 운영에 적합한 CAPTCHA를 검토합니다.
5. 최소 32자 무작위 `AI_COOKIE_SECRET`을 설정합니다. 예: `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`로 생성한 값을 로컬 환경파일에 직접 입력합니다.

회원 데이터는 RLS로 격리하며 모든 Next.js 회원 API는 서버에서 사용자를 다시 검증합니다. 서비스 역할 키는 AI 사용량 RPC 호출에만 사용합니다. 자세한 계약은 [인증 설정](docs/auth-setup.md)을 참고하세요.

## AI 설정

기본 제공자는 Groq입니다.

```dotenv
AI_PROVIDER=groq
AI_MODEL=openai/gpt-oss-20b
GROQ_API_KEY=YOUR_SERVER_KEY
```

OpenAI를 사용하려면 `AI_PROVIDER=openai`, `AI_MODEL`과 `OPENAI_API_KEY`를 변경합니다. 선택 모델은 AI SDK의 구조화 출력과 필요한 출력 길이를 지원해야 합니다. 모델별 계정 사용량 제한에 따라 10/15문항 요청이 거부되면 질문 수를 줄이거나 제공자 한도를 조정하세요.

Groq는 구조화 출력과 upstream 스트리밍의 동시 지원 제약이 있어 진행 상태를 SSE로 전달하고 검증된 완성 응답을 반영합니다. OpenAI 제공자는 실제 부분 텍스트 미리보기를 표시합니다. 두 제공자 모두 미완성 JSON을 최종 결과로 저장하지 않습니다.

```powershell
# 개인정보 없는 작은 실제 제공자 연결 검사입니다. 소량의 API 사용량이 발생합니다.
node --env-file=.env.local --import=tsx scripts/check-ai.ts
# 비밀 값 없이 설정 여부와 Supabase 테이블 연결을 점검합니다.
node --env-file=.env.local --import=tsx scripts/check-setup.ts
```

AI는 분석 → 사용자 수정 → 질문 생성 → 답변 평가/꼬리질문 → 종합 피드백 순서로 동작합니다. 생성 중에는 임시 텍스트 미리보기와 진행 상태를 표시하고 최종 스키마 검증 후 결과를 반영합니다. 취소, 타임아웃, 재시도와 탭 내 세션 복원을 지원합니다. PDF/DOCX/TXT 원본은 브라우저에서 읽으며 서버로 원본을 영구 저장하지 않습니다. 추출한 텍스트는 AI 제공자에 전송됩니다. 스캔 PDF는 별도 OCR을 거친 텍스트가 필요합니다.

AI 호출은 Supabase의 원자적 UTC 일일 한도로 제어합니다. 비회원 20회, 회원 80회가 기본값이며 Vercel에서는 신뢰되는 ingress IP를 해시한 버킷도 사용합니다. 로컬에서 키만 설정하고 사용량 DB를 생략하면 AI 요청은 안전하게 차단됩니다. 전체 계약과 운영 제약은 [AI 설정](docs/ai-setup.md)을 참고하세요.

## 화면

- `/`: 홈과 추천 질문
- `/questions`, `/questions/[id]`: 검색, 필터, 모범답안, 꼬리질문, 개인 답변
- `/interview`, `/interview/[id]`: 문서 기반 질문 학습과 실전 대화
- `/login`, `/signup`, `/reset-password`: 인증
- `/my/questions`, `/my/answers`, `/my/bookmarks`, `/my/progress`: 회원 라이브러리
- `/settings`: 프로필과 계정 설정

비회원 답변은 현재 탭의 sessionStorage에 임시 보관합니다. 로그인 후 동의하면 저장된 답변을 덮어쓰지 않고 가져옵니다. 회원에게 저장한 질문은 모범답안과 꼬리질문이 포함된 독립 스냅샷입니다.

## 검증

```powershell
npm run validate:content
npm test
npm run typecheck
npm run build
npm start
```

제한된 Windows 임시 폴더에서 Vitest가 EPERM을 반환하면 쓰기 가능한 작업 전용 폴더를 지정한 뒤 실행합니다.

```powershell
New-Item -ItemType Directory -Force .tmp
$env:TEMP = (Resolve-Path .tmp).Path
$env:TMP = $env:TEMP
npm test
```

RLS·DB 트리거 통합 검증은 폐기 가능한 테스트 Supabase에서 `tests/auth-database.sql`을 실행합니다. SQL 테스트 픽스처는 롤백됩니다. 로컬 단위 테스트로 실제 이메일 전달이나 운영 DB 격리 검증을 대체하지 않습니다. 현재 검증 기록은 [검증 보고서](docs/verification.md)에 정리합니다.

## Vercel 배포

1. 소스를 GitHub 저장소에 올리고 Vercel에서 Next.js 프로젝트로 가져옵니다. `.env.local`은 업로드하지 않습니다.
2. `.env.example`의 환경변수를 Vercel 프로젝트의 대상 환경에 등록합니다.
3. Supabase 마이그레이션과 실제 도메인 Redirect URLs를 설정합니다.
4. `npm run build`를 배포 빌드 명령으로 사용합니다. API의 `maxDuration=120`이 배포 플랜에서 지원되는지 확인합니다.
5. 두 테스트 계정의 데이터 격리, 비회원 AI 한도, 이메일 인증/복구, 파일 파싱, 스트리밍과 취소를 실제 배포에서 확인합니다.

별도 Express/Python 서버, Redis, Docker, 벡터 DB는 필요하지 않습니다. Vercel과 Supabase 계정 연결/운영 비밀 키가 없는 상태를 배포 완료로 보고하지 않습니다.

## 디자인과 프로젝트 구조

원본 iOS UI Kit의 컨트롤과 두 번째 Figma 파일의 macOS 사이드바/다이얼로그 구성을 웹에 맞게 적용했습니다. 토큰과 출처는 [디자인 시스템](docs/design-system.md)에 기록했습니다.

`app/`은 라우팅/API, `components/`는 화면과 공통 UI, `lib/`는 인증·AI·문서·질문 로직, `data/questions/`는 사전 작성 질문 JSON, `supabase/migrations/`는 데이터베이스, `tests/`는 동작 및 보안 회귀 검증입니다.
