"""
Reauthor and enhance curriculum script.
Transforms all 400 questions into professional verbal interview speech,
builds structured framework answers for open-ended questions,
fixes grammar and particles, and enriches the dataset.
"""
import json
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
QUESTIONS_DIR = ROOT / 'data' / 'questions'

import sys
sys.path.insert(0, str(ROOT / 'scripts'))

def josa(word: str, pair: str = "을/를") -> str:
    if not word: return word
    last_char = word[-1]
    code = ord(last_char)
    if 0xAC00 <= code <= 0xD7A3:
        has_batchim = (code - 0xAC00) % 28 > 0
    else:
        has_batchim = last_char in "013678lmnrLMNR"
    first, second = pair.split("/")
    return f"{word}{first if has_batchim else second}"

def convert_word(w: str) -> str:
    if w.endswith(('습니다', '입니다', '옵니다', '십니까', '입니까', '습니까', '시지요', '세요', '인가요', '나요', '지요')):
        return w
    
    specific = {
        '다르다': '다릅니다',
        '빠르다': '빠릅니다',
        '느리다': '느립니다',
        '크다': '큽니다',
        '작다': '작습니다',
        '좋다': '좋습니다',
        '많다': '많습니다',
        '적다': '적습니다',
        '높다': '높습니다',
        '낮다': '낮습니다',
        '같다': '같습니다',
        '어렵다': '어렵습니다',
        '쉽다': '쉽습니다',
        '깊다': '깊습니다',
        '넓다': '넓습니다',
        '길다': '깁니다',
        '그렇다': '그렇습니다',
        '아니다': '아닙니다',
        '없다': '없습니다',
        '있다': '있습니다',
        '맞다': '맞습니다',
        '바쁘다': '바쁩니다',
        '예쁘다': '예쁩니다',
        '나쁘다': '나쁩니다',
        '모르다': '모릅니다',
        '이르다': '이릅니다',
        '부르다': '부릅니다',
        '않다': '않습니다',
        '달렸다': '달려 있습니다',
        '같은지다': '같은지 살펴봅니다',
        '위해서다': '위해서입니다',
        '그대로다': '그대로입니다',
        '때다': '때입니다',
        '누수다': '누수입니다',
        '단서다': '단서입니다',
        '신호다': '신호입니다',
        '축소다': '축소입니다',
        '트리다': '트리입니다',
        '한계다': '한계입니다',
        '문제다': '문제입니다',
        '객체다': '객체입니다',
        '결과다': '결과입니다',
        '과제다': '과제입니다',
        '구조다': '구조입니다',
        '단계다': '단계입니다',
        '단위다': '단위입니다',
        '데이터다': '데이터입니다',
        '도구다': '도구입니다',
        '별개다': '별개입니다',
        '별도다': '별도입니다',
        '상태다': '상태입니다',
        '수치다': '수치입니다',
        '순서다': '순서입니다',
        '의미다': '의미입니다',
        '거부다': '거부입니다',
        '경계다': '경계입니다',
    }
    for k, v in specific.items():
        if w.endswith(k):
            return w[:-len(k)] + v
            
    # Past tense
    if w.endswith('했다'): return w[:-2] + '했습니다'
    if w.endswith('됐다'): return w[:-2] + '되었습니다'
    if w.endswith('였다'): return w[:-2] + '였습니다'
    if w.endswith('았다'): return w[:-2] + '았습니다'
    if w.endswith('었다'): return w[:-2] + '었습니다'
        
    # Future tense
    if w.endswith('겠다'):
        return w[:-2] + '겠습니다'
        
    # ~하다 / ~되다
    if w.endswith('하다'):
        return w[:-2] + '합니다'
    if w.endswith('되다'):
        return w[:-2] + '됩니다'

    # ~는다 (consonant-stem verbs: 남는다, 먹는다, 겪는다, 담는다, 막는다, 묶는다, 묻는다, 삼는다)
    if len(w) >= 3 and w.endswith('는다'):
        return w[:-2] + '습니다'
        
    # ~ㄴ다 (vowel-stem verbs: 달라진다, 건너뛴다, 높인다, 보낸다, 만든다, 결정된다, 확인한다)
    if len(w) >= 2:
        ch = w[-2]
        code = ord(ch) - 0xAC00
        if 0 <= code <= 11171:
            final = code % 28
            if final == 4: # 받침 ㄴ
                new_ch = chr(ord(ch) - 4 + 17) # change to 받침 ㅂ
                return w[:-2] + new_ch + '니다'
                
    # ~이다 / noun+다 (개념이다 -> 개념입니다, 객체다 -> 객체입니다, 결과다 -> 결과입니다)
    if w.endswith('이다'):
        return w[:-2] + '입니다'
        
    # Non-alphanumeric or percentage + 다
    if w.endswith(('%다', ')다', '>다', '`다', '1다', '2다')):
        return w[:-1] + '입니다'

    # Noun ending in 다 (like 구조다, 과제다, 계층다, 방식다)
    if len(w) >= 2:
        ch = w[-2]
        code = ord(ch) - 0xAC00
        if 0 <= code <= 11171 and (code % 28 == 0):
            return w[:-1] + '입니다'

    # Fallback default
    if w.endswith('다'):
        return w[:-1] + '습니다'
    return w

def convert_token(token: str) -> str:
    m = re.match(r'^(.*?)(\)+|\"+|\'+|”+|\’+|\>+|\]+)?$', token)
    if not m:
        return convert_word(token)
    core = m.group(1)
    punct = m.group(2) or ''
    return convert_word(core) + punct

def to_interview_tone(text: str) -> str:
    if not text:
        return text
    
    lines = text.split('\n')
    out_lines = []
    
    for line in lines:
        stripped = line.strip()
        if stripped.startswith('[') and stripped.endswith(']'):
            out_lines.append(line)
            continue
            
        parts = re.split(r'(\.(?:\s+|$))', line)
        rebuilt = []
        for i in range(0, len(parts)-1, 2):
            sentence = parts[i]
            delim = parts[i+1]
            
            m = re.search(r'([^\s]+)$', sentence)
            if m:
                last_word = m.group(1)
                prefix = sentence[:m.start()]
                new_word = convert_token(last_word)
                rebuilt.append(f'{prefix}{new_word}{delim}')
            else:
                rebuilt.append(f'{sentence}{delim}')
        if len(parts) % 2 == 1 and parts[-1]:
            rebuilt.append(parts[-1])
            
        out_lines.append(''.join(rebuilt))
        
    res = '\n'.join(out_lines)
    res = res.replace(' 이 판단의 근거는 다음과 같습니다. ', ' 이러한 판단을 내린 이유는 ')
    return res

def run():
    source_path = ROOT / 'scripts' / 'author-content.py'
    scope = {'__file__': str(source_path)}
    with open(source_path, 'r', encoding='utf-8') as f:
        code = f.read()
    
    exec_code = code.split('def emit():')[0]
    exec(exec_code, scope)
    CONTENT = scope['CONTENT']

    # Add advanced topics
    scope['add']('CS', '데이터베이스', '''Next-Key Lock과 팬텀 리드|MySQL InnoDB는 레코드 락과 갭 락을 결합한 Next-Key Lock을 사용하여 Repeatable Read 격리 수준에서도 팬텀 리드를 방지합니다. 인덱스 레코드와 그 앞쪽 갭을 함께 잠금으로써 동시 트랜잭션의 새로운 행 삽입을 원천 차단합니다.|온라인 티켓 예매 시스템에서 좌석 번호 범위를 조회하고 예약할 때 Next-Key Lock이 적용되어 다른 트랜잭션이 해당 구간에 동일 좌석을 삽입하지 못하도록 방어합니다.|갭 락(Gap Lock)과 레코드 락(Record Lock)의 차이는 무엇인가요?|레코드 락은 인덱스에 존재하는 특정 레코드 자체만 잠그는 반면, 갭 락은 인덱스 레코드 사이의 빈 공간을 잠가 새로운 레코드의 삽입을 막는 잠금입니다.|Next-Key Lock으로 인해 데드락이 빈번하게 발생하면 어떻게 대처하나요?|인덱스 유무와 쿼리 조건을 점검하여 불필요한 범위 잠금을 방지하고, 필요한 경우 격리 수준을 Read Committed로 낮추고 레코드 락 위주로 운용하며 애플리케이션 레벨에서 동시성을 제어합니다.|동시 주문 처리 시 동일한 범위 검색에서 팬텀 리드 현상이 발생하지 않도록 어떻게 설계하나요?|InnoDB의 기본 격리 수준인 Repeatable Read에서 Next-Key Lock이 동작하도록 적절한 인덱스를 설정하고, 비즈니스 무결성이 필요한 핵심 트랜잭션에는 명시적인 비관적 락(SELECT FOR UPDATE)을 활용합니다.
페이지 폴트와 MMU|페이지 폴트는 프로세스가 접근하려는 가상 메모리 페이지가 물리 RAM의 페이지 프레임에 로드되어 있지 않을 때 MMU가 하드웨어 인터럽트를 발생시켜 커널에 로딩을 요청하는 현상입니다.|대용량 파일을 mmap으로 메모리에 매핑한 후 순차 접근할 때 실제 참조 시점에 페이지 폴트가 발생하며 필요한 블록만 지연 로딩(Demand Paging)됩니다.|Minor Page Fault와 Major Page Fault는 어떻게 다른가요?|Minor Page Fault는 디스크 I/O 없이 메모리 내 캐시나 공유 메모리 매핑으로 즉시 해결되는 반면, Major Page Fault는 디스크 스왑 영역이나 파일 시스템에서 실제 I/O를 수행해야 하므로 수만 배의 지연 시간이 발생합니다.|스래싱(Thrashing) 현상은 어떻게 해결하나요?|프로세스들의 작업 집합(Working Set) 크기 합이 물리 RAM 용량을 초과했기 때문이므로, 동시 실행 프로세스 수를 제한하거나 메모리를 증설하고 워킹 셋 알고리즘으로 페이지 할당을 조절해야 합니다.|메모리 집중 배치 작업 실행 시 스래싱 현상이 발생하여 서버 전체가 무반응 상태가 되면 어떻게 진단하고 개선하나요?|vmstat과 iostat으로 swap in/out 및 디스크 I/O 대기율을 실시간 모니터링하고, 프로세스의 힙 메모리 한도를 재조정하거나 메모리 누수를 프로파일링하여 작업 셋을 물리 메모리 범위 내로 제한합니다.
''')

    scope['add']('BACKEND', 'API·인증·운영', '''Saga 패턴과 분산 트랜잭션|Saga 패턴은 MSA 환경에서 2PC(2-Phase Commit)의 성능 저하 없이 로컬 트랜잭션과 보상 트랜잭션(Compensating Transaction)을 연속적으로 실행하여 최종 일관성(Eventual Consistency)을 달성하는 분산 트랜잭션 패턴입니다.|전자상거래 결제 시스템에서 주문 생성, 결제 승인, 재고 차감 서비스가 각각 로컬 DB를 갱신하며, 결제 실패 시 주문 취소 및 재고 복원 보상 트랜잭션을 실행합니다.|코레오그래피(Choreography) 방식과 오케스트레이션(Orchestration) 방식의 차이는 무엇인가요?|코레오그래피는 중앙 제어자 없이 각 서비스가 도메인 이벤트를 발행하고 구독하여 자율적으로 트랜잭션을 이어가는 반면, 오케스트레이션은 중앙 오케스트레이터가 워크플로를 명시적으로 제어하고 보상 트랜잭션을 호출합니다.|Saga 패턴 실행 도중 보상 트랜잭션 자체가 실패하면 어떻게 대응해야 하나요?|보상 트랜잭션은 반드시 멱등성을 보장해야 하며, 지수 백오프 기반의 자동 재시도와 데드 레터 큐(DLQ)를 통한 수동 개입 및 운영자 알림 파이프라인을 구축하여 최종 일관성을 복원합니다.|주문-결제-배송 연계 트랜잭션에서 분산 락 없이 최종 일관성을 안전하게 보장하려면 어떻게 설계하나요?|오케스트레이터 기반의 Saga 상태 머신을 구축하고 각 서비스 API에 멱등성 키를 적용하며, 메시지 유실 방지를 위해 트랜잭셔널 아웃박스 패턴을 함께 결합하여 장애 시에도 안전한 롤백을 보장합니다.
캐시 스탬피드 방지|캐시 스탬피드(Cache Stampede)는 대규모 트래픽 환경에서 인기 있는 캐시 키가 만료되는 순간, 수많은 동시 요청이 일제히 백엔드 DB로 몰려들어 데이터베이스 커넥션 풀을 고갈시키고 시스템 장애를 유발하는 현상입니다.|대규모 쇼핑몰 타임세일 이벤트 시작 시 메인 상품 정보의 Redis 캐시가 만료되어 수만 건의 쿼리가 MySQL로 직접 유입되는 장애를 방지합니다.|Mutex Lock을 이용한 단일 갱신 기법은 어떻게 동작하나요?|캐시 미스가 발생한 첫 번째 요청만 분산 락(Redis SETNX 등)을 획득하여 DB에서 데이터를 조회하고 캐시를 갱신하도록 허용하고, 나머지 요청들은 락 획득에 실패하면 잠시 대기 후 캐시에서 읽거나 이전 캐시를 반환받도록 합니다.|확률적 조기 재계산(PER, Probabilistic Early Recomputation) 알고리즘은 무엇인가요?|캐시 키가 실제로 만료되기 전에, 요청 시점과 남은 TTL을 기반으로 확률적으로 백그라운드에서 캐시를 미리 갱신하는 알고리즘으로, 트래픽이 많을수록 조기 갱신 확률이 높아져 만료 시점의 미스를 원천 차단합니다.|프로덕션 환경에서 실시간 랭킹 캐시 만료로 인한 DB 부하 급증을 어떻게 사전에 차단하나요?|TTL에 무작위 지터(Jitter)를 적용해 만료 시점을 분산시키고, 분산 락을 통한 단일 갱신 보호와 함께 비동기 스케줄러를 통한 사전 프리로딩(Pre-loading) 구조를 병행하여 설계합니다.
''')

    scope['add']('AI', 'RAG·AI Agent', '''하이브리드 검색과 리랭킹|하이브리드 검색은 키워드 기반의 Sparse Retrieval(BM25)과 의미적 유사도 기반의 Dense Retrieval(임베딩 벡터)을 결합하고, Cross-Encoder 기반의 Reranker로 최종 순위를 재정렬하여 검색 정확도와 답변 신뢰성을 극대화하는 파이프라인입니다.|사내 기술 문서 Q&A 시스템에서 고유명사나 코드 키워드는 BM25로 정확히 포착하고, 문맥과 의도는 벡터 검색으로 탐색한 뒤 Reranker로 상위 3개 문서를 정밀 선별합니다.|Dense Retrieval과 Sparse Retrieval의 각각의 한계는 무엇인가요?|Dense Retrieval은 의미적 유사도는 잘 찾지만 전문 용어나 약어, 제품 모델명 등 키워드 일치에 취약하며, Sparse Retrieval은 정확한 단어 매칭에는 강하지만 동의어나 패러프레이징된 문맥을 이해하지 못합니다.|RRF(Reciprocal Rank Fusion) 알고리즘은 두 검색 결과를 어떻게 병합하나요?|각 검색 엔진에서 반환된 문서의 점수 척도가 다르므로, 점수 대신 순위의 역수(1 / (k + rank))를 합산하여 서로 다른 두 검색 엔진의 랭킹을 편향 없이 안정적으로 결합합니다.|사내 RAG 서비스에서 약어와 도메인 전문용어가 포함된 기술 질문의 답변 정확도가 떨어지면 어떻게 개선하나요?|Sparse(BM25)와 Dense(HNSW)를 결합한 하이브리드 검색을 구축하고 RRF 가중치를 조절한 뒤, 경량 Cross-Encoder 모델로 상위 청크를 리랭킹하여 LLM의 Context Window에 가장 밀도 높은 정보를 주입합니다.
vLLM과 PagedAttention|PagedAttention은 OS의 가상 메모리 페이징 기법에서 영감을 받아, LLM 서빙 시 연속적인 메모리 할당이 필요했던 KV 캐시를 고정 크기의 페이지 블록으로 나누어 불연속적인 메모리 공간에 동적으로 할당함으로써 메모리 낭비를 제거하고 처리량(Throughput)을 수 배 끌어올리는 서빙 최적화 기술입니다.|다중 사용자 대화형 AI 서비스에서 동적 가변 길이의 프롬프트와 생성 토큰으로 인해 발생하는 GPU VRAM 단편화를 제거하고 동시 서빙 배치 크기를 획기적으로 확장합니다.|기존 LLM 서빙 시스템에서 KV 캐시 메모리 낭비가 심했던 이유는 무엇인가요?|기존에는 최대 컨텍스트 길이에 맞춰 연속된 GPU 메모리를 사전에 고정 할당해야 했기 때문에 내부 단편화(Internal Fragmentation)와 아직 생성되지 않은 토큰 공간의 예약 낭비가 60~80%에 달했습니다.|PagedAttention에서 Copy-on-Write 메커니즘은 어떻게 활용되나요?|병렬 샘플링이나 빔 서치, 동일 시스템 프롬프트를 공유하는 요청들에서 동일한 물리 KV 캐시 페이지를 여러 논리 시퀀스가 공유하고, 새로운 토큰이 생성될 때만 해당 블록을 복사하여 VRAM을 획기적으로 절약합니다.|동시 접속자 증가로 LLM 응답 대기 시간(TTFT 및 Throughput)이 급격히 저하될 때 인프라 서빙을 어떻게 최적화하나요?|vLLM 서빙 엔진을 도입하여 PagedAttention과 연속 배칭(Continuous Batching)을 활성화하고, 텐서 병렬화(Tensor Parallelism)와 양자화(AWQ/FP8)를 적용하여 GPU VRAM 효율과 토큰 처리량을 극대화합니다.
''')

    scope['add']('PERSONALITY', '협업·태도', '''기술 부채와 마감 갈등|마감 일정 준수와 코드 품질 및 기술 부채 사이의 갈등은 배척의 관계가 아니라, 비즈니스 타임투마켓과 장기적 시스템 안정성 간의 균형을 맞추는 의사결정 과정으로 접근해야 합니다. 객관적 위험 평가와 점진적 상환 계획을 통해 팀원 및 이해관계자와 합의를 도출합니다.|출시 마감 직전 리팩터링과 테스트 코드 작성을 고집하는 동료와, 배포일을 맞추기 위해 빠른 기능 머지를 요구하는 기획자 사이에서 단계적 배포와 부채 상환 스프린트를 합의합니다.|일정을 위해 타협한 기술 부채를 출시 후 잊어버리지 않고 상환하려면 어떻게 하나요?|타협 당시 발생한 기술 부채의 내용과 잠재적 위험, 모니터링 지표를 이슈 트래커에 명시적으로 티켓화하고, 다음 스프린트 백로그의 20%를 기술 부채 상환 버퍼로 사전에 경영진과 합의해 확보합니다.|마감 압박 상황에서 품질을 양보할 수 없는 절대적인 기준선은 어디까지인가요?|보안 취약점, 금융/결제 데이터 정합성 파괴, 사용자 개인정보 유출 위험과 같은 치명적 결함은 어떠한 마감 일정과도 타협할 수 없는 절대적 기준이며, 이 경우 영향도를 경영진에 즉각 보고하고 일정을 조율해야 합니다.|출시 마감 3일 전, 심각한 성능 저하를 유발하는 레거시 구조를 발견했을 때 어떻게 대응하나요?|전면 재작성 대신 병목을 우회하는 최소한의 임시 방어책(쿼리 튜닝, 캐싱 레이어 임시 적용)을 적용하여 안전하게 출시하고, 출시 직후 성능 프로파일링 결과와 함께 정식 아키텍처 개편 일정을 수립합니다.
''')

    scope['add']('MOTIVATION', '지원 근거·성장', '''이전 경험과 이직 계기|이전 직장이나 프로젝트에서의 경험을 설명할 때는 전 직장에 대한 불만이나 단순한 연봉/처우 개선이 아닌, [1. 이전 조직에서 이뤄낸 기술적 성과와 배움] → [2. 한 단계 더 큰 기술적 도전(스케일/도메인)에 대한 갈증] → [3. 지원 기업이 그 갈증을 해결할 수 있는 최적의 환경인 이유]로 구조화하여 설명합니다.|이전 프로젝트에서 모놀리식 아키텍처의 한계를 경험한 후 대규모 분산 트래픽을 처리하는 귀사의 엔지니어링 환경에서 아키텍처 역량을 확장하고자 지원동기를 연결합니다.|전 직장에 대한 퇴사 사유를 물었을 때 부정적인 경험은 어떻게 답변해야 하나요?|전 직장의 문화나 동료를 비난하지 않고 객관적인 상황(비즈니스 방향성 변화, 기술적 성장 한계)으로 담담히 설명하며, 본인이 새로운 환경에서 추구하고자 하는 가치와 주도적 성장에 초점을 맞추어 긍정적으로 전환합니다.|이전 직장에서 가장 자랑스러웠던 성과 하나와 가장 아쉬웠던 점은 무엇인가요?|장애 복구 자동화를 통해 MTTR을 50% 단축했던 기술적 성과를 말씀드리고, 아쉬웠던 점으로는 초기 도메인 주도 설계(DDD) 적용 미흡으로 인한 레거시 부채를 솔직히 밝히며 이를 개선하기 위한 학습 과정을 제시합니다.|전 직장과 우리 회사의 개발 문화가 크게 다를 수 있는데 어떻게 적응하시겠습니까?|이전 방식만을 고집하지 않고 귀사 팀의 커뮤니케이션 룰, 코드 리뷰 컨벤션, 의사결정 프로세스를 적극적으로 경청하고 흡수하며, 팀의 신뢰를 쌓은 후 저의 이전 노하우를 점진적으로 공유하여 팀 시너지를 내겠습니다.
''')

    scope['add']('BUSINESS', '고객 가치·의사결정', '''타임투마켓과 엔지니어링 트레이드오프|완벽한 아키텍처를 추구하느라 비즈니스 기회를 놓치는 오버엔지니어링을 경계하고, 비즈니스 검증 속도(Time-to-Market)와 기술적 지속 가능성 사이의 균형을 데이터와 사용자 피드백을 기반으로 냉정하게 조율해야 합니다.|신규 수익 모델의 빠른 시장 검증을 위해 초기에는 복잡한 마이크로서비스 대신 모듈러 모놀리스로 빠르게 런칭하고, 결제와 핵심 정합성 영역만 견고하게 설계합니다.|오버엔지니어링과 적정 엔지니어링을 구분하는 기준은 무엇인가요?|현재 비즈니스 문제와 6개월 내 예상 트래픽 규모에 필요한 수준을 명확히 정의하고, 아직 발생하지 않은 먼 미래의 가상 문제에 과도한 복잡성을 지불하고 있는지 여부로 판단합니다.|시장 출시 속도를 위해 타협했던 임시 코드가 프로덕션에서 영구화되는 것을 어떻게 방지하나요?|임시 코드에 명확한 만료 조건(TODO 주석 및 지표 임계치)을 달아두고, 기능 출시 후 2주 내 비즈니스 지표 검증 결과에 따라 정식 리팩터링 여부를 결정하는 스프린트 규칙을 수립합니다.|경쟁사가 동일 기능을 먼저 출시하여 경영진이 개발 일정을 절반으로 단축하라고 요구할 때 어떻게 대응하나요?|단순히 야근으로 해결하려 하지 않고 기능 범위를 핵심 가치 중심의 MVP로 축소(Scope Reduction)하여 출시 일정을 맞추고, 부가 기능은 2차 배포로 분리하는 실용적 대안을 경영진에 제안합니다.
''')

    scope['add']('PROJECTS', '설계·구현·회고', '''장애 포스트모텀과 근본 원인 분석|장애 회고(Post-mortem)는 특정 개인을 질책(Blameless)하지 않고, 시스템과 프로세스의 결함을 찾아내어 동일한 장애가 영원히 재발하지 않도록 자동화된 방어벽을 구축하는 엔지니어링 학습의 핵심 과정입니다.|결제 모듈 DB 커넥션 풀 고갈 장애 발생 시 단순 서버 재시작으로 끝내지 않고, 타임아웃 미설정 쿼리와 커넥션 누수를 추적하여 5-Whys 기법으로 근본 원인을 규명하고 재발 방지책을 수립합니다.|블레이리스(Blameless, 비난 없는) 포스트모텀 문화가 왜 중요한가요?|장애를 유발한 개인을 비난하면 실수를 은폐하게 되어 더 큰 장애로 이어지기 때문에, 누구나 실수할 수 있음을 인정하고 실수가 프로덕션 장애로 이어지지 않도록 시스템적 안전망(가드레일)을 구축하는 데 집중해야 합니다.|장애 재발 방지 대책(Action Item)의 실효성은 어떻게 검증하나요?|문서 작성에 그치지 않고 실패 재현 카오스 엔지니어링 테스트를 CI 파이프라인에 추가하거나, 슬랙 알림 임계치와 자동 서킷 브레이커 동작을 스테이징 환경에서 직접 검증해야 합니다.|본인이 작성한 코드로 인해 프로덕션 장애가 발생했을 때 어떻게 대처하셨나요?|당황하여 변명하지 않고 장애 사실을 팀에 즉시 투명하게 공유하여 롤백을 진행하고, 로그와 메트릭을 기반으로 근본 원인을 상세히 분석한 포스트모텀 문서를 작성하여 팀원들과 공유하고 테스트 코드를 보강했습니다.
''')

    # Re-partition CS and BACKEND
    pool = CONTENT['CS']
    CONTENT['CS'] = []
    for i, record in enumerate(pool[:52]):
        sub = '자료구조' if i<10 else '알고리즘' if i<20 else '운영체제' if i<30 else '네트워크' if i<37 else '데이터베이스' if i<45 else '프로그래밍 기초'
        CONTENT['CS'].append((sub, *record[1:]))
    
    total_generated = 0
    cat_counts = {}

    for category, records in CONTENT.items():
        result = []
        for index, (sub, topic, principle, example, fq1, fa1, fq2, fa2, case, solution) in enumerate(records):
            p_polite = to_interview_tone(principle)
            s_polite = to_interview_tone(solution)
            fa1_polite = to_interview_tone(fa1)
            fa2_polite = to_interview_tone(fa2)
            ex_polite = to_interview_tone(example)
            case_polite = to_interview_tone(case)

            for mode in range(2):
                ident = f'{category.lower()}-{index*2+mode+1:03d}'
                
                # Question generation with proper particle and natural interview tone
                if mode == 0:
                    if category == 'PERSONALITY':
                        question = f"{topic}에 관한 본인의 실제 경험과, 당시 문제 상황에서 주도적으로 취했던 행동 및 배운 점을 설명해 주세요."
                    elif category == 'MOTIVATION':
                        question = f"{topic}에 대해 본인만의 솔직한 가치관과 근거를 바탕으로 입사 후 성장 계획을 설명해 주세요."
                    elif category == 'BUSINESS':
                        question = f"{josa(topic, '을/를')} 비즈니스 임팩트와 기술적 비용 관점에서 어떤 기준으로 판단하고 의사결정하시겠습니까?"
                    elif category == 'PROJECTS':
                        question = f"{josa(topic, '을/를')} 본인이 주도적으로 수행한 프로젝트를 기준으로 기술적 도전 과제와 함께 설명해 주세요."
                    elif category == 'CS':
                        question = f"{topic}의 핵심 동작 원리와 메모리/시간 복잡도 특성을 설명하고, 실무에서 어떤 기준과 상황에서 적용해야 하는지 설명해 주세요."
                    elif category == 'BACKEND':
                        question = f"{topic}의 핵심 개념과 동작 메커니즘을 설명하고, 대규모 트래픽 및 실무 운영 환경에서 고려해야 할 설계 기준과 트레이드오프를 설명해 주세요."
                    elif category == 'AI':
                        question = f"{topic}의 핵심 수학적·공학적 원리를 설명하고, 실제 모델 학습 및 프로덕션 서빙 시 고려해야 할 엔지니어링 기준을 설명해 주세요."
                    else:
                        question = f"{josa(topic, '을/를')} 설명해 주세요."
                else:
                    # mode 1: application question
                    question = case
                    if not question.endswith('?') and not question.endswith('요?'):
                        question = question + '?'

                # Open-ended categories: build structured framework answers
                if category in ['MOTIVATION', 'PERSONALITY', 'PROJECTS', 'BUSINESS']:
                    if category == 'MOTIVATION':
                        framework_title = "[지원동기 4단계 답변 프레임워크]"
                        framework_desc = "[1단계: 직무적 가치관 및 두괄식 결론] → [2단계: 구체적 계기 및 근거 경험(STAR 기법)] → [3단계: 지원 기업 및 직무와의 접점] → [4단계: 입사 후 기여 방안 및 성장 포부]"
                        eval_intent = "- 해당 직무에 대한 현실적인 이해도 및 지속 가능한 동기부여\n- 회사의 비즈니스 및 기술 과제에 대한 사전 관심과 준비도\n- 입사 후 조직에 적응하고 실질적인 기여를 해낼 수 있는 잠재력"
                        anti_pattern = "- '유망해서', '연봉이나 복지가 좋아서' 등 외적 조건 중심의 답변\n- 어느 회사에나 통용되는 추상적인 칭찬과 미사여구 일색의 답변\n- 구체적인 근거 경험 없이 열정만을 강조하는 주관적 답변"
                    elif category == 'PERSONALITY':
                        framework_title = "[인성·협업 STAR 답변 프레임워크]"
                        framework_desc = "[1단계: 상황(Situation)] → [2단계: 과제 및 갈등(Task)] → [3단계: 주도적 행동(Action)] → [4단계: 결과 및 배운 점(Result)]"
                        eval_intent = "- 팀 내 의견 충돌이나 위기 상황에서의 커뮤니케이션 및 갈등 해결력\n- 실수를 솔직하게 인정하고 재발을 방지하는 책임감과 오너십\n- 비판적 피드백을 수용하여 개인과 팀의 성장으로 연결하는 유연성"
                        anti_pattern = "- 문제의 원인을 동료나 환경 탓으로 돌리는 방어적인 태도\n- 본인이 모든 것을 해결했다는 과장된 영웅 서사\n- '갈등이 전혀 없었다'며 진솔한 자기 성찰을 회피하는 답변"
                    elif category == 'PROJECTS':
                        framework_title = "[프로젝트 경험 4단계 엔지니어링 프레임워크]"
                        framework_desc = "[1단계: 문제 정의 및 비즈니스 목표(Why)] → [2단계: 아키텍처 및 기술적 해결 접근(How)] → [3단계: 정량적 성과 및 검증(Result)] → [4단계: 기술적 한계 및 트레이드오프 회고(Retrospective)]"
                        eval_intent = "- 기술 도입 배경(Why)에 대한 타당한 엔지니어링 근거\n- 팀 내 실제 기여도와 문제 해결 과정에서의 주도성\n- 성능 개선 및 무장애 달성을 증명하는 정량적 지표와 회고 역량"
                        anti_pattern = "- 단순 기능 구현 나열식의 이력서 복사형 답변\n- 최신 유행 기술을 무비판적으로 도입했다는 오버엔지니어링 답변\n- 본인의 구체적 기여 범위와 팀 성과를 모호하게 혼동하는 태도"
                    else: # BUSINESS
                        framework_title = "[비즈니스 의사결정 4단계 프레임워크]"
                        framework_desc = "[1단계: 비즈니스 맥락 및 고객 가치 정의] → [2단계: 기술적 트레이드오프 및 비용 분석(TCO)] → [3단계: 가설 검증 및 정량 지표 측정] → [4단계: 장기적 신뢰 및 확장성 확보]"
                        eval_intent = "- 기술을 비즈니스 가치 창출의 도구로 바라보는 제품 중심 엔지니어링 사고\n- 일정, 비용, 품질 간의 현실적인 트레이드오프 조율 역량\n- 비개발 직군(기획/경영진)과의 객관적 데이터 기반 커뮤니케이션 능력"
                        anti_pattern = "- 비즈니스 목표와 무관하게 기술적 완벽주의만을 고집하는 태도\n- 고객의 실제 문제 확인 없이 개인적 추측만으로 솔루션을 단정하는 답변\n- 장기적 유지보수 비용(TCO)을 간과하고 단기 땜질식 구현을 정당화하는 태도"

                    summary = f"이 질문은 정답이 정해져 있지 않은 열린 질문이므로, {framework_desc}의 4단계 프레임워크로 구조화하여 답변하시는 것을 권장합니다."
                    
                    if mode == 0:
                        interview_answer = f"저는 {josa(topic, '과/와')} 관련하여 다음과 같은 가치관과 기준을 바탕으로 임하고 있습니다. {p_polite} 실제 경험을 예로 들면, {fa1_polite} 이를 바탕으로 {fa2_polite}"
                    else:
                        interview_answer = f"{s_polite} 이러한 결정을 내리는 근거는 {p_polite} 실무에서는 {fa2_polite}"
                    
                    detailed_explanation = (
                        f"{framework_title}\n"
                        f"{framework_desc}\n\n"
                        f"[단계별 답변 구조화 가이드]\n"
                        f"- 1단계(핵심 메시지): 질문에 대한 직접적인 결론과 본인만의 기술 철학/가치관을 두괄식으로 밝힙니다.\n"
                        f"- 2단계(근거 경험): 직무/프로젝트에서 실제로 겪었던 구체적 상황(Situation)과 과제(Task)를 수치와 함께 제시합니다.\n"
                        f"- 3단계(주도적 행동): 본인이 직접 분석하고 조율하여 실행한 기술적·태도적 행동(Action)을 상세히 설명합니다.\n"
                        f"- 4단계(결과 및 포부): 이를 통해 달성한 정량적/정성적 성과(Result)와 입사 후 팀에 기여할 구체적 가치를 연결합니다.\n\n"
                        f"[실무 대응 핵심 원칙]\n{p_polite}\n{s_polite}\n\n"
                        f"[면접관의 핵심 평가 의도]\n{eval_intent}\n\n"
                        f"[피해야 할 안 좋은 답변(Anti-pattern)]\n{anti_pattern}\n\n"
                        f"[심층 꼬리질문 대응 포인트]\n- Q1. {fq1}\n  대응: {fa1_polite}\n- Q2. {fq2}\n  대응: {fa2_polite}"
                    )
                    
                    example_val = (
                        f"[실전 구술 템플릿 예시]\n"
                        f"{ex_polite}\n\n"
                        f"[상황별 실전 대응 예시]\n"
                        f"- 상황: {case_polite}\n"
                        f"- 모범 대응 전략: {s_polite}"
                    )

                else:
                    # CS, BACKEND, AI: Technical deep-dive verbal answers
                    if mode == 0:
                        summary = p_polite
                        interview_answer = f"{p_polite} 실무 적용 시에는 {fa1_polite} 나아가 {fa2_polite}"
                    else:
                        summary = f"{s_polite} 이는 {p_polite}"
                        interview_answer = f"{s_polite} 이러한 결정을 내리는 근거는 {p_polite} 실무 환경에서는 {fa1_polite}"

                    detailed_explanation = (
                        f"[핵심 개념 및 동작 원리]\n{p_polite}\n\n"
                        f"[실무 엔지니어링 고려사항]\n{s_polite}\n\n"
                        f"[심층 기술 질의 포인트]\n"
                        f"Q1. {fq1}\n답변: {fa1_polite}\n\n"
                        f"Q2. {fq2}\n답변: {fa2_polite}"
                    )

                    example_val = (
                        f"[실무 적용 시나리오]\n{ex_polite}\n\n"
                        f"[엔지니어링 문제 상황 및 해결]\n"
                        f"문제 상황: {case_polite}\n"
                        f"해결 아키텍처: {s_polite}"
                    )

                result.append({
                    'id': ident,
                    'category': category,
                    'subcategory': sub,
                    'topic': topic,
                    'difficulty': 'BASIC' if mode == 0 else 'INTERMEDIATE',
                    'importance': 'ESSENTIAL' if index % 3 == 0 else 'IMPORTANT',
                    'question': question,
                    'modelAnswer': {
                        'summary': summary,
                        'interviewAnswer': interview_answer,
                        'detailedExplanation': detailed_explanation,
                        'example': example_val,
                        'keywords': list(dict.fromkeys([topic, sub, *(['ACID'] if topic == 'ACID' else []), topic.split(' ')[0]])),
                    },
                    'followUps': [
                        {'id': f'{ident}-f1', 'question': fq1, 'modelAnswer': fa1_polite},
                        {'id': f'{ident}-f2', 'question': fq2, 'modelAnswer': fa2_polite}
                    ],
                })

        dest = QUESTIONS_DIR / f'{category.lower()}.json'
        dest.write_text(json.dumps(result, ensure_ascii=False, indent=2) + '\n', encoding='utf-8')
        cat_counts[category] = len(result)
        total_generated += len(result)
        print(f"Generated {category}: {len(result)} questions -> {dest.name}")

    print(f"\nTotal questions generated: {total_generated}")
    print(f"Category counts: {cat_counts}")

if __name__ == '__main__':
    run()
