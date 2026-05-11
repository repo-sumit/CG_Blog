"use client";

import { useState } from "react";
import { toast } from "sonner";
import { LogIn, Mail, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/Card";
import { Input } from "@/components/ui/Input";
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
      toast.success("Check your inbox for the sign-in link.");
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
    <Card>
      <CardHeader>
        <CardTitle>Sign in</CardTitle>
        <CardDescription>
          Use your ConveGenius.ai email. Access is limited to authorized team members.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <Button
          type="button"
          variant="outline"
          className="w-full"
          onClick={handleGoogle}
          disabled={oauthing}
        >
          {oauthing ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <LogIn className="mr-2 h-4 w-4" />
          )}
          Continue with Google
        </Button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center">
            <span className="w-full border-t border-border" />
          </div>
          <div className="relative flex justify-center text-xs uppercase tracking-wider">
            <span className="bg-card px-2 text-muted-foreground">or magic link</span>
          </div>
        </div>

        {sent ? (
          <div className="rounded-lg border bg-muted/40 p-4 text-sm">
            <Mail className="inline h-4 w-4 mr-2 align-text-bottom" />
            We sent a sign-in link to <span className="font-medium">{email}</span>. Open it from the same browser.
          </div>
        ) : (
          <form onSubmit={handleMagicLink} className="space-y-3">
            <label className="block">
              <span className="text-sm font-medium">Email</span>
              <Input
                type="email"
                autoComplete="email"
                required
                placeholder={`you@${ALLOWED_DOMAIN}`}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1"
              />
            </label>
            <Button type="submit" className="w-full" disabled={sending}>
              {sending ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Mail className="mr-2 h-4 w-4" />}
              Send magic link
            </Button>
          </form>
        )}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {decodeURIComponent(error)}
          </p>
        )}

        <p className="text-xs text-muted-foreground text-center pt-2">
          Domain hint: use your <span className="font-medium">@{ALLOWED_DOMAIN}</span> address.
        </p>
      </CardContent>
    </Card>
  );
}
