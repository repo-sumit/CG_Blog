import Link from "next/link";
import { Clock, ImageIcon, Video, Music } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { SystemLabel } from "@/components/portal/SystemLabel";
import { formatPostDate } from "@/lib/utils/dates";
import type { PostWithAuthor } from "@/lib/db/posts";

function mediaIndicators(html: string) {
  return {
    video: /<video\b|youtube\.com\/embed|vimeo\.com|loom\.com\/embed|drive\.google\.com/.test(html),
    audio: /<audio\b/.test(html),
    image: /<img\b/.test(html),
  };
}

// Build a numeric ordinal like "001" from the post id — purely decorative,
// matches the design language ("001 // FEATURED").
function ordinal(id: string): string {
  const n = Math.abs(id.split("").reduce((a, c) => a + c.charCodeAt(0), 0)) % 1000;
  return n.toString().padStart(3, "0");
}

export function PostCard({ post }: { post: PostWithAuthor }) {
  const m = mediaIndicators(post.content_html);
  const primaryTag = post.tags[0]?.name?.toUpperCase() ?? "SIGNAL";
  return (
    <article className="group relative overflow-hidden rounded-panel border-2 border-portal-border-soft bg-portal-panel-raised shadow-portal transition-all duration-200 hover:-translate-y-1 hover:border-portal-border-main hover:shadow-glow">
      {/* Decorative media panel */}
      <Link href={`/blog/${post.slug}`} className="block">
        <div className="relative h-32 border-b-2 border-portal-border-soft bg-portal-panel-soft">
          <div
            aria-hidden
            className="absolute inset-0 opacity-50"
            style={{
              background:
                "radial-gradient(circle at 20% 30%, rgba(255,90,31,0.18), transparent 40%), radial-gradient(circle at 80% 60%, rgba(79,140,255,0.16), transparent 45%)",
            }}
          />
          <div aria-hidden className="absolute inset-0 grid-overlay-sm opacity-50" />
          <div className="absolute bottom-3 left-4 right-4 flex items-center justify-between">
            <SystemLabel tone="orange">{ordinal(post.id)} // {primaryTag}</SystemLabel>
            <span className="inline-flex items-center gap-1.5 text-portal-text-muted">
              {m.image && <ImageIcon className="h-3.5 w-3.5" aria-label="image" />}
              {m.video && <Video className="h-3.5 w-3.5" aria-label="video" />}
              {m.audio && <Music className="h-3.5 w-3.5" aria-label="audio" />}
            </span>
          </div>
        </div>
      </Link>

      <div className="p-5">
        <Link href={`/blog/${post.slug}`} className="block">
          <h3 className="font-hero text-xl font-bold uppercase leading-tight tracking-tighter text-portal-text group-hover:text-portal-orange">
            {post.title}
          </h3>
        </Link>
        {post.excerpt && (
          <p className="mt-2 line-clamp-2 text-sm leading-relaxed text-portal-text-muted">{post.excerpt}</p>
        )}

        {post.tags.length > 0 && (
          <div className="mt-3 flex flex-wrap gap-1.5">
            {post.tags.slice(0, 3).map((t) => (
              <Badge key={t.id} variant="secondary">{t.name}</Badge>
            ))}
            {post.status !== "published" && <Badge variant="warning">{post.status}</Badge>}
          </div>
        )}

        <div className="mt-4 flex items-center gap-2 border-t-2 border-portal-border-soft pt-3">
          <Avatar
            src={post.author?.avatar_url}
            name={post.author?.full_name}
            email={post.author?.email}
            size="sm"
          />
          <span className="font-ui text-[11px] uppercase tracking-wider text-portal-text">
            {post.author?.full_name || post.author?.email}
          </span>
          <span className="ml-auto inline-flex items-center gap-2 font-ui text-[10px] uppercase tracking-label text-portal-text-soft">
            <span>{post.published_at ? formatPostDate(post.published_at) : formatPostDate(post.updated_at)}</span>
            <span>·</span>
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" /> {post.read_time_minutes}m
            </span>
          </span>
        </div>
      </div>
    </article>
  );
}
