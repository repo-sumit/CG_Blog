import type { Metadata } from "next";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import { Panel, PanelBody } from "@/components/portal/Panel";
import { SystemLabel, JapaneseLabel } from "@/components/portal/SystemLabel";

export const metadata: Metadata = { title: "Access denied" };

const ALLOWED_DOMAIN = process.env.APP_ALLOWED_EMAIL_DOMAIN ?? "convegenius.ai";

export default function UnauthorizedPage({
  searchParams,
}: {
  searchParams: { reason?: string };
}) {
  const reason = searchParams.reason;
  return (
    <main className="relative min-h-screen overflow-hidden">
      <div className="pointer-events-none absolute inset-0 hero-gradient opacity-80" aria-hidden />
      <div className="pointer-events-none absolute inset-0 grid-overlay opacity-30" aria-hidden />

      <div className="container relative mx-auto flex min-h-screen items-center px-4">
        <Panel variant="bright" className="mx-auto w-full max-w-lg">
          <PanelBody className="space-y-6 text-center p-10">
            <div className="flex items-center justify-center gap-3">
              <SystemLabel tone="orange" dot>Access Denied</SystemLabel>
              <JapaneseLabel>暗号</JapaneseLabel>
            </div>

            <h1 className="font-hero text-4xl font-bold uppercase tracking-tighter text-portal-text">
              Signal Refused
            </h1>

            <p className="text-sm leading-relaxed text-portal-text-muted">
              {reason === "domain"
                ? `This portal is locked to @${ALLOWED_DOMAIN} accounts. Sign in with your workspace email.`
                : "Your account does not have access to this portal."}
            </p>

            <div className="pt-2">
              <Button asChild>
                <Link href="/login">Return to sign in</Link>
              </Button>
            </div>

            <div className="border-t-2 border-portal-border-soft pt-4">
              <SystemLabel>CG SIGNAL · Internal Blog OS</SystemLabel>
            </div>
          </PanelBody>
        </Panel>
      </div>
    </main>
  );
}
