import type { Metadata } from "next";
import Link from "next/link";
import { Search } from "lucide-react";
import { requireSession } from "@/lib/auth/guards";
import { listPublishedPosts } from "@/lib/db/posts";
import { listTags } from "@/lib/db/tags";
import { listTeam } from "@/lib/db/profiles";
import { PostCard } from "@/components/blog/PostCard";
import { Card, CardContent } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/utils/cn";

export const metadata: Metadata = { title: "Blog" };
export const dynamic = "force-dynamic";

interface SearchParams {
  q?: string;
  tag?: string;
  author?: string;
}

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
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Team blog</h1>
          <p className="text-sm text-muted-foreground">
            Weekly updates from across the team.
          </p>
        </div>
      </div>

      <Card className="mb-6">
        <CardContent className="p-4">
          <form className="flex flex-wrap items-center gap-3" action="/blog" method="get">
            <div className="relative flex-1 min-w-[220px]">
              <Search className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                name="q"
                defaultValue={searchParams.q ?? ""}
                placeholder="Search posts…"
                className="pl-9"
              />
            </div>
            <select
              name="author"
              defaultValue={activeAuthor ?? ""}
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
            >
              <option value="">All authors</option>
              {team.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.full_name || m.email}
                </option>
              ))}
            </select>
            {activeTag && <input type="hidden" name="tag" value={activeTag} />}
            <Button type="submit" variant="secondary">Filter</Button>
            {(searchParams.q || activeTag || activeAuthor) && (
              <Button asChild variant="ghost" size="sm">
                <Link href="/blog">Clear</Link>
              </Button>
            )}
          </form>

          {tags.length > 0 && (
            <div className="mt-3 flex flex-wrap gap-1.5">
              <Link
                href={{ pathname: "/blog", query: { ...searchParams, tag: undefined } }}
                className={cn(
                  "rounded-md px-2 py-0.5 text-xs",
                  !activeTag ? "bg-primary text-primary-foreground" : "bg-secondary text-secondary-foreground hover:bg-secondary/70",
                )}
              >
                All
              </Link>
              {tags.map((t) => (
                <Link
                  key={t.id}
                  href={{ pathname: "/blog", query: { ...searchParams, tag: t.slug } }}
                  className={cn(
                    "rounded-md px-2 py-0.5 text-xs",
                    activeTag === t.slug
                      ? "bg-primary text-primary-foreground"
                      : "bg-secondary text-secondary-foreground hover:bg-secondary/70",
                  )}
                >
                  {t.name}
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {posts.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <h2 className="text-lg font-medium">No posts match your filters yet.</h2>
          <p className="mt-1 text-sm text-muted-foreground">Try clearing filters or check back later.</p>
          <Button asChild variant="outline" className="mt-4">
            <Link href="/blog">Clear filters</Link>
          </Button>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {posts.map((p) => (
            <PostCard key={p.id} post={p} />
          ))}
        </div>
      )}
    </main>
  );
}
