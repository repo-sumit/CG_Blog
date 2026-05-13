"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Trash2, Undo2, ShieldAlert } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { softDeletePost, restorePost, permanentDeletePost } from "@/app/(app)/editor/actions";

interface Props {
  postId: string;
  status: string;
  /** Kept for back-compat with admin callers; archived posts always allow the
   *  owner to permanently delete, so this only gates the option on live rows. */
  canPermanentDelete: boolean;
}

export function PostRowActions({ postId, status, canPermanentDelete }: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onSoftDelete() {
    if (!window.confirm("Move this post to the trash? You can restore or permanently delete it later.")) return;
    startTransition(async () => {
      const res = await softDeletePost(postId);
      if (!res.ok) toast.error(res.error || "Failed to delete.");
      else {
        toast.success("Moved to trash.");
        router.refresh();
      }
    });
  }

  function onRestore() {
    startTransition(async () => {
      const res = await restorePost(postId);
      if (!res.ok) toast.error(res.error || "Failed to restore.");
      else {
        toast.success("Restored as draft.");
        router.refresh();
      }
    });
  }

  function onPermanentDelete() {
    if (!window.confirm("Permanently delete this post? This cannot be undone.")) return;
    startTransition(async () => {
      const res = await permanentDeletePost(postId);
      if (!res.ok) toast.error(res.error || "Failed.");
      else {
        toast.success("Post permanently deleted.");
        router.refresh();
      }
    });
  }

  if (status === "archived") {
    // The owner (and any manager) can permanently delete from trash. The
    // `canPermanentDelete` flag is ignored here so authors can clean up their
    // own bin without an admin.
    return (
      <div className="flex items-center gap-2">
        <Button size="sm" variant="outline" onClick={onRestore} disabled={pending}>
          <Undo2 className="h-3.5 w-3.5" /> Restore
        </Button>
        <Button size="sm" variant="destructive" onClick={onPermanentDelete} disabled={pending}>
          <ShieldAlert className="h-3.5 w-3.5" /> Delete forever
        </Button>
      </div>
    );
  }

  return (
    <Button size="sm" variant="ghost" onClick={onSoftDelete} disabled={pending} aria-label="Delete">
      <Trash2 className="h-3.5 w-3.5" />
    </Button>
  );
}
