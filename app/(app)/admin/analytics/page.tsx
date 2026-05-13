import type { Metadata } from "next";
import Link from "next/link";
import { requireManager } from "@/lib/auth/guards";
import { createSupabaseServerClient, createSupabaseServiceClient } from "@/lib/supabase/server";
import { listTeam } from "@/lib/db/profiles";
import { weekStartISO, weekdayLabel, formatWeekRange } from "@/lib/utils/dates";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";

export const metadata: Metadata = { title: "Analytics" };
export const dynamic = "force-dynamic";

const DAY_MS = 24 * 60 * 60 * 1000;

export default async function AnalyticsPage() {
  await requireManager();
  const supabase = createSupabaseServerClient();
  // Service client for cross-cutting aggregates (post_views, subscribers) so
  // RLS doesn't have to be widened to all managers individually.
  const service = createSupabaseServiceClient();
  const wk = weekStartISO();
  const sinceTodayIso = new Date(Date.now() - DAY_MS).toISOString();
  const sinceWeekIso = new Date(Date.now() - 7 * DAY_MS).toISOString();

  const [
    team,
    publishedThisWeek,
    allPublished,
    mediaPosts,
    viewsAll,
    viewsToday,
    viewsWeek,
    commentRows,
    reactionRows,
    subscriberCount,
  ] = await Promise.all([
    listTeam(),
    supabase
      .from("posts")
      .select("id, author_id, assigned_weekday")
      .eq("status", "published")
      .eq("week_start_date", wk),
    supabase
      .from("posts")
      .select("id, title, slug, author_id, content_html")
      .eq("status", "published"),
    supabase.from("media_assets").select("id, post_id"),
    service.from("post_views").select("post_id, viewer_id"),
    service.from("post_views").select("post_id").gte("created_at", sinceTodayIso),
    service.from("post_views").select("post_id").gte("created_at", sinceWeekIso),
    service.from("comments").select("post_id").is("deleted_at", null),
    service.from("reactions").select("post_id"),
    service.from("subscribers").select("id", { count: "exact", head: true }).is("unsubscribed_at", null),
  ]);

  const postsByAuthor: Record<string, number> = {};
  const postedThisWeek: Set<string> = new Set();
  for (const p of (publishedThisWeek.data ?? []) as { author_id: string; assigned_weekday: number | null }[]) {
    postedThisWeek.add(p.author_id);
  }
  type PublishedPost = { id: string; title: string; slug: string; author_id: string };
  const allPublishedRows = (allPublished.data ?? []) as PublishedPost[];
  for (const p of allPublishedRows) {
    postsByAuthor[p.author_id] = (postsByAuthor[p.author_id] ?? 0) + 1;
  }

  const totalPublished = allPublishedRows.length;
  const mediaCount = (mediaPosts.data ?? []).length;
  const completion = team.length > 0 ? Math.round((postedThisWeek.size / team.length) * 100) : 0;

  // ── View aggregates ─────────────────────────────────────────────
  type ViewRow = { post_id: string; viewer_id: string | null };
  const allViews = (viewsAll.data ?? []) as ViewRow[];
  const todayViews = (viewsToday.data ?? []) as { post_id: string }[];
  const weekViews = (viewsWeek.data ?? []) as { post_id: string }[];

  const viewsByPost = new Map<string, number>();
  let loggedInViews = 0;
  for (const v of allViews) {
    viewsByPost.set(v.post_id, (viewsByPost.get(v.post_id) ?? 0) + 1);
    if (v.viewer_id) loggedInViews += 1;
  }
  const totalViews = allViews.length;
  const anonViews = totalViews - loggedInViews;

  // Top 5 posts by view count.
  const topPosts = allPublishedRows
    .map((p) => ({
      id: p.id,
      title: p.title,
      slug: p.slug,
      views: viewsByPost.get(p.id) ?? 0,
    }))
    .sort((a, b) => b.views - a.views)
    .slice(0, 5);

  // Comment + reaction counts by post.
  const commentsByPost = new Map<string, number>();
  for (const c of (commentRows.data ?? []) as { post_id: string }[]) {
    commentsByPost.set(c.post_id, (commentsByPost.get(c.post_id) ?? 0) + 1);
  }
  const reactionsByPost = new Map<string, number>();
  for (const r of (reactionRows.data ?? []) as { post_id: string }[]) {
    reactionsByPost.set(r.post_id, (reactionsByPost.get(r.post_id) ?? 0) + 1);
  }

  const subCount = (subscriberCount.count ?? 0) as number;

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

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Total post views</div>
          <div className="mt-1 text-3xl font-semibold">{totalViews}</div>
          <p className="mt-2 text-[10px] uppercase tracking-wider text-muted-foreground">
            Tracked in Supabase · 30-min dedupe
          </p>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Views (last 24h)</div>
          <div className="mt-1 text-3xl font-semibold">{todayViews.length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Views (last 7d)</div>
          <div className="mt-1 text-3xl font-semibold">{weekViews.length}</div>
        </CardContent></Card>
        <Card><CardContent className="p-4">
          <div className="text-xs uppercase text-muted-foreground">Active subscribers</div>
          <div className="mt-1 text-3xl font-semibold">{subCount}</div>
        </CardContent></Card>
      </div>

      <div className="grid gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Top 5 posts (all-time views)</CardTitle>
          </CardHeader>
          <CardContent>
            {topPosts.length === 0 ? (
              <p className="text-sm text-muted-foreground">No view data yet.</p>
            ) : (
              <ol className="space-y-2">
                {topPosts.map((p, i) => (
                  <li key={p.id} className="flex items-center gap-3 text-sm">
                    <span className="w-6 font-mono text-xs text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                    <Link
                      href={`/posts/${p.slug}`}
                      className="flex-1 truncate font-medium hover:text-portal-orange"
                    >
                      {p.title}
                    </Link>
                    <Badge variant="muted">{p.views} views</Badge>
                  </li>
                ))}
              </ol>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>Audience mix</CardTitle>
          </CardHeader>
          <CardContent>
            <dl className="grid grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Logged-in views</dt>
                <dd className="mt-1 text-2xl font-semibold">{loggedInViews}</dd>
              </div>
              <div>
                <dt className="text-xs uppercase text-muted-foreground">Anonymous views</dt>
                <dd className="mt-1 text-2xl font-semibold">{anonViews}</dd>
              </div>
            </dl>
            <p className="mt-3 text-[10px] uppercase tracking-wider text-muted-foreground">
              Vercel Analytics has separate session-level traffic data in the Vercel dashboard.
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Engagement by post</CardTitle>
        </CardHeader>
        <CardContent>
          {allPublishedRows.length === 0 ? (
            <p className="text-sm text-muted-foreground">No published posts yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full min-w-[520px] text-sm">
                <thead>
                  <tr className="border-b text-left text-[10px] uppercase tracking-wider text-muted-foreground">
                    <th className="px-2 py-2 font-medium">Post</th>
                    <th className="px-2 py-2 text-right font-medium">Views</th>
                    <th className="px-2 py-2 text-right font-medium">Comments</th>
                    <th className="px-2 py-2 text-right font-medium">Reactions</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {allPublishedRows.map((p) => (
                    <tr key={p.id}>
                      <td className="px-2 py-2">
                        <Link
                          href={`/posts/${p.slug}`}
                          className="truncate font-medium hover:text-portal-orange"
                        >
                          {p.title}
                        </Link>
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {viewsByPost.get(p.id) ?? 0}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {commentsByPost.get(p.id) ?? 0}
                      </td>
                      <td className="px-2 py-2 text-right tabular-nums">
                        {reactionsByPost.get(p.id) ?? 0}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

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
