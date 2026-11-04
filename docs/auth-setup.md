# 회원 저장과 인증 설정

1. Supabase 프로젝트에서 SQL 편집기 또는 `supabase db push`로 `supabase/migrations/001_core.sql`을 적용합니다. 다른 AI 사용량 마이그레이션도 별도로 적용합니다.
2. 프로젝트의 URL과 공개 anon/publishable 키를 `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`에 설정합니다. 서비스 역할 키는 이 회원 API에 사용하지 않습니다.
3. Authentication → URL Configuration에서 Site URL을 실제 배포 URL로 설정하고 Redirect URLs에 `http://127.0.0.1:3000/auth/callback`, `https://YOUR_DOMAIN/auth/callback`을 허용합니다. 로컬 도메인을 localhost로 변경하면 해당 URL도 등록합니다.
4. 이메일 인증을 활성화하고 SMTP를 설정합니다. 회원가입과 비밀번호 복구 메일의 링크는 Supabase가 제공하는 `ConfirmationURL`을 유지합니다. PKCE code 교환은 `/auth/callback`에서 이루어집니다. 복구 후 `/auth/update-password`로 이동합니다.

SSR 쿠키는 Supabase SSR이 관리하고 proxy가 갱신합니다. 모든 회원 API는 서버에서 `getUser()`로 검증하고, 변경 요청은 동일 출처 Origin을 요구합니다. 브라우저에서 JWT를 수동 저장하지 않습니다. `base:<정적 질문 ID>`와 `saved:<UUID>`는 다른 키입니다. 저장 질문에는 모범답안과 꼬리질문을 포함한 스냅샷이 저장됩니다.

GET `/api/me/state`는 `{answers,progress,updatedAt}`, GET `/api/me/questions`는 `{questions:[{id,question,note,created_at,updated_at}]}`를 반환합니다. `updatedAt`는 질문 키별 답변·진행 기록의 가장 최근 DB `updated_at` 값이며 기존 학습 훅은 추가 필드를 무시할 수 있습니다. POST `/api/me/questions`는 전체 Question 또는 `{question:Question}`을 받고 새 레코드를 `{question:record}`로 반환합니다. PATCH `/api/me/questions/:id`는 `{question?,note?}`를 받습니다. 회원 ID는 요청 본문으로 받지 않습니다. 원본 질문 저장 후 새 레코드 키는 응답의 DB UUID로 구성합니다.

같은 사용자의 동일 `Question.id`는 DB의 생성 열 `source_question_id`와 UNIQUE 제약으로 한 번만 저장됩니다. 동시 저장에서 첫 요청은 201, 중복 요청은 기존 레코드와 `alreadySaved:true`를 200으로 반환하고 기존 개인 답안·메모를 덮어쓰지 않습니다. 생성 질문의 ID는 세션별 접두사를 포함해야 다른 면접에서 모델이 재사용한 `q1` 같은 ID가 충돌하지 않습니다. 설정된 프로젝트의 `/my/*`, `/settings` 비회원 요청은 경로·쿼리를 `next`로 보존하여 로그인으로 이동합니다. 설정이 없으면 설정 필요 안내를 유지합니다.

외부 연결이 없을 때 API는 503, 인증되지 않았으면 401을 반환합니다. 임의의 회원 기록이나 성공 결과는 만들지 않습니다. 로컬 단위 테스트는 경로와 입력 검증만 확인합니다. 실제 프로젝트에서 서로 다른 두 계정으로 CRUD와 RLS 격리, 이메일 확인, 복구, 세션 갱신, 저장 질문 삭제 시 연결된 학습 기록 정리를 확인해야 합니다.

내 질문의 각 카드에서 처음부터 개인 답변, 학습 상태와 북마크를 저장할 수 있습니다. 모든 학습 요청은 원본 스냅샷 ID 대신 해당 저장 레코드 UUID를 사용한 `saved:<UUID>`로 전송합니다. 원본 질문과 여러 개인 사본의 기록은 서로 독립적입니다.

내 질문은 질문·주제·키워드·메모 검색과 카테고리 필터를 지원합니다. 편집에서 카테고리와 하위 분류, 난이도·중요도, 답안과 꼬리질문을 수정할 수 있습니다. 꼬리질문은 2~20개를 유지합니다. 학습 현황의 분모는 기본 질문과 개인 사본의 합계이며, 공백뿐인 답변은 답변 작성 수에 포함하지 않습니다. 최근 기록은 실제 질문 저장·학습 기록의 DB 변경 시각을 사용합니다. 회원 화면은 로드한 레코드를 소유자 ID로 구분하고 로그아웃·계정 변경 즉시 숨기며 이전 계정의 지연 응답을 반영하지 않습니다.

가입·로그인·비밀번호 변경은 React Hook Form과 Zod로 2~20자 아이디(영문/숫자/한글/밑줄), 숫자 4자리 비밀번호, 일치하는 확인 입력, 앞뒤 공백을 제거한 2~40자 닉네임을 검증합니다. Supabase 내부에서는 아이디와 4자리 비밀번호를 안전한 매핑과 결정적 솔트로 변환하여 GoTrue의 최소 길이 제약을 투명하게 만족합니다. 이메일 확인이 비활성화된 Supabase 프로젝트 환경에서 가입 즉시 세션을 발급하여 내부 복귀 경로로 이동합니다.

데이터베이스도 Question JSON의 필수 필드와 길이, 모든 모범답안 영역, 두 개 이상의 완전한 꼬리질문을 검사합니다. 따라서 인증된 클라이언트가 Next.js API를 우회하여 PostgREST로 직접 쓸 때도 깨진 스냅샷을 저장할 수 없습니다. 개인 질문 참조 트리거는 부모 행에 `FOR KEY SHARE` 잠금을 잡아 답변 삽입과 부모 삭제를 직렬화합니다.

폐기 가능한 Supabase 테스트 프로젝트에 마이그레이션을 적용한 뒤 `psql -v ON_ERROR_STOP=1 -f tests/auth-database.sql "$TEST_DATABASE_URL"`로 JSON 무결성, 두 계정의 RLS 격리, 다른 소유자의 질문 참조 거부와 삭제 정리를 검사할 수 있습니다. SQL 테스트의 모든 픽스처는 롤백됩니다. 이 스크립트는 실제 PostgreSQL 연결을 요구하며 로컬 Vitest 성공만으로 실행했다고 보고하지 않습니다. 경합은 두 DB 세션에서 부모 삭제와 자식 삽입을 각각 미커밋 상태로 실행해 다른 세션이 기다리는지, 최종 커밋 뒤 고아 참조가 없는지 추가로 확인합니다.
