import type { Metadata } from "next";
import Link from "next/link";
import { Calendar, Users, Tag, BarChart3 } from "lucide-react";
import { requireManager } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { weekStartISO } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "Admin" };
export const dynamic = "force-dynamic";

export default async function AdminHomePage() {
  await requireManager();
  const supabase = createSupabaseServerClient();
  const wk = weekStartISO();

  const [{ count: teamCount }, { count: publishedCount }, { count: draftsCount }, { count: submittedCount }] = await Promise.all([
    supabase.from("profiles").select("id", { count: "exact", head: true }).in("role", ["author", "manager"]),
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("status", "published").eq("week_start_date", wk),
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("status", "draft"),
    supabase.from("posts").select("id", { count: "exact", head: true }).eq("status", "submitted"),
  ]);

  const sections = [
    { href: "/admin/schedule",  icon: Calendar,  title: "Schedule",  desc: "Assign weekdays to each team member." },
    { href: "/admin/users",     icon: Users,     title: "Users",     desc: "Manage the role allowlist." },
    { href: "/admin/tags",      icon: Tag,       title: "Tags",      desc: "Curate tags used across posts." },
    { href: "/admin/analytics", icon: BarChart3, title: "Analytics", desc: "Completion and content metrics." },
  ];

  return (
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-2xl font-semibold tracking-tight">Admin</h1>
        <p className="text-sm text-muted-foreground">Manage the team blog.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Team size</div>
          <div className="mt-1 text-3xl font-semibold">{teamCount ?? 0}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Published this week</div>
          <div className="mt-1 text-3xl font-semibold">{publishedCount ?? 0}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Awaiting review</div>
          <div className="mt-1 text-3xl font-semibold">{submittedCount ?? 0}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">All drafts</div>
          <div className="mt-1 text-3xl font-semibold">{draftsCount ?? 0}</div>
        </CardContent></Card>
      </div>

      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.href}
              href={s.href}
              className="group rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md"
            >
              <Icon className="h-5 w-5 text-primary" />
              <h2 className="mt-2 text-lg font-semibold group-hover:text-primary">{s.title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{s.desc}</p>
            </Link>
          );
        })}
      </div>
    </main>
  );
}
