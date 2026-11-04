# 한국어 면접 플랫폼 모델 조사

조사일: **2026-11-04 (Asia/Seoul)**. 공식 제공자 문서·공식 모델 카드·NVIDIA 직원의 공식 포럼 답변만 근거로 사용했다. 계정별 접근 가능 여부와 실제 호출 성공은 문서 등재와 별개다. 이 문서 작성 과정에서 비밀 키를 읽거나 모델을 호출하지 않았다.

## 선택 제안

사용자의 **NVIDIA 우선** 선호와 팀의 실제 호출 검증을 반영해 **NVIDIA `nvidia/nemotron-3-ultra-550b-a55b`를 기본값**, **Groq `openai/gpt-oss-20b`를 비용 중심 대체 후보**로 선택했다. Ultra는 공식 한국어 지원 근거와 한국어 JSON 호출 성공 관측이 함께 있다. Groq 20B에는 구조화 질문 5개 생성 성공 기록도 있다. 복잡한 피드백의 상위 비교 후보는 Groq `openai/gpt-oss-120b`, 다국어·출력 비용 비교 후보는 Ollama Cloud `gemma4:31b`다. 이 선택은 사용자 선호·문서·호출 관측을 결합한 **판단**이며 한국어 벤치마크 순위는 아니다.

2026-11-04 팀이 전달한 한국어 JSON smoke probe 결과는 다음과 같다. NVIDIA Ultra는 HTTP 200·약 2.8초, Groq 20B·120B는 모두 200·0.8초 미만, Ollama Gemma 4·GPT-OSS 20B·120B·Nemotron Super는 모두 200·약 0.5–2초였다. NVIDIA Super는 404, Gemma 4·GPT-OSS 20B는 20–45초 제한 시간 내 완료하지 못했다. 이는 단일 소형 입력의 실행 관측으로 장문·전체 면접 워크플로의 지연이나 성공률을 보장하지 않는다. 이 문서 작성자는 호출하지 않았고 실행 담당 팀의 결과를 전달받았다.

성공 모델만 사용 가능한 선택 목록에 포함하고 NVIDIA의 실패 후보는 현재 기본·자동 대체 목록에서 제외한다. 실패만으로 해당 모델이 영구 불가능하다고 단정하지는 않는다. NVIDIA hosted 체험 계약의 생산 사용 경계는 아래와 같이 별도로 확인한다.

## 공식 가격과 ID

USD / **1,000,000 tokens**, 조사일의 일반 입력·출력 기준이다. **가격은 배포 시 공식 요금표에서 다시 확인한다.** 캐시 입력·배치·프로모션·세금·추론 중 추가 토큰은 실제 청구 조건을 확인해야 한다. 모델별 토크나이저와 출력 길이가 달라 동일한 원문이 동일 토큰 비용이 된다고 가정하지 않는다.

### Groq: 실행 근거와 비용을 우선한 두 후보

| 우선순위 | 정확한 모델 ID | 입력 | 출력 | 선택 이유 |
| --- | --- | ---: | ---: | --- |
| 1 | `openai/gpt-oss-20b` | $0.075 | $0.30 | 저비용 기본 후보, 팀의 구조화 생성 성공 관측 |
| 2 | `openai/gpt-oss-120b` | $0.15 | $0.60 | 복잡한 질문·피드백의 품질 비교 후보 |

두 모델은 공식 Production 목록에 있으며 문맥 131,072, 최대 completion 65,536으로 표기된다. Developer 기본치는 250K TPM·1K RPM이다. 현재 `llama-3.3-70b-versatile`은 Contact Sales여서 예전 $0.59/$0.79를 현재 셀프서비스 가격으로 쓰지 않는다. [Groq 모델·가격표](https://console.groq.com/docs/models)

공식 무료 한도 표의 두 GPT-OSS 모델은 각각 30 RPM, 1,000 RPD, 8,000 TPM, 200,000 TPD다. 조직 단위이며 먼저 도달하는 제한이 적용된다. 계정의 Limits 화면이 최종 기준이고 429의 `retry-after`를 존중해야 한다. 문맥 한도보다 무료 TPM 한도가 먼저 긴 생성 요청을 제한할 수 있다. [Groq 요청 제한](https://console.groq.com/docs/rate-limits)

### Ollama Cloud: 다국어 후보와 저비용 비교군

| 우선순위 | 직접 Cloud API 모델 ID | 입력 | 출력 | 선택 이유 |
| --- | --- | ---: | ---: | --- |
| 1 | `gemma4:31b` | $0.14 | $0.40 | 다국어 공식 평가 근거가 있는 한국어 품질 비교 후보 |
| 2 | `gpt-oss:20b` | $0.07 | $0.30 | Groq 성공 모델과 제공자·지연·품질 비교 |
| 3 | `gpt-oss:120b` | $0.15 | $0.60 | 더 복잡한 답안·평가의 비용 대비 품질 비교 |

Ollama는 현재 토큰 요금을 공개한다. PAYG는 구독료 $0이고 사용량은 별도 유료다. Pro는 월 $20에 $60 사용 크레딧, Max는 월 $100에 $300 크레딧을 포함한다. PAYG·Pro 동시 요청은 3개, Max는 10개다. 새 요금제로 전환하면 기존 세션·주간 제한은 적용되지 않는다고 명시한다. 구독료를 임의의 월 토큰 수로 나눠 다른 API보다 싸다고 단정하지 않는다. 가격표에는 `nemotron-3-super`도 $0.015/$0.60로 나오지만 한국어 지원 근거의 차이 때문에 위의 우선 비교군에는 넣지 않았다. [Ollama 가격·요금제·한도](https://ollama.com/pricing)

직접 API는 `https://ollama.com/api/chat`에서 `/api/tags`가 반환하는 이름을 사용한다. 앱·CLI의 `:cloud` 이름과 혼동하지 않는다. 공식 예시는 직접 API의 `gemma4:31b`를 사용한다. 계정의 사용량·은퇴 안내도 확인한다. [Ollama Cloud 사용법](https://docs.ollama.com/cloud)

### NVIDIA: 체험 평가 대상으로 제한한 세 후보

| 평가 순서 | 모델 ID | 공개된 hosted $/1M | 판단 |
| --- | --- | --- | --- |
| 1 | `nvidia/nemotron-3-ultra-550b-a55b` | 확인되지 않음 | 한국어 명시·실제 JSON 성공. 사용자 선호에 따라 기본 선택 |
| 2 | `google/gemma-4-31b-it` | 확인되지 않음 | 다국어 체험 후보이나 현재 시간 초과로 선택 제외 |
| 3 | `openai/gpt-oss-20b` | 확인되지 않음 | 현재 시간 초과로 선택 제외. 같은 계열은 Groq·Ollama에서 검증 |

모델 ID 등재 근거: [NVIDIA Gemma 4](https://build.nvidia.com/google/gemma-4-31b-it/modelcard), [NVIDIA Nemotron Ultra](https://build.nvidia.com/nvidia/nemotron-3-ultra-550b-a55b/modelcard), [NVIDIA GPT-OSS 20B](https://build.nvidia.com/openai/gpt-oss-20b/modelcard). 모델 카드가 존재한다는 사실을 계정 호출 성공으로 대체하지 않는다.

NVIDIA 직원은 2025-09 답변에서 기존 크레딧 방식이 모델별 체험 요청 제한으로 대체됐고 세부 수치는 공개하지 않으며 계정 화면에서 확인한다고 설명한다. 2026-05 답변도 모델·사용 사례·현재 전체 트래픽에 따라 제한이 달라진다고 설명한다. 따라서 오래된 “가입 1,000·추가 4,000 크레딧”이나 “40 RPM 보장”을 현재 계정의 고정 혜택으로 계산하지 않는다. [크레딧 방식 변경 안내](https://forums.developer.nvidia.com/t/request-more-4-000-credits-option-on-build-nvidia-com/344567), [현재 제한의 가변성 안내](https://forums.developer.nvidia.com/t/clarity-on-nim-api-free-tier-rate-limit-increases/369624)

계약 문서는 limited trial과 production 제한을 별도로 규정하며 생산 사용에는 별도 구독·제공자 조건 확인이 필요하다. **체험 접근을 영구 무료 프로덕션 API로 표현하지 않는다.** 모델 가중치의 상업 이용 라이선스와 NVIDIA hosted 체험 서비스 계약도 서로 다른 문제다. [NVIDIA API Trial Terms](https://assets.ngc.nvidia.com/products/api-catalog/legal/NVIDIA%20API%20Trial%20Terms%20of%20Service.pdf)

## 한국어 성능 근거의 강도

| 모델 | 확인된 공식 근거 | 이 근거로 확정할 수 없는 것 |
| --- | --- | --- |
| Gemma 4 31B | Google 모델 카드의 140+ 언어 사전학습·다국어 지원, MMMLU 88.4% 집계 결과 | 한국어 면접만의 정확도·자연스러움 또는 GPT-OSS 대비 우위 |
| Nemotron 3 Ultra | 공식 지원 언어에 Korean, 후학습 표에 Korean 138k 사례 | 한국어 면접 평가셋의 직접 점수·현재 hosted 지연 |
| Nemotron 3 Super | 한국어 포함 사전학습 크롤, MMLU-ProX 다국어 평균 79.36 | 공식 지원 7개 언어에는 한국어가 없어 “한국어 최적화 모델”이라 단정 불가 |
| GPT-OSS 20B/120B | OpenAI의 저지연·일반 추론 목적 구분, 팀의 20B 한국어 구조화 생성 관측 | 공식 한국어 전용 점수나 두 크기의 한국어 면접 우열 |

Gemma 근거는 [Google 공식 모델 카드](https://ai.google.dev/gemma/docs/core/model_card_4)다. 다국어 집계 점수는 한국어 전용 점수와 구분했다. Google 공식 페이지 사이에서도 MMMLU 수치·라벨이 달리 보이는 경우가 있어 여기서는 상세 모델 카드의 해당 행을 기준으로 기록했다.

Ultra의 한국어 지원·후학습 표는 [NVIDIA 공식 Ultra 카드](https://build.nvidia.com/nvidia/nemotron-3-ultra-550b-a55b/modelcard), Super의 지원 언어·다국어 평가·학습 데이터는 [NVIDIA가 게시한 Super 카드](https://huggingface.co/nvidia/NVIDIA-Nemotron-3-Super-120B-A12B-BF16)에서 확인했다. 사전학습에 한국어가 포함됐다는 사실과 한국어 후학습·공식 지원·서비스별 실제 품질을 분리해야 한다.

GPT-OSS의 모델 목적 설명은 [OpenAI GPT-OSS 20B 문서](https://developers.openai.com/api/docs/models/gpt-oss-20b)와 [120B 문서](https://developers.openai.com/api/docs/models/gpt-oss-120b)를 확인했다. 조사한 공식 자료에서 이 프로젝트에 직접 적용할 한국어 면접 벤치마크 수치는 확인하지 못했다.

## 실제 선택에 필요한 짧은 공통 평가

문서 조사는 후보를 줄이는 근거다. 최종 기본 모델은 같은 비식별 한국어 입력으로 다음을 비교해 고른다.

1. 질문 생성: 요구 수·모든 답안 필드·서로 다른 꼬리질문 2개가 스키마를 통과하는 비율.
2. 사실성: 문서에 없는 경력·수치를 만들지 않는지, 기술적 반례를 제대로 처리하는지.
3. 한국어: 자연스러운 면접 말투·존댓말, 용어 일관성과 장황함·반복.
4. 피드백: 답변 근거 인용, 평가 이유와 개선 방향의 구체성, 과도한 확신 여부.
5. 운영: 완료 시간 p50/p95, 시간 초과·429·5xx·파싱 실패, 실제 입력·출력·추론 토큰과 비용.

적어도 반복 실행과 짧은/긴 문서·오류/주입 입력을 포함한다. 위 smoke 관측을 후보별 품질 승률이나 장문 지연으로 확대하지 않는다. 계정 테스트 결과는 별도 실행 증거에 연결해 갱신해야 한다.
