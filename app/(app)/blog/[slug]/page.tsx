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
import { SystemLabel, JapaneseLabel } from "@/components/portal/SystemLabel";
import { formatPostDate, weekdayLabel } from "@/lib/utils/dates";
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

function ordinal(id: string): string {
  const n = Math.abs(id.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % 1000;
  return n.toString().padStart(3, "0");
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
        <div className="mb-4 flex items-center gap-3">
          <SystemLabel tone="orange">{`${ordinal(post.id)} // Transmission`}</SystemLabel>
          <JapaneseLabel>記事</JapaneseLabel>
          {post.status !== "published" && <Badge variant="warning">{post.status}</Badge>}
          {post.assigned_weekday && <Badge variant="outline">{weekdayLabel(post.assigned_weekday)}</Badge>}
        </div>

        {post.tags.length > 0 && (
          <div className="mb-4 flex flex-wrap gap-1.5">
            {post.tags.map((t) => (
              <Badge key={t.id} variant="secondary">{t.name}</Badge>
            ))}
          </div>
        )}

        <h1 className="font-hero text-5xl font-bold uppercase leading-[0.95] tracking-tighter text-portal-text sm:text-6xl">
          {post.title}
        </h1>
        {post.excerpt && (
          <p className="mt-5 text-lg leading-relaxed text-portal-text-muted">{post.excerpt}</p>
        )}

        <div className="mt-8 flex items-center gap-4 border-y-2 border-portal-border-soft py-4">
          <Avatar
            src={post.author?.avatar_url}
            name={post.author?.full_name}
            email={post.author?.email}
            size="lg"
          />
          <div className="flex-1">
            <div className="font-ui text-sm font-bold text-portal-text">
              {post.author?.full_name || post.author?.email}
            </div>
            <SystemLabel className="mt-0.5">{post.author?.role}</SystemLabel>
          </div>
          <div className="text-right">
            <SystemLabel>{post.published_at ? formatPostDate(post.published_at) : "Draft"}</SystemLabel>
            <div className="mt-1 inline-flex items-center gap-1 font-ui text-[10px] uppercase tracking-label text-portal-text-soft">
              <Clock className="h-3 w-3" /> {post.read_time_minutes} min read
            </div>
          </div>
        </div>

        <div className="article-body mt-8" dangerouslySetInnerHTML={{ __html: safeHtml }} />
      </article>

      {relatedFiltered.length > 0 && (
        <section className="mt-16">
          <SystemLabel tone="orange" className="mb-3 block">More from this author</SystemLabel>
          <div className="grid gap-4 sm:grid-cols-2">
            {relatedFiltered.map((p) => (
              <Panel key={p.id} variant="raised">
                <PanelBody className="p-4">
                  <SystemLabel>{`${ordinal(p.id)} // Archive`}</SystemLabel>
                  <Link href={`/blog/${p.slug}`} className="mt-2 block font-ui font-bold text-portal-text hover:text-portal-orange">
                    {p.title}
                  </Link>
                  <div className="mt-2">
                    <SystemLabel>
                      {p.published_at ? formatPostDate(p.published_at) : ""} · {p.read_time_minutes} min
                    </SystemLabel>
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
