import { it, expect } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { MarkdownContent } from "../components/ui/markdown-content";
it("renders answer emphasis and lists without raw markdown markers", () => {
 const html = renderToStaticMarkup(<MarkdownContent>{"1. **2PC**: 강한 일관성\n2. **Saga**: 최종 일관성"}</MarkdownContent>);
 expect(html).toContain("<strong>2PC</strong>"); expect(html).toContain("<ol>"); expect(html).not.toContain("**");
});
it("does not execute raw HTML or javascript links", () => {
 const html = renderToStaticMarkup(<MarkdownContent>{'<script>alert(1)</script>\n\n[링크](javascript:alert(1))'}</MarkdownContent>);
 expect(html).not.toContain("<script"); expect(html).not.toContain("javascript:");
});
