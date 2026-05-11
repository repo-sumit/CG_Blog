import { describe, it, expect } from "vitest";
import { parseEmbedUrl } from "@/lib/utils/embeds";

describe("parseEmbedUrl", () => {
  it("parses youtube watch", () => {
    expect(parseEmbedUrl("https://www.youtube.com/watch?v=dQw4w9WgXcQ")?.embedUrl).toContain("/embed/dQw4w9WgXcQ");
  });
  it("parses youtu.be short", () => {
    expect(parseEmbedUrl("https://youtu.be/dQw4w9WgXcQ")?.embedUrl).toContain("/embed/dQw4w9WgXcQ");
  });
  it("parses vimeo", () => {
    expect(parseEmbedUrl("https://vimeo.com/123456789")?.embedUrl).toBe("https://player.vimeo.com/video/123456789");
  });
  it("parses loom", () => {
    expect(parseEmbedUrl("https://www.loom.com/share/abcdef123")?.embedUrl).toContain("/embed/abcdef123");
  });
  it("rejects unknown providers", () => {
    expect(parseEmbedUrl("https://evil.example.com/iframe.html")).toBeNull();
  });
  it("rejects non-https", () => {
    expect(parseEmbedUrl("http://www.youtube.com/watch?v=foo")).toBeNull();
  });
});
