# interview.ai

한국어 IT 면접 학습 플랫폼. Next.js에서 면접 화면과 Supabase 인증·사용량 제한을 처리하고, Python 하네스에서 문서 분석부터 종합 평가까지 실행합니다.

## AI 실행 구조

`/interview` → `POST /api/ai` → Supabase 사용량 확인 → Python 하네스 → 모델 제공자

- 모델은 답변의 점수와 근거를 생성합니다. Python은 검증한 결과로 꼬리질문, 다음 질문, 종료 중 하나를 제안하고 사용자의 확인을 기다립니다.
- 10·15문항은 5문항씩 병렬 생성합니다. 모든 묶음의 개수와 ID를 검증한 뒤 한 번에 반환합니다.
- 브라우저의 실행 ID로 Next.js와 Python 로그를 연결하고, 제공자 요청 ID가 있으면 Groq 콘솔의 개별 호출까지 찾을 수 있습니다.

[설계 선택과 실패 처리](docs/interview-agent.md) · [배포 및 환경변수](docs/ai-setup.md)

## 로컬 실행

Node.js 24와 Python 3.11 이상을 사용합니다.

```powershell
npm ci
Copy-Item .env.example .env.local
# .env.local에 연결 값을 입력합니다. 이미 있으면 덮어쓰지 마세요.
npm run dev
```

http://localhost:3000 을 엽니다. 질문 학습은 외부 서비스 없이 동작합니다. 로그인과 영구 저장에는 Supabase가 필요합니다. AI 기능은 아래 Python 서비스와 Supabase 사용량 제한 RPC를 사용합니다. 미설정 기능은 명확한 설정 안내를 표시하며 임의의 성공 결과를 만들지 않습니다.

`.env.local`은 비밀 키가 있는 로컬 파일로 Git과 공유 산출물에서 제외합니다. 실제 키를 `.env.example`, 코드, 문서에 넣지 마세요.

## Supabase 설정

1. Supabase 프로젝트를 준비하고 `.env.local`에 프로젝트 URL, 공개 anon 키와 서버 전용 service role 키를 설정합니다.
2. SQL Editor에서 `supabase/migrations/`의 파일을 번호 순서대로 실행합니다. Supabase CLI로 연결한 환경에서는 `supabase db push`를 사용할 수 있습니다.
3. Authentication의 Site URL과 허용 Redirect URLs에 로컬/배포 도메인의 `/auth/callback`을 등록합니다. 개발 도메인 `http://localhost:3000/auth/callback`과 필요하면 `http://127.0.0.1:3000/auth/callback`을 추가합니다.
4. 회원 계정은 간편한 아이디와 숫자 4자리 비밀번호를 사용합니다. Supabase Authentication의 Email Provider 설정에서 "Confirm email"을 비활성화(Off)하면 가입 즉시 별도 이메일 인증 절차 없이 바로 로그인 및 세션이 유지됩니다.
5. 최소 32자 무작위 `AI_COOKIE_SECRET`을 설정합니다. 예: `node -e "console.log(require('node:crypto').randomBytes(32).toString('hex'))"`로 생성한 값을 로컬 환경파일에 직접 입력합니다.

회원 데이터는 RLS로 격리하며 모든 Next.js 회원 API는 서버에서 사용자를 다시 검증합니다. 서비스 역할 키는 AI 사용량 RPC 호출에만 사용합니다. 자세한 계약은 [인증 설정](docs/auth-setup.md)을 참고하세요.

## AI 설정

기본 모델은 Groq GPT-OSS 20B입니다. `.env.local`에 `GROQ_API_KEY`와 32자 이상의 무작위 `AI_HARNESS_TOKEN`을 설정합니다. Next.js의 `AI_HARNESS_URL`은 로컬에서 `http://127.0.0.1:8000`입니다.

별도 터미널에서 Python을 실행합니다.

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r python_harness/requirements.txt
.\.venv\Scripts\python.exe -m uvicorn python_harness.app:app --host 127.0.0.1 --port 8000 --env-file .env.local
```

브라우저가 PDF/DOCX/TXT에서 텍스트를 추출하고 면접 요청에 필요한 텍스트만 서버로 전송합니다. 진행 상태는 SSE로 받고, 응답 전체가 검증되면 화면에 반영합니다. Python 서버에서 [실행 추적](docs/interview-agent.md#로그로-요청-출처-찾기)을 확인할 수 있습니다.

## 화면

- `/`: 홈과 추천 질문
- `/questions`, `/questions/[id]`: 검색, 필터, 모범답안, 꼬리질문, 개인 답변
- `/interview`, `/interview/[id]`: 문서 기반 질문 학습과 실전 대화
- `/login`, `/signup`, `/reset-password`: 인증 (아이디와 숫자 4자리 비밀번호)
- `/my/questions`, `/my/answers`, `/my/bookmarks`, `/my/progress`: 회원 라이브러리
- `/settings`: 프로필과 계정 설정

비회원 답변은 현재 탭의 sessionStorage에 임시 보관합니다. 로그인 후 동의하면 저장된 답변을 덮어쓰지 않고 가져옵니다. 회원에게 저장한 질문은 모범답안과 꼬리질문이 포함된 독립 스냅샷입니다.

## 검증

```powershell
npm run validate:content
npm test
npm run typecheck
python -m unittest discover -s python_harness/tests -v
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

RLS·DB 트리거 통합 검증은 폐기 가능한 테스트 Supabase에서 `tests/auth-database.sql`을 실행합니다. SQL 테스트 픽스처는 롤백됩니다. 로컬 단위 테스트로 실제 이메일 전달이나 운영 DB 격리 검증을 대체하지 않습니다. 하네스의 자동 테스트 범위는 [설계 문서](docs/interview-agent.md#검증-범위)에 정리했습니다.

## 배포

1. Python 서비스를 HTTPS 주소를 제공하는 컨테이너 호스트에 배포합니다. 빌드 컨텍스트는 `python_harness/`입니다. 로컬 이미지 빌드 명령은 `docker build -t interview-harness ./python_harness`입니다.
2. Vercel에 Next.js를 배포합니다. `AI_HARNESS_URL`에 Python 서비스 주소를 설정하고 양쪽에 동일한 `AI_HARNESS_TOKEN`을 등록합니다. 모델 제공자 키는 Python 호스트의 비밀 환경변수로 설정합니다.
3. Supabase 마이그레이션과 인증 Redirect URL을 적용합니다. Vercel의 함수 제한이 `maxDuration=120`을 수용하고 Python 프록시가 SSE를 버퍼링하지 않는지 확인합니다.
4. [운영 점검 순서](docs/ai-setup.md#로컬과-배포-점검)에 따라 합성 입력으로 실제 추론과 사용량 차감을 확인합니다.

## 디자인과 프로젝트 구조

원본 iOS UI Kit의 컨트롤과 두 번째 Figma 파일의 macOS 사이드바/다이얼로그 구성을 웹에 맞게 적용했습니다. 토큰과 출처는 [디자인 시스템](docs/design-system.md)에 기록했습니다.

`app/`은 라우팅/API, `components/`는 화면과 공통 UI, `lib/`는 인증·AI·문서·질문 로직, `data/questions/`는 사전 작성 질문 JSON, `supabase/migrations/`는 데이터베이스, `tests/`는 동작 및 보안 회귀 검증입니다.
