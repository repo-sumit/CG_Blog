import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Panel, PanelBody } from "@/components/portal/Panel";

export const metadata: Metadata = { title: "Access denied" };

const ALLOWED_DOMAIN = process.env.APP_ALLOWED_EMAIL_DOMAIN ?? "convegenius.ai";

export default function UnauthorizedPage({
  searchParams,
}: {
  searchParams: { reason?: string };
}) {
  const reason = searchParams.reason;
  return (
    <main className="min-h-screen">
      <div className="container mx-auto flex min-h-screen items-center px-4">
        <Panel variant="bright" className="mx-auto w-full max-w-lg">
          <PanelBody className="space-y-5 p-10 text-center">
            <div className="mx-auto inline-flex h-12 w-12 items-center justify-center rounded-full border border-portal-red/40 bg-portal-red/10 text-portal-red">
              <ShieldAlert className="h-6 w-6" />
            </div>
            <h1 className="font-hero text-3xl font-bold uppercase tracking-tighter text-portal-text">
              Access restricted
            </h1>
            <p className="text-sm leading-relaxed text-portal-text-muted">
              {reason === "domain"
                ? `This portal is limited to @${ALLOWED_DOMAIN} accounts. Sign in with your workspace email.`
                : "Your account does not have access to this portal."}
            </p>
            <Button asChild>
              <Link href="/login">Back to sign in</Link>
            </Button>
          </PanelBody>
        </Panel>
      </div>
    </main>
  );
}
