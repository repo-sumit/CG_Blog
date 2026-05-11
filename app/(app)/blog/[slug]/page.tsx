import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Clock } from "lucide-react";
import { requireSession } from "@/lib/auth/guards";
import { getPostBySlug, listPublishedPosts } from "@/lib/db/posts";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card, CardContent } from "@/components/ui/Card";
import { formatPostDate, weekdayLabel } from "@/lib/utils/dates";
import { sanitizeHtml } from "@/lib/editor/sanitize";
import { BlockRenderer } from "@/components/blocks/BlockRenderer";
import { BlocksArraySchema } from "@/lib/blocks";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await getPostBySlug(params.slug);
  return {
    title: post?.title ?? "Post",
    description: post?.excerpt ?? undefined,
    robots: { index: false, follow: false },
  };
}

export default async function PostDetailPage({ params }: { params: { slug: string } }) {
  const { profile, userId } = await requireSession();
  const post = await getPostBySlug(params.slug);
  if (!post) notFound();

  // Visibility: viewer can only see published; author can see their own; manager sees all.
  if (post.status !== "published") {
    if (profile.role !== "manager" && post.author_id !== userId) {
      notFound();
    }
  }

  const related = await listPublishedPosts({ authorId: post.author_id, limit: 4 });
  const relatedFiltered = related.filter((p) => p.id !== post.id).slice(0, 3);

  // Pick renderer: blocks (new) if non-empty, otherwise sanitized Tiptap HTML.
  const parsedBlocks = BlocksArraySchema.safeParse(post.blocks);
  const hasBlocks = parsedBlocks.success && parsedBlocks.data.length > 0;
  const safeHtml = hasBlocks ? "" : sanitizeHtml(post.content_html);

  return (
    <main className="container mx-auto max-w-3xl px-4 py-8">
      <Button asChild variant="ghost" size="sm" className="mb-4 -ml-2">
        <Link href="/blog">
          <ChevronLeft className="mr-1 h-4 w-4" /> Back to blog
        </Link>
      </Button>

      <article>
        <div className="flex flex-wrap gap-2 mb-3">
          {post.tags.map((t) => (
            <Badge key={t.id} variant="secondary">{t.name}</Badge>
          ))}
          {post.status !== "published" && (
            <Badge variant="warning" className="capitalize">{post.status}</Badge>
          )}
          {post.assigned_weekday && (
            <Badge variant="outline">{weekdayLabel(post.assigned_weekday)}</Badge>
          )}
        </div>

        <h1 className="text-4xl font-bold tracking-tight">{post.title}</h1>
        {post.excerpt && (
          <p className="mt-3 text-lg text-muted-foreground">{post.excerpt}</p>
        )}

        <div className="mt-6 flex items-center gap-3 border-y py-4">
          <Avatar
            src={post.author?.avatar_url}
            name={post.author?.full_name}
            email={post.author?.email}
            size="lg"
          />
          <div className="flex-1">
            <div className="font-medium">{post.author?.full_name || post.author?.email}</div>
            <div className="text-xs text-muted-foreground capitalize">{post.author?.role}</div>
          </div>
          <div className="text-right text-xs text-muted-foreground">
            <div>{post.published_at ? formatPostDate(post.published_at) : "Draft"}</div>
            <div className="mt-0.5 inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> {post.read_time_minutes} min read
            </div>
          </div>
        </div>

        <div className="article-body mt-6">
          {hasBlocks ? (
            <BlockRenderer blocks={parsedBlocks.data} />
          ) : (
            <div
              // legacy posts: sanitized server-side from Tiptap-generated HTML
              dangerouslySetInnerHTML={{ __html: safeHtml }}
            />
          )}
        </div>
      </article>

      {relatedFiltered.length > 0 && (
        <section className="mt-12">
          <h2 className="mb-4 text-lg font-semibold">More from {post.author?.full_name || post.author?.email}</h2>
          <div className="grid gap-4 sm:grid-cols-2">
            {relatedFiltered.map((p) => (
              <Card key={p.id}>
                <CardContent className="p-4">
                  <Link href={`/blog/${p.slug}`} className="font-medium hover:text-primary">
                    {p.title}
                  </Link>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {p.published_at ? formatPostDate(p.published_at) : ""} · {p.read_time_minutes} min
                  </p>
                </CardContent>
              </Card>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}
