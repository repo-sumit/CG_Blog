import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { requireSession } from "@/lib/auth/guards";
import { listPublishedPosts } from "@/lib/db/posts";
import { listTags } from "@/lib/db/tags";
import { listTeam } from "@/lib/db/profiles";
import { PostCard } from "@/components/blog/PostCard";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Signal Feed" };
export const dynamic = "force-dynamic";

interface SearchParams { q?: string; tag?: string; author?: string }

export default async function BlogPage({ searchParams }: { searchParams: SearchParams }) {
  await requireSession();
  const [posts, tags, team] = await Promise.all([
    listPublishedPosts({
      search: searchParams.q,
      tag: searchParams.tag,
      authorId: searchParams.author,
      limit: 60,
    }),
    listTags(),
    listTeam(),
  ]);
  const activeTag = searchParams.tag;
  const activeAuthor = searchParams.author;

  return (
    <div className="container mx-auto space-y-6 px-4 py-10">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <h1 className="font-hero text-4xl font-bold uppercase tracking-tighter text-portal-text sm:text-5xl">
            Signal Feed
          </h1>
          <p className="max-w-xl text-sm text-portal-text-muted">
            Every weekly transmission, indexed and searchable.
          </p>
        </div>
        <div className="text-[11px] uppercase tracking-wider text-portal-text-muted">
          {posts.length} transmissions
        </div>
      </header>

      <div className="rounded-md border border-portal-border-soft bg-portal-panel-soft p-4">
        <form className="flex flex-wrap items-center gap-3" action="/blog" method="get">
          <div className="relative min-w-[240px] flex-1">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-portal-text-muted" />
            <Input
              name="q"
              defaultValue={searchParams.q ?? ""}
              placeholder="Search signal feed…"
              className="pl-10"
            />
          </div>
          <select
            name="author"
            defaultValue={activeAuthor ?? ""}
            className="h-11 rounded-pill border border-portal-border-muted bg-portal-panel-soft px-4 font-ui text-sm text-portal-text"
          >
            <option value="">All authors</option>
            {team.map((m) => (
              <option key={m.id} value={m.id}>{m.full_name || m.email}</option>
            ))}
          </select>
          {activeTag && <input type="hidden" name="tag" value={activeTag} />}
          <Button type="submit" variant="outline">Filter</Button>
          {(searchParams.q || activeTag || activeAuthor) && (
            <Button asChild variant="ghost" size="sm">
              <Link href="/blog">Clear</Link>
            </Button>
          )}
        </form>

        {tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5 border-t border-portal-border-soft pt-3">
            <Link
              href={{ pathname: "/blog", query: { ...searchParams, tag: undefined } }}
              className={cn(
                "rounded-pill border px-3 py-0.5 font-ui text-[10px] uppercase tracking-wider transition-colors",
                !activeTag
                  ? "border-portal-orange/40 bg-portal-orange/10 text-portal-orange"
                  : "border-portal-border-soft text-portal-text-muted hover:border-portal-border-muted",
              )}
            >
              All
            </Link>
            {tags.map((t) => (
              <Link
                key={t.id}
                href={{ pathname: "/blog", query: { ...searchParams, tag: t.slug } }}
                className={cn(
                  "rounded-pill border px-3 py-0.5 font-ui text-[10px] uppercase tracking-wider transition-colors",
                  activeTag === t.slug
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

      {posts.length === 0 ? (
        <div className="rounded-md border border-dashed border-portal-border-soft p-16 text-center">
          <h2 className="font-hero text-xl font-bold uppercase text-portal-text">No signals match</h2>
          <p className="mt-2 text-sm text-portal-text-muted">
            Try clearing filters or wait for the next transmission.
          </p>
          <Button asChild variant="outline" className="mt-5">
            <Link href="/blog">Reset filters</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => <PostCard key={p.id} post={p} />)}
        </div>
      )}
    </div>
  );
}
