import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { SavedQuestionControls } from "../components/auth/saved-question-controls";

describe("saved question learning entry point", () => {
  it("renders status and bookmark controls without a duplicate answer form", () => {
    const id = "11111111-1111-4111-8111-111111111111";
    const html = renderToStaticMarkup(<SavedQuestionControls id={id} onMutate={async () => {}} />);
    expect(html).not.toContain("<form");
    expect(html).not.toContain('name="answer_text"');
    expect(html).toContain('value="NOT_STARTED" selected');
    expect(html).toContain("북마크 추가");
    expect(html).not.toContain("내 답변 저장");
  });
  it("renders saved progress independently from answer editing", () => {
    const html = renderToStaticMarkup(
      <SavedQuestionControls
        id="11111111-1111-4111-8111-111111111111"
        answer="나의 첫 답변"
        progress={{ status: "NEEDS_REVIEW", bookmarked: true }}
        onMutate={async () => {}}
      />,
    );
    expect(html).not.toContain("<textarea");
    expect(html).toContain('value="NEEDS_REVIEW" selected');
    expect(html).toContain("북마크 해제");
  });
});
