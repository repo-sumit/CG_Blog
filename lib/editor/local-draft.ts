/**
 * Local draft backup for the post editor.
 *
 * Wraps `localStorage` so the editor can persist an in-progress snapshot
 * every few seconds without depending on a successful server save. If the
 * tab crashes / network drops / browser quits between two autosaves, the
 * next mount can detect a newer local snapshot than the server has and
 * offer to restore it.
 *
 * Storage budget: localStorage caps at ~5 MB per origin. Drafts are JSON
 * + sanitized HTML — typically under 200 KB even with multi-media posts.
 * We cap at 2 MB just in case to leave headroom for the rest of the app.
 *
 * Privacy: this only stores the post the *current* user is actively
 * editing on the *current* device. Auth tokens, signed URLs, and service
 * credentials are NEVER written to localStorage by this module.
 */

const KEY_PREFIX = "cg_signal_draft_";
const MAX_SNAPSHOT_BYTES = 2 * 1024 * 1024; // 2 MB cap.

export interface LocalDraftSnapshot {
  title: string;
  excerpt: string | null;
  contentJSON: unknown;
  contentHTML: string;
  status: string;
  scheduledFor: string | null;
  tagIds: string[];
  coverMediaId: string | null;
  /** ISO timestamp the local snapshot was written. */
  savedAt: string;
}

function keyFor(postId: string | undefined): string {
  return `${KEY_PREFIX}${postId ?? "new"}`;
}

/**
 * Safe localStorage read. Returns null when SSR (no `window`), when the
 * value is missing, or when stored JSON is malformed.
 */
export function loadLocalDraft(postId: string | undefined): LocalDraftSnapshot | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(keyFor(postId));
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<LocalDraftSnapshot>;
    if (!parsed || typeof parsed.savedAt !== "string") return null;
    return parsed as LocalDraftSnapshot;
  } catch {
    return null;
  }
}

/**
 * Safe write. Returns false when SSR, when the payload exceeds the 2 MB
 * cap, or when the browser throws a quota error. Callers should treat a
 * false return as "we tried but couldn't" — not a fatal error.
 */
export function saveLocalDraft(
  postId: string | undefined,
  snapshot: LocalDraftSnapshot,
): boolean {
  if (typeof window === "undefined") return false;
  let payload: string;
  try {
    payload = JSON.stringify(snapshot);
  } catch {
    return false;
  }
  if (payload.length > MAX_SNAPSHOT_BYTES) return false;
  try {
    window.localStorage.setItem(keyFor(postId), payload);
    return true;
  } catch {
    return false;
  }
}

export function clearLocalDraft(postId: string | undefined): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(keyFor(postId));
  } catch {
    // Storage may be disabled (private mode in some browsers) — ignore.
  }
}

/**
 * Compares the local snapshot's `savedAt` against the server's last-modified
 * timestamp. Returns true when the local copy is meaningfully newer (we use
 * a 1s skew tolerance so a save that round-tripped doesn't trigger a false
 * "newer local copy" prompt).
 */
export function isLocalDraftNewerThan(
  snapshot: LocalDraftSnapshot,
  serverUpdatedAt: string | null | undefined,
): boolean {
  if (!serverUpdatedAt) return true; // no server copy → local is canonically newer
  const local = Date.parse(snapshot.savedAt);
  const server = Date.parse(serverUpdatedAt);
  if (Number.isNaN(local) || Number.isNaN(server)) return false;
  return local - server > 1000;
}
