import { NextResponse, type NextRequest } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { buildStoragePath, validateFile } from "@/lib/utils/file-validation";
import { publicEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BUCKET = "blog-media";
const SIGNED_TTL = 60 * 60 * 24 * 7; // 7 days

export async function POST(request: NextRequest) {
  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: profile } = await supabase.from("profiles").select("role").eq("id", user.id).maybeSingle();
  const role = (profile as { role?: string } | null)?.role;
  if (role !== "author" && role !== "manager") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const form = await request.formData();
  const file = form.get("file");
  const postId = (form.get("postId") as string | null) ?? null;
  if (!(file instanceof File)) {
    return NextResponse.json({ error: "Missing file" }, { status: 400 });
  }

  const maxBytes = publicEnv.maxUploadMb * 1024 * 1024;
  const v = validateFile({ size: file.size, mime: file.type, maxBytes });
  if (!v.ok || !v.mediaType) {
    return NextResponse.json({ error: v.error ?? "Invalid file" }, { status: 400 });
  }

  const path = buildStoragePath(user.id, postId ?? "drafts", file.name);
  const bytes = Buffer.from(await file.arrayBuffer());

  const { error: upErr } = await supabase.storage.from(BUCKET).upload(path, bytes, {
    contentType: file.type,
    upsert: false,
  });
  if (upErr) {
    return NextResponse.json({ error: upErr.message }, { status: 500 });
  }

  const { data: signed, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUrl(path, SIGNED_TTL);
  if (signErr || !signed) {
    return NextResponse.json({ error: signErr?.message ?? "Failed to sign URL" }, { status: 500 });
  }

  // Record asset.
  await supabase.from("media_assets").insert({
    owner_id: user.id,
    post_id: postId,
    storage_bucket: BUCKET,
    storage_path: path,
    source_type: "upload",
    media_type: v.mediaType,
    mime_type: file.type,
    size_bytes: file.size,
    title: file.name,
  });

  return NextResponse.json({
    ok: true,
    path,
    signedUrl: signed.signedUrl,
    mediaType: v.mediaType,
  });
}
