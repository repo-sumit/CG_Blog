import Link from "next/link";
import { LogIn, LayoutDashboard } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { BrandLockup } from "@/components/portal/BrandLockup";
import { getSessionContext } from "@/lib/auth/guards";

/**
 * Public-facing top nav for the landing + /posts/[slug] routes. No auth gate,
 * but if the visitor happens to already have a session we show a "Dashboard"
 * shortcut so the 5 editors don't have to sign in again.
 */
export async function PublicNav() {
  const ctx = await getSessionContext();
  return (
    <header className="sticky top-0 z-40 border-b border-portal-border-soft bg-portal-main/90 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center gap-4 px-4">
        <BrandLockup size="sm" href="/" withSubtitle={false} />

        <nav className="ml-2 hidden items-center gap-1 md:flex" aria-label="Primary">
          <Link
            href="/"
            className="rounded-md px-3 py-1.5 font-ui text-xs uppercase tracking-wider text-portal-text-muted hover:bg-portal-panel-soft hover:text-portal-text"
          >
            Signal Feed
          </Link>
        </nav>

        <div className="ml-auto flex items-center gap-2">
          {ctx ? (
            <Button asChild variant="outline" size="sm">
              <Link href="/dashboard">
                <LayoutDashboard className="h-3.5 w-3.5" />
                Dashboard
              </Link>
            </Button>
          ) : (
            <Button asChild size="sm">
              <Link href="/login">
                <LogIn className="h-3.5 w-3.5" />
                Sign in
              </Link>
            </Button>
          )}
        </div>
      </div>
    </header>
  );
}
