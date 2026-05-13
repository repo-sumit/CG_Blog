import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, Clock, Eye, Search } from "lucide-react";
import {
  listPublicPosts,
  listPublicTags,
  listContributorStats,
} from "@/lib/db/public";
import { PublicNav } from "@/components/layout/PublicNav";
import { PortalFooter } from "@/components/layout/PortalFooter";
import { ContributorsSection } from "@/components/landing/ContributorsSection";
import { SubscribeSection } from "@/components/landing/SubscribeSection";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Panel, PanelBody } from "@/components/portal/Panel";
import { Input } from "@/components/ui/Input";
import { formatPostDate } from "@/lib/utils/dates";
import { cn } from "@/lib/utils/cn";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CG Signal — Team Blog Portal",
  description: "Weekly transmissions from team Dhurandhar!",
};

interface SearchParams {
  tag?: string;
  q?: string;
}

export default async function PublicLandingPage({ searchParams }: { searchParams: SearchParams }) {
  // OAuth fallthrough — forward stray ?code= to the real callback.
  if ("code" in searchParams) {
    const code = (searchParams as { code?: string }).code;
    if (code) redirect(`/api/auth/callback?code=${encodeURIComponent(code)}`);
  }

  const [allPosts, tags, contributors] = await Promise.all([
    listPublicPosts(60),
    listPublicTags(),
    listContributorStats(),
  ]);

  // Apply filters (tag + free-text). Tag pinned in the dataset; search is a
  // lightweight in-memory match against title/excerpt because the catalog
  // is small.
  let filtered = allPosts;
  if (searchParams.tag) {
    filtered = filtered.filter((p) => p.tags.some((t) => t.slug === searchParams.tag));
  }
  if (searchParams.q) {
    const needle = searchParams.q.toLowerCase();
    filtered = filtered.filter(
      (p) =>
        p.title.toLowerCase().includes(needle) ||
        (p.excerpt ?? "").toLowerCase().includes(needle),
    );
  }

  const [featured, ...rest] = filtered;
  const totalAuthors = contributors.length;
  const totalPosts = allPosts.length;

  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />

      <main className="flex-1">
        {/* ============ Hero ============ */}
        <section className="relative overflow-hidden">
          <div aria-hidden className="absolute inset-0 grid-overlay opacity-40" />
          <div
            aria-hidden
            className="absolute inset-0 opacity-50"
            style={{
              background:
                "radial-gradient(circle at 12% 18%, rgba(255,90,31,0.16), transparent 38%), radial-gradient(circle at 88% 12%, rgba(79,140,255,0.16), transparent 42%)",
            }}
          />
          <div className="container relative mx-auto px-4 py-14 sm:py-20">
            <div className="grid gap-10 lg:grid-cols-[1.3fr_1fr] lg:items-end">
              <div className="max-w-3xl space-y-5">
                <div className="text-[11px] uppercase tracking-wider text-portal-orange">
                  CG Signal · Team Blog Portal
                </div>
                <h1 className="font-hero text-5xl font-bold uppercase leading-[0.95] tracking-tighter text-portal-text sm:text-7xl">
                  The team
                  <br />
                  signal feed.
                </h1>
                <p className="max-w-xl text-base leading-relaxed text-portal-text-muted">
                  Weekly transmissions from team Dhurandhar! — notes, retros,
                  launches, and experiments, written by the people doing the work.
                </p>
                <div className="flex flex-wrap items-center gap-3 pt-2">
                  <Button asChild>
                    <Link href="#feed">
                      Read latest <ArrowRight className="h-4 w-4" />
                    </Link>
                  </Button>
                  <Button asChild variant="outline">
                    <Link href="#contributors">Meet the team</Link>
                  </Button>
                </div>
              </div>

              {/* Stats readout — retro panel */}
              <Panel variant="raised" className="hidden lg:block">
                <PanelBody className="grid grid-cols-2 gap-4 p-6">
                  <StatReadout label="Total transmissions" value={totalPosts} />
                  <StatReadout label="Contributors" value={totalAuthors} />
                  <StatReadout label="Categories" value={tags.length} />
                  <StatReadout label="Cadence" valueText="Weekly" sub="Mon–Fri rotation" />
                </PanelBody>
              </Panel>
            </div>
          </div>
        </section>

        {/* ============ Filter strip ============ */}
        <section className="container mx-auto px-4" id="feed">
          <div className="rounded-md border border-portal-border-soft bg-portal-panel-soft p-4">
            <form className="flex flex-wrap items-center gap-3" action="/" method="get">
              <div className="relative min-w-[240px] flex-1">
                <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-portal-text-muted" />
                <Input
                  name="q"
                  defaultValue={searchParams.q ?? ""}
                  placeholder="Search transmissions…"
                  className="pl-10"
                />
              </div>
              {searchParams.tag && <input type="hidden" name="tag" value={searchParams.tag} />}
              <Button type="submit" variant="outline">Search</Button>
              {(searchParams.q || searchParams.tag) && (
                <Button asChild variant="ghost" size="sm">
                  <Link href="/">Clear</Link>
                </Button>
              )}
            </form>

            {tags.length > 0 && (
              <div className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-portal-border-soft pt-3">
                <span className="mr-2 text-[10px] uppercase tracking-wider text-portal-text-muted">
                  Channel:
                </span>
                <Link
                  href={{ pathname: "/", query: { ...searchParams, tag: undefined } }}
                  className={cn(
                    "rounded-pill border px-3 py-0.5 font-ui text-[10px] uppercase tracking-wider transition-colors",
                    !searchParams.tag
                      ? "border-portal-orange/40 bg-portal-orange/10 text-portal-orange"
                      : "border-portal-border-soft text-portal-text-muted hover:border-portal-border-muted",
                  )}
                >
                  All
                </Link>
                {tags.map((t) => (
                  <Link
                    key={t.id}
                    href={{ pathname: "/", query: { ...searchParams, tag: t.slug } }}
                    className={cn(
                      "rounded-pill border px-3 py-0.5 font-ui text-[10px] uppercase tracking-wider transition-colors",
                      searchParams.tag === t.slug
                        ? "border-portal-orange/40 bg-portal-orange/10 text-portal-orange"
                        : "border-portal-border-soft text-portal-text-muted hover:border-portal-border-muted",
                    )}
                  >
                    {t.name}
                  </Link>
                ))}
              </div>
            )}
          </div>
        </section>

        {/* ============ Featured post ============ */}
        {featured && (
          <section className="container mx-auto px-4 py-10">
            <div className="mb-4 text-[11px] uppercase tracking-wider text-portal-text-muted">
              Featured transmission
            </div>
            <Panel variant="bright">
              <Link href={`/posts/${featured.slug}`} className="block">
                <div className="grid gap-0 lg:grid-cols-[1.2fr_1fr]">
                  <div className="relative min-h-[260px] border-b border-portal-border-soft bg-portal-panel-soft lg:border-b-0 lg:border-r">
                    <div
                      aria-hidden
                      className="absolute inset-0"
                      style={{
                        background:
                          "radial-gradient(circle at 20% 30%, rgba(255,90,31,0.22), transparent 45%), radial-gradient(circle at 80% 70%, rgba(79,140,255,0.18), transparent 45%)",
                      }}
                    />
                    <div aria-hidden className="absolute inset-0 grid-overlay-sm opacity-50" />
                    <div className="absolute bottom-4 left-4 right-4 flex flex-wrap gap-1.5">
                      {featured.tags.slice(0, 3).map((t) => (
                        <Badge key={t.id} variant="secondary">{t.name}</Badge>
                      ))}
                    </div>
                  </div>
                  <PanelBody className="flex flex-col justify-center gap-4 p-8 sm:p-10">
                    <h2 className="font-hero text-3xl font-bold uppercase leading-tight tracking-tighter text-portal-text sm:text-4xl">
                      {featured.title}
                    </h2>
                    {featured.excerpt && (
                      <p className="text-sm leading-relaxed text-portal-text-muted">
                        {featured.excerpt}
                      </p>
                    )}
                    <div className="flex items-center gap-3 border-t border-portal-border-soft pt-4">
                      <Avatar
                        src={featured.author?.avatar_url}
                        name={featured.author?.full_name}
                        email={featured.author?.email}
                        size="md"
                      />
                      <div className="min-w-0 flex-1">
                        <div className="truncate font-ui text-xs text-portal-text">
                          {featured.author?.full_name || featured.author?.email}
                        </div>
                        <div className="text-[10px] uppercase tracking-wider text-portal-text-muted">
                          {featured.published_at ? formatPostDate(featured.published_at) : ""} ·{" "}
                          {featured.read_time_minutes} min read
                        </div>
                      </div>
                      <ArrowRight className="h-5 w-5 text-portal-text-muted" />
                    </div>
                  </PanelBody>
                </div>
              </Link>
            </Panel>
          </section>
        )}

        {/* ============ Latest articles grid ============ */}
        <section className="container mx-auto px-4 pb-16">
          {rest.length === 0 && !featured ? (
            <div className="rounded-md border border-dashed border-portal-border-soft p-16 text-center">
              <h2 className="font-hero text-xl font-bold uppercase text-portal-text">
                No transmissions yet
              </h2>
              <p className="mt-2 text-sm text-portal-text-muted">
                Check back next week — the team broadcasts daily.
              </p>
            </div>
          ) : rest.length > 0 ? (
            <>
              <div className="mb-4 flex items-end justify-between">
                <div className="text-[11px] uppercase tracking-wider text-portal-text-muted">
                  Latest transmissions
                </div>
                <div className="text-[10px] uppercase tracking-wider text-portal-text-muted">
                  {rest.length} more
                </div>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {rest.map((p) => <PublicPostCard key={p.id} post={p} />)}
              </div>
            </>
          ) : null}
        </section>

        {/* ============ Contributors ============ */}
        <div id="contributors">
          <ContributorsSection contributors={contributors} />
        </div>

        {/* ============ Subscribe ============ */}
        {/* ConveGenius Weekly Signals — temporarily hidden. Re-enable by uncommenting
            <SubscribeSection /> below. The /api/subscribe endpoint and welcome email
            still work; only the landing-page entry point is suppressed. */}
        {/* <SubscribeSection /> */}
      </main>

      <PortalFooter />
    </div>
  );
}

// ---------- helpers ----------

function StatReadout({
  label,
  value,
  valueText,
  sub,
}: {
  label: string;
  value?: number;
  valueText?: string;
  sub?: string;
}) {
  return (
    <div className="rounded-md border border-portal-border-soft bg-portal-panel-soft p-3">
      <div className="text-[10px] uppercase tracking-wider text-portal-text-muted">{label}</div>
      <div className="mt-1 font-hero text-2xl font-bold tracking-tighter text-portal-text">
        {value !== undefined ? value : valueText}
      </div>
      {sub && (
        <div className="mt-0.5 text-[10px] uppercase tracking-wider text-portal-text-soft">
          {sub}
        </div>
      )}
    </div>
  );
}

function PublicPostCard({
  post,
}: {
  post: Awaited<ReturnType<typeof listPublicPosts>>[number];
}) {
  return (
    <article className="group rounded-md border border-portal-border-soft bg-portal-panel transition-colors hover:border-portal-border-muted">
      <Link href={`/posts/${post.slug}`} className="block p-5">
        <div className="mb-3 flex flex-wrap gap-1.5">
          {post.tags.slice(0, 2).map((t) => (
            <Badge key={t.id} variant="secondary">{t.name}</Badge>
          ))}
        </div>
        <h3 className="font-hero text-lg font-bold uppercase leading-snug tracking-tighter text-portal-text group-hover:text-portal-orange">
          {post.title}
        </h3>
        {post.excerpt && (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-portal-text-muted">
            {post.excerpt}
          </p>
        )}
        <div className="mt-4 flex items-center gap-2 border-t border-portal-border-soft pt-3">
          <Avatar
            src={post.author?.avatar_url}
            name={post.author?.full_name}
            email={post.author?.email}
            size="sm"
          />
          <span className="min-w-0 flex-1 truncate font-ui text-xs text-portal-text">
            {post.author?.full_name || post.author?.email}
          </span>
          <span className="inline-flex items-center gap-2 text-[10px] uppercase tracking-wider text-portal-text-muted">
            <span className="inline-flex items-center gap-1">
              <Eye className="h-3 w-3" /> {post.viewCount}
            </span>
            <span aria-hidden className="text-portal-text-soft">·</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> {post.read_time_minutes}m
            </span>
          </span>
        </div>
      </Link>
    </article>
  );
}
