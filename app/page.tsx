import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, Clock } from "lucide-react";
import { redirect } from "next/navigation";
import { listPublicPosts, listPublicTags, listPublicAuthors } from "@/lib/db/public";
import { PublicNav } from "@/components/layout/PublicNav";
import { PortalFooter } from "@/components/layout/PortalFooter";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Avatar } from "@/components/ui/Avatar";
import { Panel, PanelBody } from "@/components/portal/Panel";
import { formatPostDate } from "@/lib/utils/dates";
import { roleLabel } from "@/lib/auth/roles";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "CG Signal — Team Blog Portal",
  description: "Weekly transmissions from the ConveGenius.ai team.",
};

interface SearchParams {
  tag?: string;
}

export default async function PublicLandingPage({ searchParams }: { searchParams: SearchParams }) {
  // /?code=... means we've been redirected from Supabase OAuth onto the bare
  // origin (Site URL fallback). Forward the code to the real callback so
  // sign-in completes without dead-ending here.
  if ("code" in searchParams) {
    const code = (searchParams as { code?: string }).code;
    if (code) redirect(`/api/auth/callback?code=${encodeURIComponent(code)}`);
  }

  const [allPosts, tags, authors] = await Promise.all([
    listPublicPosts(30),
    listPublicTags(),
    listPublicAuthors(),
  ]);

  const filtered = searchParams.tag
    ? allPosts.filter((p) => p.tags.some((t) => t.slug === searchParams.tag))
    : allPosts;

  const [featured, ...rest] = filtered;

  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />

      <main className="flex-1">
        {/* Hero */}
        <section className="container mx-auto px-4 py-14 sm:py-20">
          <div className="max-w-3xl space-y-5">
            <div className="text-[11px] uppercase tracking-wider text-portal-orange">
              CG Signal · Internal Blog OS
            </div>
            <h1 className="font-hero text-5xl font-bold uppercase leading-[0.95] tracking-tighter text-portal-text sm:text-7xl">
              The team
              <br />
              signal feed.
            </h1>
            <p className="max-w-xl text-base leading-relaxed text-portal-text-muted">
              Weekly transmissions from across ConveGenius.ai. Notes, retros, launches, and
              experiments — written by the people doing the work.
            </p>
            <div className="flex flex-wrap items-center gap-3 pt-2">
              <Button asChild>
                <Link href="#feed">
                  Read latest <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <span className="text-[11px] uppercase tracking-wider text-portal-text-muted">
                {allPosts.length} posts · {authors.length} contributors
              </span>
            </div>
          </div>
        </section>

        {/* Category strip */}
        {tags.length > 0 && (
          <section className="container mx-auto px-4">
            <div className="flex flex-wrap items-center gap-1.5 border-y border-portal-border-soft py-4">
              <span className="mr-2 text-[10px] uppercase tracking-wider text-portal-text-muted">
                Filter:
              </span>
              <Link
                href="/"
                className={
                  "rounded-pill border px-3 py-0.5 font-ui text-[10px] uppercase tracking-wider transition-colors " +
                  (!searchParams.tag
                    ? "border-portal-orange/40 bg-portal-orange/10 text-portal-orange"
                    : "border-portal-border-soft text-portal-text-muted hover:border-portal-border-muted")
                }
              >
                All
              </Link>
              {tags.map((t) => (
                <Link
                  key={t.id}
                  href={`/?tag=${t.slug}`}
                  className={
                    "rounded-pill border px-3 py-0.5 font-ui text-[10px] uppercase tracking-wider transition-colors " +
                    (searchParams.tag === t.slug
                      ? "border-portal-orange/40 bg-portal-orange/10 text-portal-orange"
                      : "border-portal-border-soft text-portal-text-muted hover:border-portal-border-muted")
                  }
                >
                  {t.name}
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* Featured */}
        {featured && (
          <section className="container mx-auto px-4 py-10" id="feed">
            <div className="mb-4 text-[11px] uppercase tracking-wider text-portal-text-muted">
              Featured transmission
            </div>
            <Panel variant="bright">
              <Link href={`/posts/${featured.slug}`} className="block">
                <div className="grid gap-0 lg:grid-cols-[1.2fr_1fr]">
                  {/* Decorative panel column */}
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
                      <p className="text-sm leading-relaxed text-portal-text-muted">{featured.excerpt}</p>
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

        {/* Latest grid */}
        <section className="container mx-auto px-4 pb-16">
          {rest.length === 0 && !featured ? (
            <div className="rounded-md border border-dashed border-portal-border-soft p-16 text-center">
              <h2 className="font-hero text-xl font-bold uppercase text-portal-text">No transmissions yet</h2>
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
                {rest.map((p) => (
                  <PublicPostCard key={p.id} post={p} />
                ))}
              </div>
            </>
          ) : null}
        </section>

        {/* Contributors */}
        {authors.length > 0 && (
          <section className="container mx-auto px-4 pb-16">
            <div className="mb-4 text-[11px] uppercase tracking-wider text-portal-text-muted">
              Contributors
            </div>
            <div className="flex flex-wrap gap-3">
              {authors.map((a) => (
                <div
                  key={a.id}
                  className="inline-flex items-center gap-2.5 rounded-pill border border-portal-border-soft bg-portal-panel-soft px-3 py-1.5"
                >
                  <Avatar src={a.avatar_url} name={a.full_name} email={a.email} size="sm" />
                  <div className="leading-tight">
                    <div className="font-ui text-xs text-portal-text">
                      {a.full_name || a.email.split("@")[0]}
                    </div>
                    <div className="text-[9px] uppercase tracking-wider text-portal-text-muted">
                      {roleLabel(a.role)}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </main>

      <PortalFooter />
    </div>
  );
}

function PublicPostCard({ post }: { post: Awaited<ReturnType<typeof listPublicPosts>>[number] }) {
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
          <span className="inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-portal-text-muted">
            <Clock className="h-3 w-3" /> {post.read_time_minutes}m
          </span>
        </div>
      </Link>
    </article>
  );
}
