"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Mail, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { track } from "@/lib/analytics/track";

interface SubscribeResponse {
  ok?: boolean;
  status?: "subscribed" | "already_subscribed" | "reactivated";
  error?: string;
}

const VALID_EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Newsletter sign-up — posts to `/api/subscribe`, which records the email
 * in Supabase and fires a welcome email via Resend. Single opt-in.
 *
 * Restored on the landing page after the May 2026 mobile pass — the section
 * was temporarily hidden during the editor restructure. The form layout is
 * now stacked on mobile (input on top, full-width button below) so the
 * button never falls off the right edge of the viewport.
 */
export function SubscribeSection() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim().toLowerCase();
    if (!VALID_EMAIL_RE.test(trimmed)) {
      toast.error("Enter a valid email address.");
      return;
    }
    setSubmitting(true);
    track("subscribe_started", { source: "landing" });
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, source: "landing" }),
      });
      const json = (await res.json().catch(() => ({}))) as SubscribeResponse;
      if (!res.ok || json.ok !== true) {
        const friendly =
          res.status === 400
            ? "Enter a valid email address."
            : json.error || "Subscription failed. Please try again.";
        throw new Error(friendly);
      }
      setDone(true);
      track("subscribe_success", { source: "landing" });
      if (json.status === "already_subscribed") {
        toast.success("You are already subscribed.");
      } else {
        toast.success("Signal locked. You are subscribed.");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Subscription failed. Please try again.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="container mx-auto w-full max-w-full min-w-0 px-4 py-12 sm:py-16">
      <div
        className="relative w-full overflow-hidden rounded-md border border-portal-border-muted bg-portal-panel-soft p-6 sm:p-10 lg:p-12"
        style={{
          background:
            "radial-gradient(circle at 50% 0%, rgba(79,140,255,0.14), transparent 45%), radial-gradient(circle at 90% 100%, rgba(255,90,31,0.10), transparent 50%), var(--bg-panel-soft)",
        }}
      >
        <div className="relative grid gap-6 lg:grid-cols-[1.1fr_1fr] lg:items-center lg:gap-10">
          <div className="space-y-3">
            <div className="text-[11px] uppercase tracking-wider text-portal-orange">
              ConveGenius Daily Signals
            </div>
            <h2 className="font-hero text-2xl font-bold uppercase tracking-tighter text-portal-text sm:text-4xl lg:text-5xl">
              Receive the next signal
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-portal-text-muted">
              Get new ConveGenius team posts in your inbox. No spam. Only published signals.
            </p>
          </div>

          {done ? (
            <div className="rounded-md border border-portal-green/30 bg-portal-green/5 p-5 text-center sm:p-6">
              <CheckCircle2 className="mx-auto h-8 w-8 text-portal-green" />
              <div className="mt-3 font-hero text-lg font-bold uppercase tracking-tighter text-portal-text">
                You're subscribed
              </div>
              <p className="mt-2 text-sm text-portal-text-muted">
                A welcome email is on the way. Look for it from CG Signal.
              </p>
            </div>
          ) : (
            <form
              onSubmit={onSubmit}
              className="space-y-3 rounded-md border border-portal-border-soft bg-portal-main/60 p-4 backdrop-blur sm:p-5"
            >
              <label className="block">
                <span className="mb-1.5 block text-[10px] uppercase tracking-wider text-portal-text-muted">
                  Email
                </span>
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="your.email@example.com"
                  autoComplete="email"
                  inputMode="email"
                  className="h-11 w-full rounded-pill border-2 border-portal-border-muted bg-portal-panel-soft px-4 font-ui text-sm text-portal-text placeholder:text-portal-text-soft focus-visible:border-portal-blue focus-visible:outline-none focus-visible:shadow-[0_0_0_4px_rgba(79,140,255,0.18)]"
                />
              </label>
              {/* Button: full-width on mobile so it never gets pushed off
                  the right edge; auto-width on sm+ for a tidier desktop row. */}
              <Button type="submit" disabled={submitting} className="w-full sm:w-auto">
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                Subscribe
              </Button>
              <p className="text-[10px] uppercase tracking-wider text-portal-text-muted">
                Unsubscribe anytime · No tracking pixels
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
