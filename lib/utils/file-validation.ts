import type { MediaType } from "@/lib/db/types";

export const ALLOWED_MIME: Record<MediaType, readonly string[]> = {
  image: ["image/jpeg", "image/png", "image/webp", "image/gif"],
  video: ["video/mp4", "video/webm", "video/quicktime"],
  audio: ["audio/mpeg", "audio/wav", "audio/x-m4a", "audio/mp4", "audio/ogg"],
  document: ["application/pdf"],
} as const;

const MIME_TO_TYPE: Record<string, MediaType> = Object.entries(ALLOWED_MIME).reduce(
  (acc, [type, mimes]) => {
    for (const m of mimes) acc[m] = type as MediaType;
    return acc;
  },
  {} as Record<string, MediaType>,
);

export function classifyMime(mime: string): MediaType | null {
  return MIME_TO_TYPE[mime] ?? null;
}

export interface ValidateFileInput {
  size: number;
  mime: string;
  maxBytes: number;
}

export interface ValidateFileResult {
  ok: boolean;
  mediaType?: MediaType;
  error?: string;
}

export function validateFile({ size, mime, maxBytes }: ValidateFileInput): ValidateFileResult {
  const mediaType = classifyMime(mime);
  if (!mediaType) {
    return { ok: false, error: `Unsupported file type: ${mime || "unknown"}` };
  }
  if (size > maxBytes) {
    const mb = (maxBytes / (1024 * 1024)).toFixed(0);
    return { ok: false, error: `File is too large. Max ${mb} MB.` };
  }
  if (size <= 0) {
    return { ok: false, error: "File is empty." };
  }
  return { ok: true, mediaType };
}

export function safeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[.-]+|[.-]+$/g, "")
    .slice(0, 120);
}

export function buildStoragePath(userId: string, postId: string | "drafts", filename: string) {
  const ts = new Date().toISOString().replace(/[:.]/g, "-");
  return `${userId}/${postId}/${ts}-${safeFilename(filename)}`;
}
