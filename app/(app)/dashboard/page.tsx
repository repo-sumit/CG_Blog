import type { Metadata } from "next";
import Link from "next/link";
import { PenSquare, ListTodo, CheckCircle2, AlertCircle } from "lucide-react";
import { requireSession } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listTeam } from "@/lib/db/profiles";
import { listPostsThisWeek, listOwnPosts } from "@/lib/db/posts";
import { weekStartISO, todayWeekday, weekdayLabel } from "@/lib/utils/dates";
import { canAuthor, isManager } from "@/lib/auth/roles";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { WeeklyScheduleCard } from "@/components/dashboard/WeeklyScheduleCard";
import { PostCard } from "@/components/blog/PostCard";

export const metadata: Metadata = { title: "Dashboard" };
export const dynamic = "force-dynamic";

export default async function DashboardPage() {
  const { profile, userId } = await requireSession();
  const supabase = createSupabaseServerClient();
  const wk = weekStartISO();

  type SubmittedRow = {
    id: string;
    title: string;
    slug: string;
    updated_at: string;
    author: { full_name: string | null; email: string } | null;
  };

  const [team, postsThisWeek, ownPosts] = await Promise.all([
    listTeam(),
    listPostsThisWeek(wk),
    canAuthor(profile.role) ? listOwnPosts(userId) : Promise.resolve([]),
  ]);

  let submittedRows: SubmittedRow[] = [];
  if (isManager(profile.role)) {
    const { data } = await supabase
      .from("posts")
      .select("id,title,slug,updated_at,author:profiles!posts_author_id_fkey(full_name,email)")
      .eq("status", "submitted")
      .order("updated_at", { ascending: false })
      .limit(10);
    submittedRows = (data ?? []) as unknown as SubmittedRow[];
  }

  const postsByAuthor: Record<string, number> = {};
  for (const p of postsThisWeek) {
    postsByAuthor[p.author_id] = (postsByAuthor[p.author_id] ?? 0) + 1;
  }
  const completion = team.length > 0
    ? Math.round((Object.keys(postsByAuthor).length / team.length) * 100)
    : 0;

  const myDay = profile.weekly_post_day ?? null;
  const myDraftThisWeek = ownPosts.find(
    (p) => p.week_start_date === wk && (p.status === "draft" || p.status === "submitted"),
  );
  const today = todayWeekday();

  return (
    <main className="container mx-auto px-4 py-8 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back, {profile.full_name?.split(" ")[0] || profile.email.split("@")[0]}.
          </h1>
          <p className="text-sm text-muted-foreground mt-1">
            Here’s what your team is working on this week.
          </p>
        </div>
        {canAuthor(profile.role) && (
          <Button asChild>
            <Link href="/editor/new">
              <PenSquare className="mr-2 h-4 w-4" />
              New post
            </Link>
          </Button>
        )}
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="lg:col-span-2 space-y-6">
          {canAuthor(profile.role) && (
            <Card>
              <CardHeader>
                <CardTitle>Your week</CardTitle>
              </CardHeader>
              <CardContent className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Assigned day</div>
                  <div className="mt-1 font-medium">
                    {myDay ? weekdayLabel(myDay) : <span className="text-muted-foreground">Unassigned</span>}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">This week’s post</div>
                  <div className="mt-1 font-medium">
                    {myDraftThisWeek ? (
                      <Link className="hover:underline" href={`/editor/${myDraftThisWeek.id}`}>
                        Continue draft →
                      </Link>
                    ) : (
                      <Link className="hover:underline" href="/editor/new">
                        Start writing →
                      </Link>
                    )}
                  </div>
                </div>
                <div className="rounded-lg border p-3">
                  <div className="text-xs text-muted-foreground">Status</div>
                  <div className="mt-1">
                    {myDay === null ? (
                      <Badge variant="muted">No day assigned</Badge>
                    ) : (postsByAuthor[userId] ?? 0) > 0 ? (
                      <Badge variant="success">
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Posted this week
                      </Badge>
                    ) : today && myDay < today ? (
                      <Badge variant="destructive">Missed your day</Badge>
                    ) : today === myDay ? (
                      <Badge variant="warning">Due today</Badge>
                    ) : (
                      <Badge variant="muted">Upcoming</Badge>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          )}

          {isManager(profile.role) && (
            <Card>
              <CardHeader className="flex flex-row items-center justify-between">
                <CardTitle>Awaiting your review</CardTitle>
                <Badge variant="muted">
                  <ListTodo className="mr-1 h-3 w-3" /> {submittedRows.length}
                </Badge>
              </CardHeader>
              <CardContent>
                {submittedRows.length === 0 ? (
                  <p className="text-sm text-muted-foreground">No submissions waiting.</p>
                ) : (
                  <ul className="space-y-2">
                    {submittedRows.map((p) => (
                      <li key={p.id} className="flex items-center justify-between rounded-md border p-2">
                        <div>
                          <Link href={`/editor/${p.id}`} className="font-medium hover:underline">
                            {p.title || "Untitled"}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            {p.author?.full_name || p.author?.email}
                          </div>
                        </div>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/editor/${p.id}`}>Review</Link>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle>This week’s posts</CardTitle>
            </CardHeader>
            <CardContent>
              {postsThisWeek.length === 0 ? (
                <div className="rounded-lg border border-dashed p-8 text-center">
                  <p className="text-sm text-muted-foreground">No posts published this week yet.</p>
                  {canAuthor(profile.role) && (
                    <Button asChild className="mt-3">
                      <Link href="/editor/new">Be the first to post</Link>
                    </Button>
                  )}
                </div>
              ) : (
                <div className="grid gap-4 sm:grid-cols-2">
                  {postsThisWeek.map((p) => (
                    <PostCard key={p.id} post={p} />
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-6">
          <WeeklyScheduleCard team={team} postsByAuthorThisWeek={postsByAuthor} />
          {isManager(profile.role) && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <AlertCircle className="h-4 w-4 text-warning" />
                  Completion this week
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-3xl font-semibold tracking-tight">{completion}%</div>
                <div className="mt-1 text-xs text-muted-foreground">
                  {Object.keys(postsByAuthor).length} of {team.length} team members posted
                </div>
                <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-secondary">
                  <div className="h-full bg-primary" style={{ width: `${completion}%` }} />
                </div>
                <div className="mt-4 text-xs">
                  <Link href="/admin/analytics" className="underline-offset-2 hover:underline">
                    View analytics →
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}
        </aside>
      </div>
    </main>
  );
}
