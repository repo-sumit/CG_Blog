import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Clock } from "lucide-react";
import { requireSession } from "@/lib/auth/guards";
import { getPostBySlug, listPublishedPosts } from "@/lib/db/posts";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, PanelBody } from "@/components/portal/Panel";
import { formatPostDate, weekdayLabel } from "@/lib/utils/dates";
import { roleLabel } from "@/lib/auth/roles";
import { sanitizeHtml } from "@/lib/editor/sanitize";

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
  if (post.status !== "published") {
    if (profile.role !== "manager" && post.author_id !== userId) notFound();
  }

  const related = await listPublishedPosts({ authorId: post.author_id, limit: 4 });
  const relatedFiltered = related.filter((p) => p.id !== post.id).slice(0, 3);
  const safeHtml = sanitizeHtml(post.content_html);

  return (
    <div className="container mx-auto max-w-3xl px-4 py-10">
      <Button asChild variant="ghost" size="sm" className="mb-6">
        <Link href="/blog"><ChevronLeft className="h-4 w-4" /> Back to feed</Link>
      </Button>

      <article>
        <div className="mb-4 flex flex-wrap items-center gap-1.5">
          {post.tags.map((t) => (
            <Badge key={t.id} variant="secondary">{t.name}</Badge>
          ))}
          {post.status !== "published" && <Badge variant="warning">{post.status}</Badge>}
          {post.assigned_weekday && <Badge variant="outline">{weekdayLabel(post.assigned_weekday)}</Badge>}
        </div>

        <h1 className="font-hero text-4xl font-bold uppercase leading-[1] tracking-tighter text-portal-text sm:text-5xl lg:text-6xl">
          {post.title}
        </h1>
        {post.excerpt && (
          <p className="mt-5 text-lg leading-relaxed text-portal-text-muted">{post.excerpt}</p>
        )}

        <div className="mt-8 flex items-center gap-4 border-y border-portal-border-soft py-4">
          <Avatar
            src={post.author?.avatar_url}
            name={post.author?.full_name}
            email={post.author?.email}
            size="lg"
          />
          <div className="min-w-0 flex-1">
            <div className="truncate font-ui text-sm font-bold text-portal-text">
              {post.author?.full_name || post.author?.email}
            </div>
            <div className="text-[10px] uppercase tracking-wider text-portal-text-muted">
              {roleLabel(post.author?.role)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-[10px] uppercase tracking-wider text-portal-text-muted">
              {post.published_at ? formatPostDate(post.published_at) : "Draft"}
            </div>
            <div className="mt-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-portal-text-muted">
              <Clock className="h-3 w-3" /> {post.read_time_minutes} min read
            </div>
          </div>
        </div>

        <div className="article-body mt-8" dangerouslySetInnerHTML={{ __html: safeHtml }} />
      </article>

      {relatedFiltered.length > 0 && (
        <section className="mt-16">
          <div className="mb-3 text-[11px] uppercase tracking-wider text-portal-text-muted">
            More from this author
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {relatedFiltered.map((p) => (
              <Panel key={p.id} variant="raised">
                <PanelBody className="p-4">
                  <Link href={`/blog/${p.slug}`} className="block font-ui font-bold text-portal-text hover:text-portal-orange">
                    {p.title}
                  </Link>
                  <div className="mt-2 text-[10px] uppercase tracking-wider text-portal-text-muted">
                    {p.published_at ? formatPostDate(p.published_at) : ""} · {p.read_time_minutes} min
                  </div>
                </PanelBody>
              </Panel>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
