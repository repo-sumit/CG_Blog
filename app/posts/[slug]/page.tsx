import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Clock } from "lucide-react";
import { getPublicPostBySlug, listPublicPosts } from "@/lib/db/public";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, PanelBody } from "@/components/portal/Panel";
import { PublicNav } from "@/components/layout/PublicNav";
import { PortalFooter } from "@/components/layout/PortalFooter";
import { formatPostDate, weekdayLabel } from "@/lib/utils/dates";
import { roleLabel } from "@/lib/auth/roles";
import { sanitizeHtml } from "@/lib/editor/sanitize";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await getPublicPostBySlug(params.slug);
  if (!post) return { title: "Not found" };
  return {
    title: post.title,
    description: post.excerpt ?? undefined,
    openGraph: {
      title: post.title,
      description: post.excerpt ?? undefined,
      type: "article",
    },
  };
}

export default async function PublicPostPage({ params }: { params: { slug: string } }) {
  const post = await getPublicPostBySlug(params.slug);
  // `getPublicPostBySlug` already pins to status='published'; null = either
  // missing or unpublished, so 404 is correct in both cases.
  if (!post) notFound();

  const related = (await listPublicPosts(8))
    .filter((p) => p.id !== post.id && p.author_id === post.author_id)
    .slice(0, 3);

  const safeHtml = sanitizeHtml(post.content_html);

  return (
    <div className="flex min-h-screen flex-col">
      <PublicNav />

      <main className="flex-1">
        <div className="container mx-auto max-w-3xl px-4 py-10">
          <Button asChild variant="ghost" size="sm" className="mb-6">
            <Link href="/">
              <ChevronLeft className="h-4 w-4" /> All posts
            </Link>
          </Button>

          <article>
            <div className="mb-4 flex flex-wrap items-center gap-1.5">
              {post.tags.map((t) => (
                <Badge key={t.id} variant="secondary">{t.name}</Badge>
              ))}
              {post.assigned_weekday && (
                <Badge variant="outline">{weekdayLabel(post.assigned_weekday)}</Badge>
              )}
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
                  {post.published_at ? formatPostDate(post.published_at) : ""}
                </div>
                <div className="mt-1 inline-flex items-center gap-1 text-[10px] uppercase tracking-wider text-portal-text-muted">
                  <Clock className="h-3 w-3" /> {post.read_time_minutes} min read
                </div>
              </div>
            </div>

            <div className="article-body mt-8" dangerouslySetInnerHTML={{ __html: safeHtml }} />
          </article>

          {related.length > 0 && (
            <section className="mt-16">
              <div className="mb-3 text-[11px] uppercase tracking-wider text-portal-text-muted">
                More from {post.author?.full_name || post.author?.email}
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                {related.map((p) => (
                  <Panel key={p.id} variant="raised">
                    <PanelBody className="p-4">
                      <Link
                        href={`/posts/${p.slug}`}
                        className="block font-ui font-bold text-portal-text hover:text-portal-orange"
                      >
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
      </main>

      <PortalFooter />
    </div>
  );
}
