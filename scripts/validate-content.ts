import { questions, categories } from "../lib/questions";
import { validateQuestions } from "../lib/question-validation";
const required = {
  CS: 104,
  BACKEND: 104,
  AI: 84,
  PERSONALITY: 32,
  MOTIVATION: 22,
  BUSINESS: 22,
  PROJECTS: 32,
};
const errors = validateQuestions(questions);
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
