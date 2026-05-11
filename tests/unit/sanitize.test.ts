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
  it("strips iframes", () => {
    expect(sanitizeHtml("<iframe src='evil'></iframe>")).toBe("");
  });
  it("keeps benign markup", () => {
    const out = sanitizeHtml(`<p><strong>Hi</strong> <a href="https://example.com">link</a></p>`);
    expect(out).toContain("<strong>");
    expect(out).toContain("href=\"https://example.com\"");
  });
});
