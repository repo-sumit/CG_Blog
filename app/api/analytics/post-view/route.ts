import { NextResponse, type NextRequest } from "next/server";
import { createHmac } from "node:crypto";
import { z } from "zod";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { serverEnv } from "@/lib/env";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const BodySchema = z.object({
  postId: z.string().uuid().optional(),
  slug: z.string().min(1).max(200).optional(),
  sessionId: z.string().min(1).max(80).optional(),
  referrer: z.string().max(2048).optional().nullable(),
});

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Salted HMAC of the request IP — never store the raw value. */
function hashIp(ip: string): string {
  const secret = serverEnv().cronSecret || "fallback-ip-hash-salt";
  return createHmac("sha256", secret).update(ip).digest("hex").slice(0, 32);
}

function extractIp(request: NextRequest): string | null {
  // Vercel forwards via `x-forwarded-for`; behind a corporate proxy take the
  // first hop. Fall back to "anonymous" so the hash is still deterministic
  // per non-resolvable client.
  const fwd = request.headers.get("x-forwarded-for");
  if (fwd) {
    const first = fwd.split(",")[0]?.trim();
    if (first) return first;
  }
  const real = request.headers.get("x-real-ip");
  return real || null;
}

/**
 * POST /api/analytics/post-view
 *
 * Records a single post view. Authenticated callers get `viewer_id` stamped;
 * anonymous viewers contribute via `session_id` (client-supplied stable id).
 *
 * Server-side dedupe: if any view for (post_id, session_id) was recorded in
 * the last 30 minutes, we 200 the request without inserting again. The client
 * also gates on localStorage so duplicate POSTs rarely reach us — this is
 * the defense-in-depth tier.
 */
export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = BodySchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json({ ok: false, error: "Invalid input" }, { status: 400 });
  }

  const { postId, slug, sessionId, referrer } = parsed.data;
  if (!postId && !slug) {
    return NextResponse.json({ ok: false, error: "postId or slug required" }, { status: 400 });
  }

  // Resolve the post. Required visibility: published. Drafts / scheduled / archived
  // never count as a view.
  const service = createSupabaseServiceClient();
  const postQuery = service
    .from("posts")
    .select("id, status")
    .eq("status", "published")
    .limit(1);
  const { data: postRow, error: postErr } = postId
    ? await postQuery.eq("id", postId).maybeSingle()
    : await postQuery.eq("slug", slug!).maybeSingle();
  if (postErr) {
    return NextResponse.json({ ok: false, error: postErr.message }, { status: 500 });
  }
  const post = postRow as { id: string } | null;
  if (!post) {
    return NextResponse.json({ ok: false, error: "Post not found" }, { status: 404 });
  }

  // Identify the viewer if signed in.
  let viewerId: string | null = null;
  try {
    const authed = createSupabaseServerClient();
    const {
      data: { user },
    } = await authed.auth.getUser();
    viewerId = user?.id ?? null;
  } catch {
    // Cookies missing / Supabase down — still record as anonymous.
    viewerId = null;
  }

  const userAgent = request.headers.get("user-agent") ?? null;
  const ipRaw = extractIp(request);
  const ipHash = ipRaw ? hashIp(ipRaw) : null;

  // Dedupe: if we've already recorded a view in the last 30 minutes for the
  // same session on the same post, return success without inserting.
  if (sessionId) {
    const since = new Date(Date.now() - 30 * 60 * 1000).toISOString();
    const { data: recent } = await service
      .from("post_views")
      .select("id")
      .eq("post_id", post.id)
      .eq("session_id", sessionId)
      .gte("created_at", since)
      .limit(1);
    if (recent && recent.length > 0) {
      return NextResponse.json({ ok: true, deduped: true });
    }
  }

  const { error: insErr } = await service.from("post_views").insert({
    post_id: post.id,
    viewer_id: viewerId,
    session_id: sessionId ?? null,
    user_agent: userAgent,
    referrer: referrer ?? null,
    ip_hash: ipHash,
  });
  if (insErr) {
    console.error("[post-view] insert failed", insErr.message);
    // Don't surface DB errors to the client — analytics must not block reads.
    return NextResponse.json({ ok: true, recorded: false });
  }

  return NextResponse.json({ ok: true, recorded: true });
}
