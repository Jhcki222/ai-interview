# 기업별 내가 만든 질문

기존 001·002가 적용된 Supabase 프로젝트에 `supabase/migrations/003_company_collections.sql`을 **한 번 적용**합니다. Supabase SQL 편집기에서 파일 전체를 실행하거나 마이그레이션 CLI를 사용하세요. 로컬/배포 앱 환경변수는 기존 설정을 그대로 사용합니다. 별도의 비밀 키나 서비스 역할은 이 API에 필요하지 않습니다.

003은 기존 질문을 삭제하거나 새로 만들지 않습니다. `company_id`가 없는 기존 질문은 미분류에 유지됩니다. 기업 폴더를 삭제해도 질문·개인 답변·북마크·학습 상태는 남고 질문의 기업 연결만 비워집니다. FK의 특정 열만 NULL로 설정하는 PostgreSQL 15+ 문법을 사용합니다(Supabase 지원 버전). 회사와 질문의 소유자가 일치해야 하는 복합 FK와 RLS를 함께 적용하므로 직접 PostgREST 요청으로 다른 회원의 기업에 질문을 넣을 수 없습니다.

`내가 만든 질문`에서 기업 추가 → 기업명·지원 직무·단계·선택 마감일 저장 → 기업 카드 열기 → 해당 기업에 질문 추가 흐름으로 사용합니다. 카드의 준비 단계는 준비 중/서류 전형/면접/마무리로 변경할 수 있습니다. 질문의 기업 폴더 선택기와 편집기에서 다른 기업 또는 미분류로 이동합니다. 기업명/직무 검색과 기업 내 질문 검색·카테고리 필터도 실제 저장 데이터를 사용합니다.

API:

- GET `/api/me/companies` → `{companies: CompanyCollection[]}`
- POST `/api/me/companies` `{name,position?,stage?,deadline?}` → `{company}` (201)
- PATCH `/api/me/companies/:id` → 변경할 필드만 전송합니다. DELETE는 폴더 연결만 제거합니다.
- GET `/api/me/questions`는 각 레코드에 `company_id:string|null`을 추가합니다.
- POST `/api/me/questions`는 `{question:Question,company_id?:string|null}`을 지원합니다. 기존 bare Question도 미분류로 저장할 수 있습니다. 같은 원본 ID가 이미 있으면 기존 레코드/기업을 유지합니다.
- PATCH `/api/me/questions/:id`는 `{company_id:uuid|null}`만으로도 기업을 옮길 수 있습니다. `Question` JSON 안에는 기업 필드를 넣지 않습니다.

003을 적용하지 않아 테이블/열이 없으면 해당 API는 가짜 빈 목록 대신 명시적인 `MIGRATION_REQUIRED` (503)와 파일명을 안내합니다. 질문·기업 API는 모두 서버 사용자 검증과 변경 요청 Origin 검증을 거칩니다.

`QuestionCompanyDialog`는 생성 질문의 기업 선택 저장 UI입니다. `question`, `onClose`, `onSaved`, 선택적 `suggestedCompanyName`을 받고 기업 목록을 직접 조회합니다. 생성 결과에 입력된 기업명과 기존 기업명이 정확히 일치하면 해당 폴더를 제안합니다. 실제 저장은 사용자 확인 때만 수행합니다.

단위 테스트는 정규화/검증, 보드 그룹화, 미분류 보존, 소유자 확인 및 마이그레이션 오류 응답을 검사합니다. 실제 DB 검증은 폐기 가능한 테스트 프로젝트에서 `tests/auth-companies-database.sql`을 실행해야 합니다. 이 스크립트는 두 계정의 RLS, 다른 소유자의 기업 할당 거부, 기업 삭제 뒤 질문·답변·북마크 보존을 확인하고 전체 픽스처를 롤백합니다. DB 연결 없이 단위 테스트만 통과한 결과를 실제 RLS 실행 검증으로 표현하지 않습니다.

학습 상태 API는 상태와 북마크를 독립적으로 변경할 수 있습니다. POST `/api/me/progress`의 `{question_key,status}`와 `{question_key,bookmarked}`는 명시한 열만 UPDATE합니다. 새 행이 필요하면 기본값으로 INSERT하고, 동시 생성 충돌이면 요청한 열만 재시도합니다. 따라서 북마크 변경이 다른 요청의 완료 상태를 기본값으로 덮어쓰지 않습니다. 가져오기 스키마는 계속 완전한 상태·북마크 객체를 검증합니다.
