import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Clock, Eye } from "lucide-react";
import { publicEnv } from "@/lib/env";
import {
  getPublicPostBySlug,
  listPublicPosts,
  listComments,
  listReactionCounts,
  listMyReactions,
} from "@/lib/db/public";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, PanelBody } from "@/components/portal/Panel";
import { PublicNav } from "@/components/layout/PublicNav";
import { PortalFooter } from "@/components/layout/PortalFooter";
import { CommentsSection } from "@/components/comments/CommentsSection";
import { ReactionsBar } from "@/components/reactions/ReactionsBar";
import { PostViewTracker } from "@/components/analytics/PostViewTracker";
import { formatPostDate } from "@/lib/utils/dates";
import { roleLabel } from "@/lib/auth/roles";
import { sanitizeHtml } from "@/lib/editor/sanitize";
import { getSessionContext } from "@/lib/auth/guards";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: { params: { slug: string } }): Promise<Metadata> {
  const post = await getPublicPostBySlug(params.slug);
  if (!post) return { title: "Not found" };

  // Build absolute URLs — WhatsApp / Slack / LinkedIn crawlers reject
  // relative paths in `og:image` / `og:url`. NEXT_PUBLIC_APP_URL must be set
  // to the canonical production host.
  const base = (publicEnv.appUrl || "").replace(/\/$/, "");
  const url = `${base}/posts/${post.slug}`;

  // OG image strategy: point at the stable `/api/og-image/[slug]` proxy
  // route. The proxy itself 302s to a fresh Supabase signed URL on each
  // request (or to /og-default.png when no cover is set). Crawlers cache
  // the IMAGE BYTES at their side after the redirect resolves, so subsequent
  // refetches stay valid forever — no signed-URL TTL surprises like the
  // previous direct-Supabase setup had.
  const ogImage = post.coverUrl
    ? `${base}/api/og-image/${encodeURIComponent(post.slug)}`
    : `${base}/og-default.png`;

  const description = post.excerpt ?? `New signal from ${post.author?.full_name ?? "team Dhurandhar"}`;
  const authorName = post.author?.full_name ?? post.author?.email ?? undefined;

  return {
    title: post.title,
    description,
    alternates: { canonical: url },
    openGraph: {
      title: post.title,
      description,
      url,
      type: "article",
      siteName: "CG Signal",
      // Explicit 1200×630 dimensions — LinkedIn / Slack / Facebook use them
      // to choose the large-card layout. The proxy serves whatever aspect
      // the original cover has; the hint is metadata, not a transform.
      images: [{ url: ogImage, width: 1200, height: 630, alt: post.title }],
      publishedTime: post.published_at ?? undefined,
      authors: authorName ? [authorName] : undefined,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description,
      images: [ogImage],
    },
  };
}

export default async function PublicPostPage({ params }: { params: { slug: string } }) {
  const post = await getPublicPostBySlug(params.slug);
  if (!post) notFound();

  // Fetch the rest in parallel — none depend on each other.
  const session = await getSessionContext();
  const [related, comments, reactionCounts, myReactions] = await Promise.all([
    listPublicPosts(8).then((all) =>
      all.filter((p) => p.id !== post.id && p.author_id === post.author_id).slice(0, 3),
    ),
    listComments(post.id),
    listReactionCounts(post.id),
    session ? listMyReactions(post.id, session.userId) : Promise.resolve([]),
  ]);

  const safeHtml = sanitizeHtml(post.content_html);
  const isAdmin = session?.profile.role === "manager";

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
                <div className="mt-1 inline-flex items-center gap-2 text-[10px] uppercase tracking-wider text-portal-text-muted">
                  <span className="inline-flex items-center gap-1">
                    <Eye className="h-3 w-3" /> {post.viewCount} views
                  </span>
                  <span aria-hidden className="text-portal-text-soft">·</span>
                  <span className="inline-flex items-center gap-1">
                    <Clock className="h-3 w-3" /> {post.read_time_minutes} min read
                  </span>
                </div>
              </div>
            </div>

            <div className="article-body mt-8" dangerouslySetInnerHTML={{ __html: safeHtml }} />
          </article>

          {/* Tracks one Supabase row per session per post (30-min throttle)
              and a Vercel `post_view` event on every navigation. */}
          <PostViewTracker
            postId={post.id}
            slug={post.slug}
            title={post.title}
            author={post.author?.full_name ?? post.author?.email ?? null}
            isLoggedIn={!!session}
          />

          {/* Reactions */}
          <div className="mt-10 border-t border-portal-border-soft pt-6">
            <div className="mb-3 text-[10px] uppercase tracking-wider text-portal-text-muted">
              Reactions
            </div>
            <ReactionsBar
              postId={post.id}
              postSlug={post.slug}
              counts={reactionCounts}
              myReactions={myReactions}
              isAuthenticated={!!session}
            />
          </div>

          {/* Comments */}
          <CommentsSection
            postId={post.id}
            postSlug={post.slug}
            postAuthorId={post.author_id}
            comments={comments}
            currentUserId={session?.userId ?? null}
            isManager={isAdmin}
          />

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
