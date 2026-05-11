// Shared reaction constants — importable from both server and client code.
// Kept out of `lib/db/public.ts` because that module is server-only and would
// taint any client bundle that imports it.

export const REACTION_EMOJIS = ["👍", "❤️", "😂", "🎉", "👀", "🚀"] as const;
export type ReactionEmoji = (typeof REACTION_EMOJIS)[number];

/** Human-readable name for each reaction — used for aria-labels. */
export const REACTION_LABELS: Record<ReactionEmoji, string> = {
  "👍": "Thumbs up",
  "❤️": "Love",
  "😂": "Laugh",
  "🎉": "Celebrate",
  "👀": "Eyes",
  "🚀": "Rocket",
};
