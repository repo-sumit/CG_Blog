import { describe, it, expect } from "vitest";
import { validateFile, classifyMime, safeFilename, buildStoragePath } from "@/lib/utils/file-validation";

const MAX = 50 * 1024 * 1024;

describe("validateFile", () => {
  it("accepts valid images", () => {
    expect(validateFile({ size: 1000, mime: "image/png", maxBytes: MAX })).toMatchObject({ ok: true, mediaType: "image" });
  });
  it("rejects unsupported mime", () => {
    const r = validateFile({ size: 100, mime: "application/x-msdownload", maxBytes: MAX });
    expect(r.ok).toBe(false);
  });
  it("rejects oversized", () => {
    const r = validateFile({ size: MAX + 1, mime: "video/mp4", maxBytes: MAX });
    expect(r.ok).toBe(false);
    expect(r.error).toContain("too large");
  });
  it("rejects empty", () => {
    const r = validateFile({ size: 0, mime: "audio/mpeg", maxBytes: MAX });
    expect(r.ok).toBe(false);
  });
});

describe("classifyMime", () => {
  it("classifies known types", () => {
    expect(classifyMime("audio/mpeg")).toBe("audio");
    expect(classifyMime("video/webm")).toBe("video");
    expect(classifyMime("application/pdf")).toBe("document");
  });
});

describe("safeFilename / buildStoragePath", () => {
  it("strips unsafe characters", () => {
    expect(safeFilename("../etc/passwd")).not.toContain("/");
    expect(safeFilename("..\\evil.exe")).not.toContain("\\");
  });
  it("builds path with userId/postId prefix", () => {
    const path = buildStoragePath("abc-123", "post-1", "Demo File.mp4");
    expect(path.startsWith("abc-123/post-1/")).toBe(true);
  });
});
