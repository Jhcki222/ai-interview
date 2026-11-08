# AI 실행 환경 설정

[하네스 설계와 실행 추적](interview-agent.md)에서 요청 흐름과 실패 정책을 설명합니다.

## 환경변수 배치

| 위치 | 설정 |
| --- | --- |
| Next.js | `AI_HARNESS_URL`, `AI_HARNESS_TOKEN`, 기본 선택용 `AI_PROVIDER`와 `AI_MODEL` |
| Python | Next.js와 동일한 `AI_HARNESS_TOKEN`, 최소 하나의 `GROQ_API_KEY`, `NVIDIA_API_KEY`, `OLLAMA_API_KEY` |
| Next.js의 Supabase 연결 | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` 또는 `NEXT_PUBLIC_SUPABASE_ANON_KEY`, `SUPABASE_SECRET_KEY` 또는 `SUPABASE_SERVICE_ROLE_KEY`, `AI_COOKIE_SECRET` |

로컬에서는 두 런타임이 하나의 Git 제외 파일인 `.env.local`을 읽어도 됩니다. 배포에서는 모델 제공자 키를 Python 서비스에 설정합니다. Supabase 연결은 HTTPS API와 RPC를 사용하므로 직접 Postgres 연결 문자열은 필요하지 않습니다.

Supabase에 저장소의 마이그레이션을 적용합니다. 게스트 일일 20회, 회원 일일 80회를 UTC 기준으로 제한하며 Vercel에서는 별도 IP 버킷을 사용합니다. 사용량 RPC 연결이 실패하면 AI 호출도 차단합니다.

## 로컬과 배포 점검

1. [README의 로컬 실행](../README.md#로컬-실행) 절차로 두 서비스를 시작합니다.
2. Python `GET /healthz`에서 프로세스 상태를 확인합니다. Next.js `GET /api/ai/models`에서 원하는 모델이 선택 가능한지 확인합니다. 모델 목록 조회는 추론 비용을 발생시키지 않습니다. NVIDIA와 Ollama의 모델 목록 조회 결과는 60초간 캐시하며 저장소의 허용 목록 안에서만 모델을 표시합니다.
3. `/interview`에서 개인정보가 없는 합성 문서로 분석 → 5문항 생성 → 평가 → 꼬리질문 → 종합 평가를 진행합니다. 취소와 실패 시 UI에 결과가 반영되지 않는지 확인합니다. 이 단계부터 실제 추론 비용이 발생할 수 있습니다.
4. 사용량 RPC 오류가 나면 `node --env-file=.env.local --import=tsx scripts/check-setup.ts`로 키 존재 여부와 Supabase 읽기 연결을 확인합니다. RPC 자체는 실제 경로로 별도 확인합니다.

배포에서 Next.js는 HTTPS로 Python 서비스에 연결합니다. 프록시가 `text/event-stream`을 버퍼링하지 않는지, 연결 시간이 110초의 요청 제한을 수용하는지 확인합니다. 서비스 토큰은 별도 난수로 만들고 양쪽 환경변수를 함께 갱신합니다.
