"use client";

import { useEffect } from "react";
import { ArrowDown } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { track } from "@/lib/analytics/track";

interface Props {
  /** Target subscribe-section DOM id to scroll/focus on click. */
  targetId?: string;
  /** Slug of the post hosting this CTA — flows into analytics. */
  postSlug?: string;
}

/**
 * Inline mid-article reminder. Single button: scrolls to the main subscribe
 * section at the bottom of the page and focuses its email input. Used at most
 * once per article, only when the article is long enough that the bottom
 * subscribe block is far below the reader's eye.
 *
 * Deliberately a smaller, quieter chrome than `SubscribeSection` — this is a
 * nudge, not a second form.
 */
export function SubscribeMiniCta({ targetId = "newsletter-subscribe", postSlug }: Props) {
  useEffect(() => {
    track("subscribe_cta_view", {
      source: "post",
      placement: "mid_article",
      postSlug,
    });
  }, [postSlug]);

  function handleClick(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault();
    const target = document.getElementById(targetId);
    if (!target) return;
    target.scrollIntoView({ behavior: "smooth", block: "center" });
    // Pull focus into the email input after the scroll resolves — gives
    // keyboard users a clean handoff and tells screen readers what just
    // changed. `<input type="email">` is the canonical form field, so we
    // query for it inside the target section rather than assuming an id.
    window.setTimeout(() => {
      const input = target.querySelector<HTMLInputElement>('input[type="email"]');
      input?.focus({ preventScroll: true });
    }, 450);
  }

  return (
    <aside
      role="complementary"
      aria-label="Subscribe reminder"
      className="not-prose my-10 flex flex-col items-start gap-3 rounded-md border border-portal-border-soft bg-portal-panel-soft p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6"
    >
      <div className="min-w-0">
        <div className="text-[10px] uppercase tracking-wider text-portal-orange">
          Enjoying this signal?
        </div>
        <p className="mt-1 text-sm leading-relaxed text-portal-text-muted">
          Subscribe to receive future posts directly in your inbox.
        </p>
      </div>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={handleClick}
        className="shrink-0"
      >
        Subscribe <ArrowDown className="h-4 w-4" />
      </Button>
    </aside>
  );
}
