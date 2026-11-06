import { questions, categories } from "../lib/questions";
import { validateQuestions } from "../lib/question-validation";
const required = {
  CS: 106,
  FRONTEND: 24,
  BACKEND: 104,
  AI: 84,
  PERSONALITY: 32,
  MOTIVATION: 22,
  BUSINESS: 22,
  PROJECTS: 32,
};
const errors = validateQuestions(questions);
const repeatedEnding = /(?:니입니다|니다입니다|습니다습니다)/u;
for (const { id, modelAnswer, followUps } of questions) {
  const answers = [
    modelAnswer.summary,
    modelAnswer.interviewAnswer,
    modelAnswer.detailedExplanation,
    modelAnswer.example,
    ...followUps.map((followUp) => followUp.modelAnswer),
  ];
  if (answers.some((answer) => repeatedEnding.test(answer))) {
    errors.push(`${id}: repeated Korean sentence ending`);
  }
}
for (const c of categories) {
  const count = questions.filter((q) => q.category === c.id).length;
  if (count < required[c.id])
    errors.push(`${c.id}: expected at least ${required[c.id]}, received ${count}`);
}
if (errors.length) {
  console.error(errors.join("\n"));
  process.exitCode = 1;
} else
  console.log(
    `Validated ${questions.length} questions, ${questions.reduce((n, q) => n + q.followUps.length, 0)} answered follow-ups across ${categories.length} categories.`,
  );
