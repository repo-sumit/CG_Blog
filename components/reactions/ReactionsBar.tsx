"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { REACTION_EMOJIS, type ReactionEmoji } from "@/lib/db/public";
import { toggleReaction } from "@/app/posts/[slug]/actions";
import { cn } from "@/lib/utils/cn";

interface Props {
  postId: string;
  postSlug: string;
  counts: Record<ReactionEmoji, number>;
  myReactions: ReactionEmoji[];
  isAuthenticated: boolean;
}

export function ReactionsBar({ postId, postSlug, counts, myReactions, isAuthenticated }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  // Local optimistic state so the button reads as toggled the instant the
  // user clicks, without waiting for the server round-trip.
  const [local, setLocal] = useState<{ counts: Record<ReactionEmoji, number>; mine: Set<ReactionEmoji> }>({
    counts,
    mine: new Set(myReactions),
  });

  function click(emoji: ReactionEmoji) {
    if (!isAuthenticated) {
      // Bounce through /login with a return URL so the user lands back here.
      router.push(`/login?redirect=${encodeURIComponent(`/posts/${postSlug}`)}`);
      return;
    }
    // Optimistic toggle
    setLocal((prev) => {
      const mine = new Set(prev.mine);
      const counts = { ...prev.counts };
      if (mine.has(emoji)) {
        mine.delete(emoji);
        counts[emoji] = Math.max(0, counts[emoji] - 1);
      } else {
        mine.add(emoji);
        counts[emoji] = counts[emoji] + 1;
      }
      return { counts, mine };
    });
    startTransition(async () => {
      const res = await toggleReaction({ postId, emoji });
      if (!res.ok) {
        // Roll back the optimistic update on failure.
        setLocal((prev) => {
          const mine = new Set(prev.mine);
          const counts = { ...prev.counts };
          if (mine.has(emoji)) {
            mine.delete(emoji);
            counts[emoji] = Math.max(0, counts[emoji] - 1);
          } else {
            mine.add(emoji);
            counts[emoji] = counts[emoji] + 1;
          }
          return { counts, mine };
        });
        toast.error(res.error ?? "Failed to react.");
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {REACTION_EMOJIS.map((e) => {
        const reacted = local.mine.has(e);
        const count = local.counts[e] ?? 0;
        return (
          <button
            key={e}
            type="button"
            onClick={() => click(e)}
            disabled={pending}
            aria-pressed={reacted}
            aria-label={`React with ${e}`}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-pill border px-3 py-1.5 transition-colors",
              reacted
                ? "border-portal-orange/40 bg-portal-orange/10 text-portal-orange"
                : "border-portal-border-soft bg-portal-panel-soft text-portal-text-muted hover:border-portal-border-muted hover:text-portal-text",
              pending && "opacity-60",
            )}
          >
            <span aria-hidden className="text-base leading-none">{e}</span>
            <span className="font-ui text-[11px] tabular-nums">{count}</span>
          </button>
        );
      })}
      {!isAuthenticated && (
        <Link
          href={`/login?redirect=${encodeURIComponent(`/posts/${postSlug}`)}`}
          className="ml-2 text-[10px] uppercase tracking-wider text-portal-text-muted hover:text-portal-text underline-offset-2 hover:underline"
        >
          Sign in to react
        </Link>
      )}
    </div>
  );
}
