import type { Metadata } from "next";
import Link from "next/link";
import { PenSquare, ListTodo, CheckCircle2, AlertCircle } from "lucide-react";
import { requireSession } from "@/lib/auth/guards";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { listTeam } from "@/lib/db/profiles";
import { listPostsThisWeek, listOwnPosts } from "@/lib/db/posts";
import { weekStartISO, todayWeekday, weekdayLabel } from "@/lib/utils/dates";
import { canAuthor, isManager } from "@/lib/auth/roles";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, PanelBody, PanelHeader } from "@/components/portal/Panel";
import { SystemLabel, JapaneseLabel } from "@/components/portal/SystemLabel";
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
  const firstName = profile.full_name?.split(" ")[0] || profile.email.split("@")[0];

  return (
    <div className="container mx-auto space-y-10 px-4 py-10">
      {/* Hero block */}
      <Panel variant="bright" pattern="grid" className="relative">
        <div className="p-8 sm:p-12 space-y-6">
          <div className="flex items-center justify-between">
            <SystemLabel tone="orange">{"001 // Welcome Back"}</SystemLabel>
            <JapaneseLabel className="hidden sm:inline">ポータル · 通信</JapaneseLabel>
          </div>
          <h1 className="font-hero text-4xl font-bold uppercase tracking-tighter text-portal-text sm:text-6xl">
            {firstName}.
            <br />
            <span className="text-portal-text-muted">Signal received.</span>
          </h1>
          <p className="max-w-xl text-sm text-portal-text-muted">
            What the team is broadcasting this week. Pick up your assigned day or
            jump in early — every post becomes part of the archive.
          </p>
          <div className="flex flex-wrap items-center gap-3 pt-2">
            {canAuthor(profile.role) && (
              <Button asChild>
                <Link href="/editor/new">
                  <PenSquare className="h-4 w-4" />
                  New Transmission
                </Link>
              </Button>
            )}
            <Button asChild variant="outline">
              <Link href="/blog">Open Signal Feed</Link>
            </Button>
            <SystemLabel tone="green" dot>Portal Active</SystemLabel>
          </div>
        </div>
      </Panel>

      {/* 3-column body */}
      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          {canAuthor(profile.role) && (
            <Panel>
              <PanelHeader>
                <div>
                  <SystemLabel tone="orange">{"002 // Your Week"}</SystemLabel>
                  <div className="font-hero text-lg font-bold uppercase tracking-tighter text-portal-text mt-1">
                    Author Status
                  </div>
                </div>
                <SystemLabel>{profile.role}</SystemLabel>
              </PanelHeader>
              <PanelBody className="grid gap-3 sm:grid-cols-3">
                <StatBox label="Assigned Day" value={myDay ? weekdayLabel(myDay) : "Unassigned"} />
                <StatBox
                  label="This Week's Post"
                  value={myDraftThisWeek ? "Draft in progress" : "Not started"}
                  href={myDraftThisWeek ? `/editor/${myDraftThisWeek.id}` : "/editor/new"}
                />
                <StatBox
                  label="Status"
                  badge={
                    myDay === null ? <Badge variant="muted">No day</Badge> :
                    (postsByAuthor[userId] ?? 0) > 0 ? <Badge variant="success"><CheckCircle2 className="h-3 w-3" /> Posted</Badge> :
                    today && myDay < today ? <Badge variant="destructive">Missed</Badge> :
                    today === myDay ? <Badge variant="warning">Due today</Badge> :
                    <Badge variant="muted">Upcoming</Badge>
                  }
                />
              </PanelBody>
            </Panel>
          )}

          {isManager(profile.role) && (
            <Panel>
              <PanelHeader>
                <div>
                  <SystemLabel tone="orange">{"004 // Review Queue"}</SystemLabel>
                  <div className="font-hero text-lg font-bold uppercase tracking-tighter text-portal-text mt-1">
                    Awaiting Approval
                  </div>
                </div>
                <Badge variant="muted"><ListTodo className="h-3 w-3" /> {submittedRows.length}</Badge>
              </PanelHeader>
              <PanelBody>
                {submittedRows.length === 0 ? (
                  <div className="rounded-md border border-portal-border-soft p-4 text-center">
                    <SystemLabel>Queue Clear · No submissions</SystemLabel>
                  </div>
                ) : (
                  <ul className="space-y-2">
                    {submittedRows.map((p) => (
                      <li key={p.id} className="flex items-center justify-between rounded-md border-2 border-portal-border-soft bg-portal-panel-soft p-3">
                        <div>
                          <Link href={`/editor/${p.id}`} className="font-ui font-bold text-portal-text hover:text-portal-orange">
                            {p.title || "Untitled"}
                          </Link>
                          <div className="mt-0.5">
                            <SystemLabel>{p.author?.full_name || p.author?.email}</SystemLabel>
                          </div>
                        </div>
                        <Button asChild size="sm" variant="outline">
                          <Link href={`/editor/${p.id}`}>Review</Link>
                        </Button>
                      </li>
                    ))}
                  </ul>
                )}
              </PanelBody>
            </Panel>
          )}

          <Panel>
            <PanelHeader>
              <div>
                <SystemLabel tone="orange">{"005 // This Week"}</SystemLabel>
                <div className="font-hero text-lg font-bold uppercase tracking-tighter text-portal-text mt-1">
                  Active Transmissions
                </div>
              </div>
              <SystemLabel dot tone="green">Live Feed</SystemLabel>
            </PanelHeader>
            <PanelBody>
              {postsThisWeek.length === 0 ? (
                <div className="rounded-md border-2 border-dashed border-portal-border-soft p-10 text-center">
                  <SystemLabel className="mb-3 block">Signal Feed Empty</SystemLabel>
                  <p className="text-sm text-portal-text-muted">No posts have been transmitted this week yet.</p>
                  {canAuthor(profile.role) && (
                    <Button asChild className="mt-4">
                      <Link href="/editor/new">Be the first signal</Link>
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
            </PanelBody>
          </Panel>
        </div>

        <aside className="space-y-6">
          <WeeklyScheduleCard team={team} postsByAuthorThisWeek={postsByAuthor} />

          {isManager(profile.role) && (
            <Panel>
              <PanelHeader>
                <div>
                  <SystemLabel tone="orange">{"006 // Completion"}</SystemLabel>
                  <div className="font-hero text-lg font-bold uppercase tracking-tighter text-portal-text mt-1">
                    <AlertCircle className="inline h-4 w-4 mr-2 text-portal-yellow" />
                    Weekly Score
                  </div>
                </div>
              </PanelHeader>
              <PanelBody className="space-y-3">
                <div className="font-hero text-5xl font-bold tracking-tighter text-portal-text">{completion}%</div>
                <SystemLabel>
                  {Object.keys(postsByAuthor).length} of {team.length} posted
                </SystemLabel>
                <div className="h-2 w-full overflow-hidden rounded-pill border border-portal-border-soft bg-portal-panel-soft">
                  <div
                    className="h-full bg-portal-orange transition-[width] duration-700"
                    style={{ width: `${completion}%` }}
                  />
                </div>
                <Link href="/admin/analytics" className="font-ui text-[10px] uppercase tracking-label text-portal-blue hover:underline">
                  View analytics →
                </Link>
              </PanelBody>
            </Panel>
          )}
        </aside>
      </div>
    </div>
  );
}

function StatBox({
  label,
  value,
  badge,
  href,
}: {
  label: string;
  value?: React.ReactNode;
  badge?: React.ReactNode;
  href?: string;
}) {
  const inner = (
    <>
      <SystemLabel>{label}</SystemLabel>
      <div className="mt-2">
        {badge ? badge : <div className="font-hero text-base font-bold uppercase text-portal-text">{value}</div>}
      </div>
    </>
  );
  if (href) {
    return (
      <Link
        href={href}
        className="block rounded-md border-2 border-portal-border-soft bg-portal-panel-soft p-4 hover:border-portal-border-muted hover:bg-portal-panel-raised"
      >
        {inner}
      </Link>
    );
  }
  return <div className="rounded-md border-2 border-portal-border-soft bg-portal-panel-soft p-4">{inner}</div>;
}
