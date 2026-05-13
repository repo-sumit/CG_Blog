"use client";

import { track as vercelTrack } from "@vercel/analytics";

/**
 * Typed wrapper around Vercel Analytics `track()`. Keeping a single allow-list
 * of event names + payload shapes makes it impossible to ship a typo (e.g.
 * `post_view` vs `post-view`) and shrinks the surface where we accidentally
 * leak PII into analytics.
 *
 * Payload rules:
 *   - identifiers (post id, slug, author id) are fine — these are public.
 *   - role / login state are fine — they help cohort analysis.
 *   - emails / tokens / draft content / raw IPs must NEVER appear here.
 */

type Primitive = string | number | boolean | null;

interface PostView {
  postId: string;
  slug: string;
  title?: string;
  author?: string;
  isLoggedIn: boolean;
}

interface PostOpened {
  postId: string;
  slug: string;
  source?: "landing" | "search" | "related" | "direct";
}

interface LoginEvent {
  provider?: "google";
}

interface CommentAdded {
  postId: string;
  slug: string;
}

interface ReactionAdded {
  postId: string;
  slug: string;
  emoji: string;
  toggled: "on" | "off";
}

interface SubscribeEvent {
  source?: string;
}

interface PostStatusEvent {
  postId: string;
  slug: string;
  isManager: boolean;
}

interface PostScheduledEvent extends PostStatusEvent {
  scheduledForIso: string;
}

export type TrackEvents = {
  post_view: PostView;
  post_opened: PostOpened;
  login_started: LoginEvent;
  login_success: LoginEvent;
  comment_added: CommentAdded;
  reaction_added: ReactionAdded;
  subscribe_started: SubscribeEvent;
  subscribe_success: SubscribeEvent;
  post_published: PostStatusEvent;
  post_scheduled: PostScheduledEvent;
};

export type TrackEventName = keyof TrackEvents;

/**
 * Fire-and-forget. Vercel's `track()` is a no-op in dev / on non-Vercel hosts,
 * but we still try/catch so a stray analytics failure can never crash the UI.
 */
export function track<E extends TrackEventName>(name: E, payload: TrackEvents[E]): void {
  try {
    vercelTrack(name, payload as Record<string, Primitive>);
  } catch (err) {
    // Intentionally silent — analytics MUST NOT break user-facing flows.
    if (process.env.NODE_ENV !== "production") {
      console.warn(`[analytics] track(${name}) failed`, err);
    }
  }
}
