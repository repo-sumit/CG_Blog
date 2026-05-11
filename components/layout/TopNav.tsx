"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { LayoutDashboard, BookOpen, PenSquare, FileText, ShieldCheck, LogOut } from "lucide-react";
import type { ProfileRow } from "@/lib/db/types";
import { canAuthor, isManager } from "@/lib/auth/roles";
import { cn } from "@/lib/utils/cn";
import { Avatar } from "@/components/ui/Avatar";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  show: (role: ProfileRow["role"]) => boolean;
}

const NAV: NavItem[] = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard, show: () => true },
  { href: "/blog", label: "Blog", icon: BookOpen, show: () => true },
  { href: "/me/posts", label: "My posts", icon: FileText, show: (r) => canAuthor(r) },
  { href: "/editor/new", label: "New post", icon: PenSquare, show: (r) => canAuthor(r) },
  { href: "/admin", label: "Admin", icon: ShieldCheck, show: (r) => isManager(r) },
];

export function TopNav({ profile }: { profile: ProfileRow }) {
  const pathname = usePathname();
  return (
    <header className="sticky top-0 z-40 border-b bg-background/85 backdrop-blur">
      <div className="container mx-auto flex h-14 items-center gap-2 px-4">
        <Link href="/dashboard" className="flex items-center gap-2 font-semibold tracking-tight">
          <span className="grid h-7 w-7 place-items-center rounded-md bg-primary text-primary-foreground text-xs font-bold">
            CG
          </span>
          <span className="hidden sm:inline">Team Blog</span>
        </Link>

        <nav className="ml-4 flex items-center gap-1 text-sm" aria-label="Primary">
          {NAV.filter((i) => i.show(profile.role)).map((item) => {
            const active = pathname === item.href || pathname.startsWith(item.href + "/");
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 transition-colors",
                  active ? "bg-secondary text-foreground" : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icon className="h-4 w-4" />
                <span className="hidden sm:inline">{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="ml-auto flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-end leading-tight">
            <span className="text-xs font-medium">{profile.full_name || profile.email}</span>
            <span className="text-[11px] text-muted-foreground capitalize">{profile.role}</span>
          </div>
          <Avatar src={profile.avatar_url} name={profile.full_name} email={profile.email} size="sm" />
          <form action="/api/auth/signout" method="post">
            <button
              type="submit"
              className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-secondary hover:text-foreground"
              title="Sign out"
              aria-label="Sign out"
            >
              <LogOut className="h-4 w-4" />
            </button>
          </form>
        </div>
      </div>
    </header>
  );
}
