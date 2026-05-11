import { describe, it, expect } from "vitest";
import { readTimeFromHtml, readTimeFromText, wordCount } from "@/lib/utils/read-time";

describe("read-time", () => {
  it("minimum of 1 minute", () => {
    expect(readTimeFromText("hi")).toBe(1);
  });
  it("counts words at ~220 wpm", () => {
    const text = "word ".repeat(440).trim();
    expect(readTimeFromText(text)).toBe(2);
  });
  it("strips html tags before counting", () => {
    const html = "<p>" + "word ".repeat(220).trim() + "</p>";
    expect(readTimeFromHtml(html)).toBe(1);
  });
  it("wordCount", () => {
    expect(wordCount("  one   two   three  ")).toBe(3);
  });
});
