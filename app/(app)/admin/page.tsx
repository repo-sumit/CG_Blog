import type { Metadata } from "next";
import Link from "next/link";
import { Calendar, Users, Tag, BarChart3 } from "lucide-react";
import { requireManager } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { Panel, PanelBody } from "@/components/portal/Panel";
import { SystemLabel } from "@/components/portal/SystemLabel";
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
    { href: "/admin/schedule",  code: "010", icon: Calendar,  title: "Schedule",  desc: "Assign weekdays to each team member." },
    { href: "/admin/users",     code: "011", icon: Users,     title: "Users",     desc: "Manage the role allowlist." },
    { href: "/admin/tags",      code: "012", icon: Tag,       title: "Tags",      desc: "Curate tags used across posts." },
    { href: "/admin/analytics", code: "013", icon: BarChart3, title: "Analytics", desc: "Completion and content metrics." },
  ];

  return (
    <div className="container mx-auto space-y-8 px-4 py-10">
      <div className="space-y-2">
        <SystemLabel tone="orange">{"005 // Admin Console"}</SystemLabel>
        <h1 className="font-hero text-5xl font-bold uppercase tracking-tighter text-portal-text">Command Center</h1>
        <p className="text-sm text-portal-text-muted">Manage the team blog portal.</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile label="Team Size" value={teamCount ?? 0} />
        <StatTile label="Published This Week" value={publishedCount ?? 0} tone="green" />
        <StatTile label="Awaiting Review" value={submittedCount ?? 0} tone="orange" />
        <StatTile label="All Drafts" value={draftsCount ?? 0} />
      </div>

      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((s) => {
          const Icon = s.icon;
          return (
            <Link
              key={s.href}
              href={s.href}
              className="group rounded-panel border-2 border-portal-border-soft bg-portal-panel-raised p-6 shadow-portal transition-all hover:-translate-y-0.5 hover:border-portal-border-main hover:shadow-glow"
            >
              <div className="mb-3 flex items-center justify-between">
                <SystemLabel tone="orange">{`${s.code} // ${s.title}`}</SystemLabel>
                <Icon className="h-4 w-4 text-portal-text-muted group-hover:text-portal-orange" />
              </div>
              <h2 className="font-hero text-xl font-bold uppercase tracking-tighter text-portal-text group-hover:text-portal-orange">
                {s.title}
              </h2>
              <p className="mt-2 text-sm text-portal-text-muted">{s.desc}</p>
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function StatTile({ label, value, tone = "default" }: { label: string; value: number; tone?: "default" | "orange" | "green" }) {
  const color = tone === "orange" ? "text-portal-orange" : tone === "green" ? "text-portal-green" : "text-portal-text";
  return (
    <Panel>
      <PanelBody className="p-5">
        <SystemLabel>{label}</SystemLabel>
        <div className={`mt-2 font-hero text-4xl font-bold tracking-tighter ${color}`}>{value}</div>
      </PanelBody>
    </Panel>
  );
}
