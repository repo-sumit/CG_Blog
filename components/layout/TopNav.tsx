"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BookOpen, PenSquare, FileText, ShieldCheck, LogOut } from "lucide-react";
import type { ProfileRow } from "@/lib/db/types";
import { canAuthor, isManager } from "@/lib/auth/roles";
import { cn } from "@/lib/utils/cn";
import { Avatar } from "@/components/ui/Avatar";
import { BrandLockup } from "@/components/portal/BrandLockup";
import { SystemLabel } from "@/components/portal/SystemLabel";

interface NavItem {
  href: string;
  label: string;
  code: string; // little numbered prefix in the design language
  icon: React.ComponentType<{ className?: string }>;
  show: (role: ProfileRow["role"]) => boolean;
}

const NAV: NavItem[] = [
  { href: "/dashboard", code: "001", label: "Dashboard", icon: LayoutDashboard, show: () => true },
  { href: "/blog",      code: "002", label: "Signal Feed", icon: BookOpen,      show: () => true },
  { href: "/me/posts",  code: "003", label: "My Posts",    icon: FileText,      show: (r) => canAuthor(r) },
  { href: "/editor/new",code: "004", label: "Transmit",    icon: PenSquare,     show: (r) => canAuthor(r) },
  { href: "/admin",     code: "005", label: "Admin",       icon: ShieldCheck,   show: (r) => isManager(r) },
];

export function TopNav({ profile }: { profile: ProfileRow }) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b-2 border-portal-border-soft bg-portal-main/85 backdrop-blur-md">
      <div className="container mx-auto flex h-16 items-center gap-4 px-4">
        <BrandLockup size="sm" href="/dashboard" withSubtitle={false} />

        <nav className="ml-2 hidden items-center gap-1 md:flex" aria-label="Primary">
          {NAV.filter((i) => i.show(profile.role)).map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "group inline-flex items-center gap-2 rounded-pill border-2 px-3 py-1.5 font-ui text-[11px] uppercase tracking-label transition-colors",
                  active
                    ? "border-portal-border-main bg-portal-panel-raised text-portal-text"
                    : "border-transparent text-portal-text-muted hover:border-portal-border-soft hover:text-portal-text",
                )}
              >
                <span className="text-portal-text-soft group-hover:text-portal-orange">{item.code}</span>
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <SystemLabel tone="green" dot className="hidden lg:inline-flex">
            Portal Active
          </SystemLabel>

          <div className="hidden flex-col items-end leading-tight sm:flex">
            <span className="font-ui text-xs text-portal-text">{profile.full_name || profile.email}</span>
            <span className="font-ui text-[10px] uppercase tracking-label text-portal-text-soft">
              {profile.role}
            </span>
          </div>
          <Avatar src={profile.avatar_url} name={profile.full_name} email={profile.email} size="sm" />
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="inline-flex h-9 w-9 items-center justify-center rounded-pill border-2 border-portal-border-soft text-portal-text-muted hover:border-portal-border-muted hover:text-portal-text"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>

      {/* Mobile nav — appears under the brand */}
      <nav
        className="container mx-auto flex items-center gap-1 overflow-x-auto px-4 pb-3 md:hidden"
        aria-label="Primary mobile"
      >
        {NAV.filter((i) => i.show(profile.role)).map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + "/");
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "shrink-0 rounded-pill border-2 px-3 py-1 font-ui text-[10px] uppercase tracking-label",
                active
                  ? "border-portal-border-main bg-portal-panel-raised text-portal-text"
                  : "border-portal-border-soft text-portal-text-muted",
              )}
            >
              {item.code} {item.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
