"""Validated wire data. Action dispatch is a closed, server-owned registry."""

from typing import Annotated, Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, StringConstraints, model_validator


def text(maximum: int, minimum: int = 1, strip: bool = False):
    return Annotated[str, StringConstraints(min_length=minimum, max_length=maximum, strip_whitespace=strip)]


Text = text(8000, strip=True)
DimensionName = Literal["정확성", "논리성", "구체성", "질문 적합성", "실무 적용성"]
Difficulty = Literal["BASIC", "INTERMEDIATE", "ADVANCED"]
Count = Literal[5, 10, 15]
Score = Annotated[float, Field(ge=0, le=100)]
Provider = Literal["groq", "nvidia", "ollama", "openai"]


class Contract(BaseModel):
    model_config = ConfigDict(strict=True, extra="forbid")


class Settings(Contract):
    role: text(100)
    level: Literal["신입", "주니어", "시니어"]
    count: Count
    mode: Literal["learn", "chat"]
    company: text(100, 0) = ""
    industry: text(100, 0) = ""
    division: text(100, 0) = ""
    jobPosting: text(12000, 0) = ""
    interviewType: Literal["technical", "project", "personality", "motivation", "comprehensive"] = "comprehensive"
    difficulty: Difficulty = "INTERMEDIATE"


class Selection(Contract):
    provider: Provider
    model: text(200)


class Experience(Contract):
    description: Text
    evidence: Text


class Analysis(Contract):
    summary: Text
    skills: list[Text] = Field(max_length=30)
    experiences: list[Experience] = Field(max_length=20)
    uncertainties: list[Text] = Field(max_length=20)


class ModelAnswer(Contract):
    summary: text(10000)
    interviewAnswer: text(20000)
    detailedExplanation: text(20000)
    example: text(10000)
    keywords: list[text(100, strip=True)] = Field(min_length=1, max_length=15)


class QuestionFollowup(Contract):
    id: text(150)
    question: text(5000)
    modelAnswer: text(10000)


class Source(Contract):
    type: text(100, 0)
    evidence: text(10000, 0)


class Question(Contract):
    id: text(100)
    category: Literal["CS", "FRONTEND", "BACKEND", "AI", "PERSONALITY", "MOTIVATION", "BUSINESS", "PROJECTS"]
    subcategory: text(100)
    topic: text(200)
    difficulty: Difficulty
    importance: Literal["ESSENTIAL", "IMPORTANT", "ADVANCED"]
    question: text(5000)
    modelAnswer: ModelAnswer
    followUps: list[QuestionFollowup] = Field(min_length=2, max_length=4)
    source: Source


class Generation(Contract):
    questions: list[Question] = Field(min_length=5, max_length=15)


class Dimension(Contract):
    name: DimensionName
    score: Score
    evidence: Text


class Evaluation(Contract):
    score: Score
    dimensions: list[Dimension] = Field(min_length=5, max_length=5)
    strengths: list[Text] = Field(min_length=1, max_length=5)
    improvements: list[Text] = Field(min_length=1, max_length=5)
    revisedAnswer: Text

    @model_validator(mode="after")
    def unique_dimensions(self):
        if len({dimension.name for dimension in self.dimensions}) != 5:
            raise ValueError("Duplicate evaluation dimensions")
        return self


class Followup(Contract):
    question: Text
    reason: Text
    modelAnswer: Text


class Summary(Contract):
    overallScore: Score
    summary: Text
    strengths: list[Text] = Field(min_length=1, max_length=10)
    priorities: list[Text] = Field(min_length=1, max_length=10)
    studyPlan: list[Text] = Field(min_length=1, max_length=10)


class AgentContext(Contract):
    questionIndex: int = Field(ge=0, le=14)
    questionCount: Count
    followupCount: int = Field(ge=0, le=2)
    turnCount: int = Field(ge=1, le=45)

    @model_validator(mode="after")
    def index_in_range(self):
        if self.questionIndex >= self.questionCount:
            raise ValueError("Question index out of bounds")
        return self


class RecentTurn(Contract):
    question: text(400)
    answer: text(500)


class SummaryDimension(Contract):
    name: DimensionName
    score: Score
    evidence: text(80)


class SummaryEvaluation(Contract):
    score: Score
    dimensions: list[SummaryDimension] = Field(min_length=5, max_length=5)
    strengths: list[text(80)] = Field(min_length=1, max_length=1)
    improvements: list[text(80)] = Field(min_length=1, max_length=1)


class SummaryTurn(Contract):
    question: text(120)
    answer: text(360)
    evaluation: SummaryEvaluation


class RequestBase(Contract):
    selection: Selection | None = None
    allowFallback: bool = True


class AnalyzeRequest(RequestBase):
    action: Literal["analyze"]
    documents: text(45000)
    settings: Settings


class GenerateRequest(RequestBase):
    action: Literal["generate"]
    analysis: Analysis
    settings: Settings


class AnswerRequest(RequestBase):
    question: text(8000)
    answer: text(8000)
    history: list[RecentTurn] = Field(default_factory=list, max_length=3)


class EvaluateRequest(AnswerRequest):
    action: Literal["evaluate"]
    agentContext: AgentContext | None = None


class FollowupRequest(AnswerRequest):
    action: Literal["followup"]
    focus: DimensionName | None = None


class SummaryRequest(RequestBase):
    action: Literal["summary"]
    excerpted: Literal[True]
    turns: list[SummaryTurn] = Field(min_length=1, max_length=45)


InterviewRequest = Annotated[
    AnalyzeRequest | GenerateRequest | EvaluateRequest | FollowupRequest | SummaryRequest,
    Field(discriminator="action"),
]
TOOLS = {
    "analyze": (Analysis, 2800),
    "generate": (Generation, 6000),
    "evaluate": (Evaluation, 2200),
    "followup": (Followup, 1000),
    "summary": (Summary, 2200),
}


class RunRequest(Contract):
    runId: UUID
    budgetMs: int = Field(ge=1, le=105000)
    input: InterviewRequest
