"use client";

import { useState } from "react";
import { toast } from "sonner";
import { Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Panel, PanelBody, PanelHeader } from "@/components/portal/Panel";
import { SystemLabel } from "@/components/portal/SystemLabel";
import { createSupabaseBrowserClient } from "@/lib/supabase/client";
import { isValidDomain } from "@/lib/auth/roles";
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
    if (!isValidDomain(email, ALLOWED_DOMAIN)) {
      setError(`Please use your @${ALLOWED_DOMAIN} email address.`);
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
      toast.success("Signal sent — check your inbox.");
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
          queryParams: { hd: ALLOWED_DOMAIN, prompt: "select_account" },
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
        <div className="flex flex-col">
          <SystemLabel tone="orange">{"002 // SIGN IN"}</SystemLabel>
          <div className="font-hero text-2xl font-bold uppercase tracking-tighter text-portal-text mt-1">
            Authenticate
          </div>
        </div>
        <SystemLabel dot tone="green">Active</SystemLabel>
      </PanelHeader>

      <PanelBody className="space-y-5">
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
          <SystemLabel>or magic link</SystemLabel>
          <div className="h-px flex-1 bg-portal-border-soft" />
        </div>

        {sent ? (
          <div className="rounded-md border-2 border-portal-green/30 bg-portal-green/5 p-4">
            <SystemLabel tone="green" dot className="mb-1">Transmission Sent</SystemLabel>
            <div className="text-sm text-portal-text">
              Open the sign-in link from <span className="text-portal-text font-bold">{email}</span> in this browser.
            </div>
          </div>
        ) : (
          <form onSubmit={handleMagicLink} className="space-y-3">
            <label className="block">
              <SystemLabel className="mb-2 block">Email</SystemLabel>
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
              Send Magic Link
            </Button>
          </form>
        )}

        {error && (
          <div
            role="alert"
            className="rounded-md border-2 border-portal-red/40 bg-portal-red/5 p-3 text-sm text-portal-red"
          >
            {decodeURIComponent(error)}
          </div>
        )}

        <div className="border-t-2 border-portal-border-soft pt-3 text-center">
          <SystemLabel>Hint: use your @{ALLOWED_DOMAIN} address</SystemLabel>
        </div>
      </PanelBody>
    </Panel>
  );
}
