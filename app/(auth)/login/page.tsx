import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/guards";
import LoginForm from "@/components/auth/LoginForm";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { redirect?: string; error?: string; code?: string };
}) {
  // Self-heal: if Supabase fell back to the Site URL with an OAuth `code` in
  // the query string (because the configured redirectTo wasn't on the allow-
  // list), forward the code to our real callback so the session can complete.
  if (searchParams.code) {
    const params = new URLSearchParams({ code: searchParams.code });
    if (searchParams.redirect) params.set("redirect", searchParams.redirect);
    redirect(`/api/auth/callback?${params.toString()}`);
  }

  const ctx = await getSessionContext();
  if (ctx) redirect(searchParams.redirect ?? "/dashboard");

  return (
    <main className="min-h-screen grid place-items-center bg-gradient-to-b from-background to-muted/30 p-4">
      <div className="w-full max-w-md">
        <div className="mb-8 text-center">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary text-primary-foreground font-bold mb-3">
            CG
          </div>
          <h1 className="text-2xl font-semibold tracking-tight">ConveGenius Team Blog</h1>
          <p className="text-sm text-muted-foreground mt-1">
            Internal workspace. Sign in with your ConveGenius.ai email.
          </p>
        </div>
        <LoginForm
          redirectTo={searchParams.redirect ?? "/dashboard"}
          initialError={searchParams.error}
        />
      </div>
    </main>
  );
}
