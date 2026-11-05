import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  BookOpen,
  BrainCircuit,
  Check,
  Code2,
  Cpu,
  FileText,
  GitBranch,
  Layers3,
  MessagesSquare,
  Monitor,
  Sparkles,
  UserRound,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { questions } from "@/lib/questions";
import { TopicCarousel } from "@/components/home/topic-carousel";
export default function HomePage() {
  const featured = ["CS", "FRONTEND", "BACKEND"]
    .map((category) => questions.find((q) => q.category === category))
    .filter((q) => q !== undefined);
  return (
    <div className="home-page">
      <section className="home-welcome">
        <div>
          <div className="eyebrow">
            <span className="tiny-line" /> YOUR NEXT CHAPTER STARTS HERE
          </div>
          <h1>
            기술 면접,
            <br className="mobile-break" /> 질문부터 실전까지<span className="heading-dot">.</span>
          </h1>
          <p>
            아는 것을 넘어, 설명할 수 있는 실력으로.
            <br className="mobile-break" /> 나만의 속도로 다음 기회를 준비하세요.
          </p>
        </div>
        <div className="welcome-note">
          <div className="welcome-note-icon">
            <Sparkles size={18} />
          </div>
          <span>
            오늘도 한 걸음 더,
            <br />
            <strong>어제보다 단단한 나로.</strong>
          </span>
        </div>
      </section>
      <section className="feature-grid" aria-label="핵심 학습 기능">
        <article className="learning-feature feature-card">
          <div className="feature-overline">
            <span className="feature-icon">
              <BookOpen size={22} />
            </span>
            <span>LEARN THE FUNDAMENTALS</span>
            <span className="feature-step">01</span>
          </div>
          <div className="feature-copy">
            <h2>
              다양한 분야의 실전 면접
              <br />
              질문을 통해 대비하세요.
            </h2>
            <p>
              CS부터 프런트엔드, 백엔드, AI까지 체계적인 질문과
              <br />
              깊이 있는 모범답안으로 개념을 내 것으로.
            </p>
          </div>
          <div className="learning-preview" aria-hidden="true">
            <div className="preview-tab">
              <span className="preview-dot" />
              <span>운영체제</span>
              <span className="preview-tag">필수 개념</span>
            </div>
            <div className="preview-question">
              <span>Q.</span> 프로세스와 스레드의 차이는?
            </div>
            <div className="preview-answer">
              <span>
                <Check size={12} />
              </span>
              <div>
                <i />
                <i />
                <i />
              </div>
            </div>
            <div className="preview-tags">
              <span># CS 기초</span>
              <span># 모범답안</span>
              <span># 꼬리질문</span>
            </div>
          </div>
          <div className="feature-bottom">
            <Button asChild>
              <Link href="/questions">
                질문 학습 시작하기 <ArrowRight size={16} />
              </Link>
            </Button>
            <span>{questions.length}개의 질문, 무한한 가능성</span>
          </div>
        </article>
        <article className="interview-feature feature-card">
          <div className="feature-overline">
            <span className="feature-icon">
              <AudioLines size={23} />
            </span>
            <span>MAKE IT YOUR OWN</span>
            <span className="feature-step">02</span>
          </div>
          <div className="feature-copy">
            <h2>
              내 경험이 질문이 되는,
              <br />
              AI 맞춤 면접.
            </h2>
            <p>
              이력서 속 경험을 바탕으로 묻고, 이어 묻는
              <br />
              나만의 AI 면접관과 실전을 준비하세요.
            </p>
          </div>
          <div className="interview-preview" aria-hidden="true">
            <div className="resume-chip">
              <FileText size={15} />
              <span>나의 이력서.pdf</span>
              <span className="resume-check">
                <Check size={11} />
              </span>
            </div>
            <div className="preview-connector">
              <i />
              <Sparkles size={14} />
              <i />
            </div>
            <div className="chat-preview">
              <span className="chat-avatar">
                <AudioLines size={15} />
              </span>
              <div>
                <span>AI 면접관</span>
                <p>
                  프로젝트에서 이 기술을 선택한
                  <br />
                  이유를 설명해 주시겠어요?
                </p>
              </div>
              <span className="chat-status">
                <i />
                <i />
                <i />
              </span>
            </div>
          </div>
          <div className="feature-bottom">
            <Button asChild className="btn-white">
              <Link href="/interview">
                AI 면접 시작하기 <ArrowRight size={16} />
              </Link>
            </Button>
            <span>이력서 분석부터 답변 피드백까지</span>
          </div>
        </article>
      </section>
      <section className="topics-section">
        <div className="section-header">
          <div>
            <h2>
              어떤 주제를 준비할까요?
              <span className="section-caption">관심 있는 주제를 선택하고 면접 준비를 시작하세요.</span>
            </h2>
          </div>
          <Link className="text-link" href="/questions">
            전체 질문 보기 <ArrowUpRight size={15} />
          </Link>
        </div>
        <TopicCarousel />

      </section>
      <div className="home-bottom-grid">
        <section className="recommended-section">
          <div className="section-header">
            <h2>
              <span className="small-spark">
                <Sparkles size={17} />
              </span>
              오늘의 추천 질문
            </h2>
            <span className="section-caption">기본기를 다지는 세 가지 질문</span>
          </div>
          <div className="recommended-list">
            {featured.map((question, index) => (
              <Link
                key={question.id}
                href={`/questions/${question.id}`}
                className="recommended-row"
              >
                <span className="question-number">0{index + 1}</span>
                <div>
                  <div className="recommended-meta">
                    <span>{question.subcategory}</span>
                    <span className="meta-divider">·</span>
                    <span>기초부터 차근차근</span>
                  </div>
                  <strong>{question.question}</strong>
                </div>
                <span className="badge badge-soft">필수</span>
                <ArrowUpRight className="row-arrow" size={17} />
              </Link>
            ))}
          </div>
          <div className="recommended-footer">
            <BookOpen size={14} />
            <span>모든 질문에는 모범답안과 꼬리질문이 함께 제공돼요.</span>
          </div>
        </section>
      </div>
      <div className="home-endnote">
        <span className="endnote-symbol">✳</span> 완벽한 답변보다, 어제보다 나아진 답변을 향해.
      </div>
    </div>
  );
}
