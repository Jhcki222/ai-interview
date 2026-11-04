# 정적 질문 콘텐츠 작성·검토 기록

작성일: 2026-11-04. 기본 콘텐츠는 정적 JSON이며 실행 중 AI를 호출해 생성하지 않는다. `scripts/author-content.py`는 편집 원고를 보존하는 작성 도구이며 앱은 `data/questions/*.json`만 읽는다.

기준 분량은 CS 100, BACKEND 100, AI 80, PERSONALITY 30, MOTIVATION 20, BUSINESS 20, PROJECTS 30이다. 각 주제는 개념 또는 경험 설명과 별도의 적용·판단 질문으로 구성했다. 같은 주제의 두 질문은 학습 연결성을 위해 구체적인 후속 질문 두 개를 공유한다. 인성·동기·프로젝트 예시는 답변 구성 또는 가정 예시이며 사용자가 실제 수행한 경력을 대신 주장하지 않는다. 기업 영역에는 특정 기업의 미확인 매출·조직문화·기술 스택을 넣지 않았다.

## 확인한 1차 기술 자료

| 자료 | 검토 범위와 반영한 경계 |
| --- | --- |
| [PostgreSQL 트랜잭션 격리](https://www.postgresql.org/docs/current/transaction-iso.html) | 격리 현상과 구현별 차이, Serializable의 충돌·전체 재시도 필요성을 구분한다. |
| [MDN HTTP 개요](https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Overview) | 요청·응답, 무상태와 애플리케이션 상태를 구분한다. |
| [Python asyncio](https://docs.python.org/3/library/asyncio.html) | 동시 I/O와 CPU 병렬 작업을 같은 의미로 취급하지 않는다. |
| [scikit-learn Common pitfalls](https://scikit-learn.org/stable/common_pitfalls.html) | 분할 전 전처리 학습에 의한 누수와 훈련·검증 변환 일관성을 설명한다. |
| [Spring 의존성 주입](https://docs.spring.io/spring-framework/reference/core/beans/dependencies/factory-collaborators.html) | 컨테이너가 의존을 공급하는 원리와 생성자 주입의 명시성을 설명한다. |
| [Spring AOP 프록시](https://docs.spring.io/spring-framework/reference/core/aop/proxying.html) | 프록시 기반 AOP의 self-invocation·final·가시성 제약을 구분한다. |
| [Spring 선언적 롤백](https://docs.spring.io/spring-framework/reference/data-access/transaction/declarative/rolling-back.html) | 기본 unchecked 예외 롤백과 설정 가능한 checked 예외 규칙을 구분한다. |

자료 문장을 복제한 문제집이 아니라 위 원리를 포함한 독자적인 한국어 학습 설명이다. 버전·DB·런타임에 따라 달라지는 항목은 적용 전제를 명시했다. 모든 예시를 실제 운영 환경에서 실행했다는 의미는 아니다.

## 검증

콘텐츠 작업 시 `npm run validate:content`에서 **380개 질문·760개 답안 포함 후속 질문·7개 분류**가 검증됐다. `tests/questions.test.ts`의 4개 테스트도 통과했다. 테스트는 필수 필드·중복 ID/질문·후속 답안 누락·유형별 분량과 검색/복수 필터 AND 동작을 검증한다. 기술 설명의 완전한 정확성은 구조 검사만으로 보장되지 않으므로 편집 검토 대상이다.

초기 빈 JSON 상태에서 분량 테스트 실패를 관측한 뒤 작성했다. Windows sandbox 기본 TEMP 경로에서 도구의 임시 파일 rename 권한 오류가 발생해 작업 폴더의 `.tmp`를 TEMP/TMP로 지정한 후 테스트를 실행했다.

향후 JSON을 직접 편집한 경우 작성 도구와 동기화하기 전 재실행하면 수정이 덮일 수 있다. 원고와 JSON을 함께 갱신하고 전체 콘텐츠 검증을 다시 수행한다.
