"use client";

import { useEffect, useRef } from "react";
import { track } from "@/lib/analytics/track";

interface Props {
  postId: string;
  slug: string;
  title: string;
  author: string | null;
  isLoggedIn: boolean;
}

const THROTTLE_MS = 30 * 60 * 1000; // 30 minutes — matches server-side dedupe.
const STORAGE_PREFIX = "cg_signal_viewed_";
const SESSION_KEY = "cg_signal_session";

/** Persists a stable per-browser session id so the server can dedupe POSTs. */
function getOrCreateSessionId(): string {
  if (typeof window === "undefined") return "";
  try {
    const existing = window.localStorage.getItem(SESSION_KEY);
    if (existing) return existing;
    const fresh =
      typeof crypto !== "undefined" && "randomUUID" in crypto
        ? crypto.randomUUID()
        : Math.random().toString(36).slice(2) + Date.now().toString(36);
    window.localStorage.setItem(SESSION_KEY, fresh);
    return fresh;
  } catch {
    // Private mode / disabled storage — fall back to a per-tab session id.
    return Math.random().toString(36).slice(2);
  }
}

/** True when the post hasn't been viewed (from this browser) in the throttle window. */
function shouldRecord(postId: string): boolean {
  if (typeof window === "undefined") return false;
  try {
    const key = `${STORAGE_PREFIX}${postId}`;
    const raw = window.localStorage.getItem(key);
    if (raw) {
      const ts = Number(raw);
      if (!Number.isNaN(ts) && Date.now() - ts < THROTTLE_MS) return false;
    }
    window.localStorage.setItem(key, String(Date.now()));
    return true;
  } catch {
    // Storage unavailable → record every view rather than miss them.
    return true;
  }
}

/**
 * Mounts on the public post detail page. Fires:
 *   1. Vercel Analytics `post_view` event (always, every navigation)
 *   2. Supabase `/api/analytics/post-view` POST (throttled, ~once / 30 min)
 *
 * The split matters: Vercel gives us session-level traffic, Supabase gives us
 * deduped per-post counts that we surface back to authors + admins.
 */
export function PostViewTracker({ postId, slug, title, author, isLoggedIn }: Props) {
  // useRef guards against React 18 strict-mode double-invoke firing the
  // effect twice; without it, every dev render would POST twice.
  const firedRef = useRef(false);

  useEffect(() => {
    if (firedRef.current) return;
    firedRef.current = true;

    // 1. Always emit to Vercel — they handle their own throttling.
    track("post_view", {
      postId,
      slug,
      title,
      author: author ?? undefined,
      isLoggedIn,
    });

    // 2. Throttled Supabase record. Skip the network call when the same
    //    browser hit this post in the last 30 minutes.
    if (!shouldRecord(postId)) return;
    const sessionId = getOrCreateSessionId();
    const referrer = typeof document !== "undefined" ? document.referrer || null : null;
    void fetch("/api/analytics/post-view", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ postId, slug, sessionId, referrer }),
      // Best-effort. We don't await + don't surface errors — analytics
      // must never block the reader experience.
      keepalive: true,
    }).catch(() => {
      /* swallow; analytics failures are non-fatal */
    });
  }, [postId, slug, title, author, isLoggedIn]);

  return null;
}
