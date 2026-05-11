// Allowlisted external embed providers. Anything not matched here is rejected.

export type EmbedProvider = "youtube" | "vimeo" | "loom" | "gdrive";

export interface EmbedInfo {
  provider: EmbedProvider;
  embedUrl: string;
  mediaType: "video" | "audio";
}

export function parseEmbedUrl(raw: string): EmbedInfo | null {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }
  if (url.protocol !== "https:") return null;
  const host = url.hostname.toLowerCase();

  // YouTube
  if (host === "youtu.be") {
    const id = url.pathname.slice(1);
    if (!id) return null;
    return { provider: "youtube", embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(id)}`, mediaType: "video" };
  }
  if (host === "www.youtube.com" || host === "youtube.com" || host === "m.youtube.com") {
    if (url.pathname === "/watch") {
      const id = url.searchParams.get("v");
      if (!id) return null;
      return { provider: "youtube", embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(id)}`, mediaType: "video" };
    }
    if (url.pathname.startsWith("/embed/")) {
      return { provider: "youtube", embedUrl: `https://www.youtube.com${url.pathname}`, mediaType: "video" };
    }
    if (url.pathname.startsWith("/shorts/")) {
      const id = url.pathname.split("/")[2];
      if (!id) return null;
      return { provider: "youtube", embedUrl: `https://www.youtube.com/embed/${encodeURIComponent(id)}`, mediaType: "video" };
    }
  }

  // Vimeo
  if (host === "vimeo.com" || host === "www.vimeo.com") {
    const id = url.pathname.split("/").filter(Boolean)[0];
    if (!id || !/^\d+$/.test(id)) return null;
    return { provider: "vimeo", embedUrl: `https://player.vimeo.com/video/${id}`, mediaType: "video" };
  }

  // Loom
  if (host === "www.loom.com" || host === "loom.com") {
    const parts = url.pathname.split("/").filter(Boolean);
    if (parts[0] === "share" && parts[1]) {
      return { provider: "loom", embedUrl: `https://www.loom.com/embed/${parts[1]}`, mediaType: "video" };
    }
    if (parts[0] === "embed" && parts[1]) {
      return { provider: "loom", embedUrl: `https://www.loom.com/embed/${parts[1]}`, mediaType: "video" };
    }
  }

  // Google Drive (preview)
  if (host === "drive.google.com") {
    const match = url.pathname.match(/\/file\/d\/([^/]+)/);
    if (match) {
      return { provider: "gdrive", embedUrl: `https://drive.google.com/file/d/${match[1]}/preview`, mediaType: "video" };
    }
  }

  return null;
}
