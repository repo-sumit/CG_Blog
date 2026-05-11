"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Panel, PanelBody, PanelHeader } from "@/components/portal/Panel";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { publicEnv } from "@/lib/env";

const ALLOWED_DOMAIN = "convegenius.ai";

interface Props {
  redirectTo: string;
  initialError?: string;
}

export default function LoginForm({ redirectTo, initialError }: Props) {
  const [email, setEmail] = useState("");
  const [sending, setSending] = useState(false);
  const [oauthing, setOauthing] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | undefined>(initialError);

  const callbackUrl = `${publicEnv.appUrl}/api/auth/callback?redirect=${encodeURIComponent(redirectTo)}`;

  async function handleMagicLink(e: React.FormEvent) {
    e.preventDefault();
    setError(undefined);
    const trimmed = email.trim().toLowerCase();
    // Basic email shape only — any provider is OK (Gmail for commenters,
    // workspace email for editors). Server-side decides editor access.
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed)) {
      setError("Please enter a valid email address.");
      return;
    }
    setSending(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOtp({
        email: email.trim().toLowerCase(),
        options: { emailRedirectTo: callbackUrl, shouldCreateUser: true },
      });
      if (error) throw error;
      setSent(true);
      toast.success("Sign-in link sent — check your inbox.");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Failed to send magic link.";
      setError(msg);
    } finally {
      setSending(false);
    }
  }

  async function handleGoogle() {
    setError(undefined);
    setOauthing(true);
    try {
      const supabase = createSupabaseBrowserClient();
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: {
          redirectTo: callbackUrl,
          // No `hd` hint — we want Gmail accounts to be selectable so external
          // commenters can sign in. The auth callback decides what they can
          // do once they're back (editor vs viewer).
          queryParams: { prompt: "select_account" },
        },
      });
      if (error) throw error;
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Google sign-in failed.";
      setError(msg);
      setOauthing(false);
    }
  }

  return (
    <Panel variant="bright" className="w-full">
      <PanelHeader>
        <div className="font-hero text-lg font-bold uppercase tracking-tighter text-portal-text">
          Sign in
        </div>
      </PanelHeader>

      <PanelBody className="space-y-4">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleGoogle}
          disabled={oauthing}
        >
          {oauthing ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            /* eslint-disable-next-line @next/next/no-img-element */
            <img src="/google.svg" alt="" width={16} height={16} />
          )}
          Continue with Google
        </Button>

        <div className="flex items-center gap-3">
          <div className="h-px flex-1 bg-portal-border-soft" />
          <span className="text-[10px] uppercase tracking-wider text-portal-text-muted">or magic link</span>
          <div className="h-px flex-1 bg-portal-border-soft" />
        </div>

        {sent ? (
          <div className="rounded-md border border-portal-green/30 bg-portal-green/5 p-4 text-sm text-portal-text">
            Sign-in link sent to <span className="font-bold">{email}</span>. Open it in this browser.
          </div>
        ) : (
          <form onSubmit={handleMagicLink} className="space-y-3">
            <label className="block">
              <span className="mb-1.5 block text-[10px] uppercase tracking-wider text-portal-text-muted">Email</span>
              <Input
                type="email"
                autoComplete="email"
                required
                placeholder={`you@${ALLOWED_DOMAIN}`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <Button type="submit" className="w-full" disabled={sending}>
              {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Mail className="h-4 w-4" />}
              Send magic link
            </Button>
          </form>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-md border border-portal-red/40 bg-portal-red/5 p-3 text-sm text-portal-red"
          >
            {decodeURIComponent(error)}
          </div>
        )}

        <p className="border-t border-portal-border-soft pt-3 text-center text-[10px] uppercase tracking-wider text-portal-text-muted">
          Editor access · @{ALLOWED_DOMAIN} only. Comment access · any Google account.
        </p>
      </PanelBody>
    </Panel>
  );
}
