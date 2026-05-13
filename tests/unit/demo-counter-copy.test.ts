import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * The DemoWatchingCounter must NEVER ship a copy variant that combines the
 * "Demo" / "Simulated" prefix with the phrase "people are watching" — that
 * exact wording is what users mistake for real telemetry.
 *
 * We assert against the raw source so a future contributor can't quietly add
 * a non-compliant variant. Reading the file is fast (single small TSX) and
 * unit tests already cover other lint-style rules in this folder.
 */
describe("DemoWatchingCounter copy", () => {
  const source = readFileSync(
    join(__dirname, "..", "..", "components", "analytics", "DemoWatchingCounter.tsx"),
    "utf8",
  );

  it("never combines a Demo/Simulated label with 'people are watching'", () => {
    // Lowercase the whole file once, then check for the literal phrase.
    // The component never renders a "people are watching" string anywhere,
    // so the simplest invariant is: that exact phrase must not appear in the
    // source at all.
    expect(source.toLowerCase()).not.toContain("people are watching");
  });

  it("requires every copy variant to include a Demo or Simulated label", () => {
    // Pull out the COPY_VARIANTS array body. We're inspecting source rather
    // than evaluating the module because evaluating would import "use client"
    // code which vitest can't run without a DOM stub.
    const variantsBlock = /COPY_VARIANTS\s*=\s*\[(.+?)\]/s.exec(source);
    expect(variantsBlock).not.toBeNull();
    const body = variantsBlock![1]!;
    // Each arrow-fn line should mention either "Demo" or "Simulated".
    const lines = body
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l.startsWith("(n:"));
    expect(lines.length).toBeGreaterThan(0);
    for (const line of lines) {
      expect(/Demo|Simulated/.test(line)).toBe(true);
    }
  });
});
