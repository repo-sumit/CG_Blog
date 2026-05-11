import type { Metadata } from "next";
import Link from "next/link";
import { ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";

export const metadata: Metadata = { title: "Access restricted" };

const ALLOWED_DOMAIN = process.env.APP_ALLOWED_EMAIL_DOMAIN ?? "convegenius.ai";

export default function UnauthorizedPage({
  searchParams,
}: {
  searchParams: { reason?: string };
}) {
  const reason = searchParams.reason;
  return (
    <main className="min-h-screen grid place-items-center bg-gradient-to-b from-background to-muted/30 p-4">
      <Card className="w-full max-w-md">
        <CardContent className="p-8 text-center space-y-4">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-destructive/10 text-destructive">
            <ShieldAlert className="h-6 w-6" />
          </div>
          <h1 className="text-2xl font-semibold">Access restricted</h1>
          <p className="text-sm text-muted-foreground">
            {reason === "domain"
              ? `This workspace is limited to @${ALLOWED_DOMAIN} accounts. Please sign in with your work email.`
              : "Your account does not have access to this workspace."}
          </p>
          <div className="pt-2">
            <Button asChild>
              <Link href="/login">Back to sign in</Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
