import { describe, it, expect } from "vitest";
import { slugify, withSuffix } from "@/lib/utils/slugs";

describe("slugify", () => {
  it("produces lowercase, hyphenated slugs", () => {
    expect(slugify("Hello, World!")).toBe("hello-world");
    expect(slugify("  Weekly Update — Sprint 42  ")).toBe("weekly-update-sprint-42");
  });
  it("falls back to 'post' for empty inputs", () => {
    expect(slugify("---")).toBe("post");
    expect(slugify("")).toBe("post");
  });
  it("truncates very long slugs", () => {
    const out = slugify("a".repeat(200));
    expect(out.length).toBeLessThanOrEqual(80);
  });
});

describe("withSuffix", () => {
  it("appends suffix", () => {
    expect(withSuffix("hello", "abcd")).toBe("hello-abcd");
  });
});
