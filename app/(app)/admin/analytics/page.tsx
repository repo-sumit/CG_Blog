import type { Metadata } from "next";
import { requireManager } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listTeam } from "@/lib/db/profiles";
import { weekStartISO, weekdayLabel, formatWeekRange } from "@/lib/utils/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";

export const metadata: Metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

export default async function AnalyticsPage() {
  await requireManager();
  const supabase = createSupabaseServerClient();
  const wk = weekStartISO();

  const [team, publishedThisWeek, allPublished, mediaPosts] = await Promise.all([
    listTeam(),
    supabase.from("posts").select("id, author_id, assigned_weekday").eq("status", "published").eq("week_start_date", wk),
    supabase
      .from("posts")
      .select("id, author_id, content_html")
      .eq("status", "published"),
    supabase.from("media_assets").select("id, post_id"),
  ]);

  const postsByAuthor: Record<string, number> = {};
  const postedThisWeek: Set<string> = new Set();
  for (const p of (publishedThisWeek.data ?? []) as { author_id: string; assigned_weekday: number | null }[]) {
    postedThisWeek.add(p.author_id);
  }
  for (const p of (allPublished.data ?? []) as { author_id: string }[]) {
    postsByAuthor[p.author_id] = (postsByAuthor[p.author_id] ?? 0) + 1;
  }

  const totalPublished = (allPublished.data ?? []).length;
  const mediaCount = (mediaPosts.data ?? []).length;
  const completion = team.length > 0 ? Math.round((postedThisWeek.size / team.length) * 100) : 0;

  return (
    <main className="container mx-auto px-4 py-8 space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Analytics</h1>
        <p className="text-sm text-muted-foreground">{formatWeekRange()}</p>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Completion this week</div>
          <div className="mt-1 text-3xl font-semibold">{completion}%</div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-secondary">
            <div className="h-full bg-primary" style={{ width: `${completion}%` }} />
          </div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Published this week</div>
          <div className="mt-1 text-3xl font-semibold">{postedThisWeek.size}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Total published</div>
          <div className="mt-1 text-3xl font-semibold">{totalPublished}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Media assets</div>
          <div className="mt-1 text-3xl font-semibold">{mediaCount}</div>
        </CardContent></Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>By author</CardTitle>
        </CardHeader>
        <CardContent>
          <ul className="divide-y">
            {team.map((m) => {
              const posted = postedThisWeek.has(m.id);
              return (
                <li key={m.id} className="flex items-center gap-3 py-3">
                  <Avatar src={m.avatar_url} name={m.full_name} email={m.email} />
                  <div className="flex-1">
                    <div className="font-medium">{m.full_name || m.email}</div>
                    <div className="text-xs text-muted-foreground capitalize">
                      {m.role} · {m.weekly_post_day ? weekdayLabel(m.weekly_post_day) : "no day"}
                    </div>
                  </div>
                  <Badge variant="muted">{postsByAuthor[m.id] ?? 0} all-time</Badge>
                  {posted ? (
                    <Badge variant="success">Posted</Badge>
                  ) : (
                    <Badge variant="destructive">Missed</Badge>
                  )}
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </main>
  );
}
