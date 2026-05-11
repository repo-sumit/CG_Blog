import { describe, it, expect } from "vitest";
import { sanitizeHtml } from "@/lib/editor/sanitize";

describe("sanitizeHtml", () => {
  it("strips script tags", () => {
    expect(sanitizeHtml("<p>hi</p><script>alert(1)</script>")).toBe("<p>hi</p>");
  });
  it("strips event handlers", () => {
    expect(sanitizeHtml(`<img src="x" onerror="alert(1)">`)).not.toContain("onerror");
  });
  it("neutralizes javascript: urls", () => {
    const out = sanitizeHtml(`<a href="javascript:alert(1)">x</a>`);
    expect(out).not.toContain("javascript:");
  });
  it("strips iframes with non-allowlisted src", () => {
    expect(sanitizeHtml("<iframe src='https://evil.example.com/x'></iframe>")).toBe("");
    expect(sanitizeHtml("<iframe src=\"javascript:alert(1)\"></iframe>")).toBe("");
  });
  it("keeps iframes from allowlisted embed providers", () => {
    const out = sanitizeHtml('<iframe src="https://www.youtube.com/embed/dQw4w9WgXcQ"></iframe>');
    expect(out).toContain("youtube.com/embed/dQw4w9WgXcQ");
    expect(out).toContain("<iframe");
  });
  it("strips event handlers from kept iframes", () => {
    const out = sanitizeHtml(
      '<iframe src="https://player.vimeo.com/video/123" onload="alert(1)"></iframe>',
    );
    expect(out).not.toContain("onload");
  });
  it("keeps benign markup", () => {
    const out = sanitizeHtml(`<p><strong>Hi</strong> <a href="https://example.com">link</a></p>`);
    expect(out).toContain("<strong>");
    expect(out).toContain("href=\"https://example.com\"");
  });
});
