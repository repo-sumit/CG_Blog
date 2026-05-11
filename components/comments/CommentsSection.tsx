import { CommentForm } from "./CommentForm";
import { CommentItem } from "./CommentItem";
import type { PublicComment } from "@/lib/db/public";

interface Props {
  postId: string;
  postSlug: string;
  postAuthorId: string;
  comments: PublicComment[];
  /** Currently signed-in user (null = anonymous). */
  currentUserId: string | null;
  isManager: boolean;
}

/**
 * Renders the discussion below a post. Server-component shell: the form +
 * each comment row are client components so they can manage their own
 * pending/optimistic state.
 *
 * Delete permissions:
 *   - comment author can delete their own
 *   - post author can delete any on their post
 *   - admins can delete any
 */
export function CommentsSection({
  postId,
  postSlug,
  postAuthorId,
  comments,
  currentUserId,
  isManager,
}: Props) {
  return (
    <section id="comments" className="mt-16 scroll-mt-24">
      <header className="mb-4 flex items-end justify-between">
        <h2 className="font-hero text-2xl font-bold uppercase tracking-tighter text-portal-text">
          Discussion
        </h2>
        <span className="text-[10px] uppercase tracking-wider text-portal-text-muted">
          {comments.length} {comments.length === 1 ? "comment" : "comments"}
        </span>
      </header>

      <div className="mb-6">
        <CommentForm
          postId={postId}
          postSlug={postSlug}
          isAuthenticated={currentUserId !== null}
        />
      </div>

      {comments.length === 0 ? (
        <div className="rounded-md border border-dashed border-portal-border-soft p-8 text-center text-sm text-portal-text-muted">
          No comments yet. Start the signal.
        </div>
      ) : (
        <ul className="divide-y divide-portal-border-soft">
          {comments.map((c) => {
            const canDelete =
              !!currentUserId &&
              (c.user_id === currentUserId || postAuthorId === currentUserId || isManager);
            return (
              <CommentItem
                key={c.id}
                id={c.id}
                authorName={c.author_name}
                authorAvatar={c.author_avatar_url}
                body={c.body}
                createdAt={c.created_at}
                canDelete={canDelete}
              />
            );
          })}
        </ul>
      )}
    </section>
  );
}
