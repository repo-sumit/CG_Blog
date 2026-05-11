"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";

/**
 * Newsletter sign-up section. There's no real email backend wired in yet,
 * so the form posts to a `mailto:` fallback — opening the user's mail client
 * with a pre-filled "subscribe me" message. When a real provider (Resend +
 * webhook, ConvertKit, Mailchimp, etc.) is connected, swap the `onSubmit`
 * handler for an actual POST.
 *
 * Intentionally feature-flagged — we do NOT fake an inbox/subscriber list.
 */

const SUBSCRIBE_MAILTO = "team-blog@convegenius.ai";

export function SubscribeSection() {
  const [email, setEmail] = useState("");
  const [submitting, setSubmitting] = useState(false);

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email.trim()) return;
    const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    if (!valid) {
      toast.error("Enter a valid email address.");
      return;
    }
    setSubmitting(true);
    // Open the user's mail client. This is a placeholder until a real list
    // provider is wired up — see the comment at the top of this file.
    const subject = encodeURIComponent("Subscribe me to ConveGenius Weekly Signals");
    const body = encodeURIComponent(`Please add this address to the CG Signal weekly digest: ${email.trim()}`);
    window.location.href = `mailto:${SUBSCRIBE_MAILTO}?subject=${subject}&body=${body}`;
    setTimeout(() => {
      setSubmitting(false);
      toast.success("Mail client opened — send the message to confirm.");
    }, 300);
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
              One email per week. The latest transmissions from the team, nothing else.
              No spam, no tracking pixels, no daily nags.
            </p>
          </div>

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
              Internal digest · {SUBSCRIBE_MAILTO}
            </p>
          </form>
        </div>
      </div>
    </section>
  );
}
