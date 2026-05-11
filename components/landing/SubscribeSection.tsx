"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Mail, Loader2, CheckCircle2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Newsletter sign-up — posts to `/api/subscribe`, which records the email in
 * Supabase and fires a welcome email via Resend. Single opt-in.
 */
export function SubscribeSection() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      toast.error("Enter a valid email address.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: trimmed, source: "landing" }),
      });
      const json = (await res.json().catch(() => ({}))) as { ok?: boolean; error?: string };
      if (!res.ok || json.ok !== true) {
        throw new Error(json.error || `HTTP ${res.status}`);
      }
      setDone(true);
      toast.success("You're in — check your inbox for a welcome email.");
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Subscribe failed.";
      toast.error(msg);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <section className="container mx-auto px-4 py-16">
      <div
        className="relative overflow-hidden rounded-md border border-portal-border-muted bg-portal-panel-soft p-8 sm:p-12"
        style={{
          background:
            "radial-gradient(circle at 50% 0%, rgba(79,140,255,0.14), transparent 45%), radial-gradient(circle at 90% 100%, rgba(255,90,31,0.10), transparent 50%), var(--bg-panel-soft)",
        }}
      >
        <div className="relative grid gap-8 lg:grid-cols-[1.1fr_1fr] lg:items-center">
          <div className="space-y-3">
            <div className="text-[11px] uppercase tracking-wider text-portal-orange">
              ConveGenius Weekly Signals
            </div>
            <h2 className="font-hero text-3xl font-bold uppercase tracking-tighter text-portal-text sm:text-5xl">
              Receive the next
              <br />
              <span className="text-portal-text-muted">signal.</span>
            </h2>
            <p className="max-w-md text-sm leading-relaxed text-portal-text-muted">
              One email per week. The latest transmissions from team Dhurandhar — nothing else.
              No spam, no tracking pixels, no daily nags.
            </p>
          </div>

          {done ? (
            <div className="rounded-md border border-portal-green/30 bg-portal-green/5 p-6 text-center backdrop-blur">
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
              className="space-y-3 rounded-md border border-portal-border-soft bg-portal-main/60 p-5 backdrop-blur"
            >
              <label className="block">
                <span className="mb-1.5 block text-[10px] uppercase tracking-wider text-portal-text-muted">
                  Email
                </span>
                <div className="flex gap-2">
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="h-11 flex-1 rounded-pill border-2 border-portal-border-muted bg-portal-panel-soft px-4 font-ui text-sm text-portal-text placeholder:text-portal-text-soft focus-visible:border-portal-blue focus-visible:outline-none focus-visible:shadow-[0_0_0_4px_rgba(79,140,255,0.18)]"
                  />
                  <Button type="submit" disabled={submitting}>
                    {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
                    Subscribe
                  </Button>
                </div>
              </label>
              <p className="text-[10px] uppercase tracking-wider text-portal-text-muted">
                Weekly · Mondays · Unsubscribe anytime
              </p>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
