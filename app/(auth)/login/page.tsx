import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { getSessionContext } from "@/lib/auth/guards";
import LoginForm from "@/components/auth/LoginForm";
import { BrandLockup } from "@/components/portal/BrandLockup";
import { SystemLabel, JapaneseLabel } from "@/components/portal/SystemLabel";
import { Ticker } from "@/components/portal/Ticker";

export const metadata: Metadata = { title: "Boot · Sign in" };

const LOGIN_TICKER = [
  "BOOT SEQUENCE INITIATED",
  "DARK SIGNAL LOCKED",
  "CONVEGENIUS PORTAL",
  "AUTH GATE ACTIVE",
];

export default async function LoginPage({
  searchParams,
}: {
  searchParams: { redirect?: string; error?: string; code?: string };
}) {
  if (searchParams.code) {
    const params = new URLSearchParams({ code: searchParams.code });
    if (searchParams.redirect) params.set("redirect", searchParams.redirect);
    redirect(`/api/auth/callback?${params.toString()}`);
  }
  const ctx = await getSessionContext();
  if (ctx) redirect(searchParams.redirect ?? "/dashboard");

  return (
    <main className="relative min-h-screen overflow-hidden">
      {/* Background radial accents */}
      <div className="pointer-events-none absolute inset-0 hero-gradient opacity-90" aria-hidden />
      <div className="pointer-events-none absolute inset-0 grid-overlay opacity-30" aria-hidden />

      <div className="container relative mx-auto flex min-h-screen flex-col px-4 py-6">
        <div className="mb-8">
          <Ticker items={LOGIN_TICKER} />
        </div>

        <div className="mx-auto flex w-full max-w-5xl flex-1 items-center">
          <div className="grid w-full gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16">
            {/* Left: hero / brand zone */}
            <div className="flex flex-col gap-8">
              <BrandLockup size="lg" />

              <div className="space-y-4">
                <SystemLabel tone="orange">{"001 // PORTAL ENTRY"}</SystemLabel>
                <h1 className="font-hero text-5xl font-bold uppercase leading-none tracking-tighter text-portal-text sm:text-6xl lg:text-7xl">
                  The Team
                  <br />
                  Signal Portal.
                </h1>
                <p className="max-w-md text-base leading-relaxed text-portal-text-muted">
                  Weekly transmissions from across ConveGenius. Sign in with your
                  workspace email to read the signal feed and broadcast your own.
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-6 pt-4">
                <SystemLabel tone="green" dot>Domain Locked · convegenius.ai</SystemLabel>
                <JapaneseLabel>ポータル · 信号</JapaneseLabel>
              </div>
            </div>

            {/* Right: actual login card */}
            <LoginForm
              redirectTo={searchParams.redirect ?? "/dashboard"}
              initialError={searchParams.error}
            />
          </div>
        </div>

        <div className="mt-12 flex items-center justify-between text-portal-text-soft">
          <SystemLabel>Portal v1.0</SystemLabel>
          <SystemLabel>CG · Internal Blog OS</SystemLabel>
        </div>
      </div>
    </main>
  );
}
