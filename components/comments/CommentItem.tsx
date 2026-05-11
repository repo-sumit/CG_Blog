"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2 } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { deleteComment } from "@/app/posts/[slug]/actions";

interface Props {
  id: string;
  authorName: string;
  authorAvatar: string | null;
  body: string;
  createdAt: string;
  canDelete: boolean;
}

function formatRelative(iso: string): string {
  const t = new Date(iso).getTime();
  const diff = Date.now() - t;
  const min = Math.floor(diff / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min}m ago`;
  const hr = Math.floor(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const days = Math.floor(hr / 24);
  if (days < 7) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

export function CommentItem({ id, authorName, authorAvatar, body, createdAt, canDelete }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function remove() {
    if (!window.confirm("Delete this comment?")) return;
    startTransition(async () => {
      const res = await deleteComment(id);
      if (!res.ok) toast.error(res.error ?? "Failed to delete.");
      else {
        toast.success("Comment deleted.");
        router.refresh();
      }
    });
  }

  return (
    <li className="flex gap-3 py-3">
      <Avatar src={authorAvatar} name={authorName} size="sm" />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="font-ui text-xs font-bold text-portal-text">{authorName}</span>
          <span className="text-[10px] uppercase tracking-wider text-portal-text-muted">
            {formatRelative(createdAt)}
          </span>
          {canDelete && (
            <button
              type="button"
              onClick={remove}
              disabled={pending}
              className="ml-auto inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[10px] uppercase tracking-wider text-portal-text-muted hover:bg-portal-panel-soft hover:text-portal-red disabled:opacity-50"
              aria-label="Delete comment"
            >
              <Trash2 className="h-3 w-3" />
            </button>
          )}
        </div>
        <p className="mt-1 whitespace-pre-wrap break-words text-sm leading-relaxed text-portal-text">
          {body}
        </p>
      </div>
    </li>
  );
}
