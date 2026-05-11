import Link from "next/link";
import { Clock, ImageIcon, Video, Music } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { formatPostDate } from "@/lib/utils/dates";
import type { PostWithAuthor } from "@/lib/db/posts";

function mediaIndicators(html: string) {
  return {
    video: /<video\b|youtube\.com\/embed|vimeo\.com|loom\.com\/embed|drive\.google\.com/.test(html),
    audio: /<audio\b/.test(html),
    image: /<img\b/.test(html),
  };
}

export function PostCard({ post }: { post: PostWithAuthor }) {
  const m = mediaIndicators(post.content_html);
  return (
    <article className="group flex flex-col rounded-xl border bg-card p-5 shadow-sm transition-shadow hover:shadow-md">
      <div className="flex items-center gap-2 mb-2">
        {post.tags.slice(0, 3).map((t) => (
          <Badge key={t.id} variant="secondary">{t.name}</Badge>
        ))}
        {post.status !== "published" && (
          <Badge variant="warning" className="capitalize">{post.status}</Badge>
        )}
      </div>
      <Link href={`/blog/${post.slug}`} className="block">
        <h3 className="text-lg font-semibold leading-snug group-hover:text-primary">
          {post.title}
        </h3>
      </Link>
      {post.excerpt && (
        <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{post.excerpt}</p>
      )}
      <div className="mt-auto pt-4 flex items-center gap-3 text-xs text-muted-foreground">
        <Avatar
          src={post.author?.avatar_url}
          name={post.author?.full_name}
          email={post.author?.email}
          size="sm"
        />
        <span className="font-medium text-foreground">
          {post.author?.full_name || post.author?.email}
        </span>
        <span>·</span>
        <span>{post.published_at ? formatPostDate(post.published_at) : formatPostDate(post.updated_at)}</span>
        <span>·</span>
        <span className="inline-flex items-center gap-1">
          <Clock className="h-3 w-3" /> {post.read_time_minutes} min
        </span>
        <span className="ml-auto inline-flex items-center gap-1.5">
          {m.image && <ImageIcon className="h-3.5 w-3.5" aria-label="Has images" />}
          {m.video && <Video className="h-3.5 w-3.5" aria-label="Has video" />}
          {m.audio && <Music className="h-3.5 w-3.5" aria-label="Has audio" />}
        </span>
      </div>
    </article>
  );
}
