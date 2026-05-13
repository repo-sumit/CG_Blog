"use client";

import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { buildStoragePath } from "@/lib/utils/file-validation";
import type { MediaType } from "@/lib/db/types";

const BUCKET = "blog-media";

export interface DirectUploadResult {
  ok: boolean;
  path?: string;
  mediaId?: string | null;
  signedUrl?: string;
  mediaType?: MediaType;
  error?: string;
}

/**
 * Uploads `file` to Supabase Storage directly from the browser, then asks
 * the API to record the resulting `media_assets` row.
 *
 * Why direct: Vercel's serverless gateway caps function request bodies at
 * 4.5 MB regardless of the function's own size limits. Anything bigger
 * (videos, large images) fails with `FUNCTION_PAYLOAD_TOO_LARGE` before our
 * code runs. The fix is to send the bytes straight to Supabase — they're
 * not behind the Vercel gateway — and only round-trip a tiny JSON request
 * to our function for metadata bookkeeping.
 *
 * Auth + path safety: Supabase storage RLS only lets a signed-in author
 * write to `{user_id}/...` paths. The metadata endpoint additionally
 * validates that the claimed path's first folder matches `auth.uid()` so
 * one user can't claim ownership of another user's upload by guessing a
 * filename.
 */
export async function directUploadMedia({
  file,
  postId,
  onProgress,
}: {
  file: File;
  postId?: string;
  /** Currently unused — kept on the API so callers can wire upload progress later. */
  onProgress?: (loaded: number, total: number) => void;
}): Promise<DirectUploadResult> {
  const supabase = createSupabaseBrowserClient();

  // We need the user's id to build the storage path so it matches the
  // `{uid}/{postId|drafts}/...` shape the RLS policy requires.
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return { ok: false, error: "You need to sign in again." };
  }

  // Reuse the same path builder the server used to use, so existing files
  // continue to be addressable by the same scheme.
  const path = buildStoragePath(user.id, postId ?? "drafts", file.name);

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, file, {
    contentType: file.type,
    cacheControl: "3600",
    upsert: false,
  });
  if (upErr) {
    // Supabase storage error messages are reasonable; surface them as-is.
    return { ok: false, error: upErr.message || "Upload failed." };
  }
  // `onProgress` placeholder — the supabase-js storage client doesn't expose
  // a progress callback today. Left here so a future xhr-based implementation
  // can wire it without changing the caller signature.
  onProgress?.(file.size, file.size);

  // Record the metadata row. Body is well under 4.5 MB.
  const res = await fetch("/api/media/upload", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      path,
      fileName: file.name,
      mimeType: file.type,
      sizeBytes: file.size,
      postId,
    }),
  });
  if (!res.ok) {
    const errText = await res.text().catch(() => "Failed to register upload.");
    // The blob is now orphaned in storage. We don't try to clean it up
    // automatically because re-uploading would leave the same orphan; the
    // daily cleanup-archived cron is the right place to add a sweeper.
    return { ok: false, error: errText };
  }
  const json = (await res.json()) as DirectUploadResult;
  // Spread the server payload first so its `ok` doesn't overwrite our true.
  return { ...json, ok: true };
}
