"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { toast } from "sonner";
import { Save, Send, FileCheck2, Loader2 } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { savePost } from "@/app/(app)/editor/actions";
import { weekdayLabel } from "@/lib/utils/dates";
import type { PostRow, PostStatus, TagRow, AppRole } from "@/lib/db/types";
import type { CMSBlock } from "@/lib/blocks/types";
import { BlockEditor } from "@/components/blocks/BlockEditor";
import { cn } from "@/lib/utils/cn";

type SaveState = "idle" | "saving" | "saved" | "unsaved" | "error";

interface Props {
  initialPost?: Partial<PostRow> & { tag_ids?: string[]; blocks?: CMSBlock[] };
  tags: Pick<TagRow, "id" | "name" | "slug">[];
  role: AppRole;
  requireReview: boolean;
}

const AUTOSAVE_MS = 4000;

export function BlocksPostEditor({ initialPost, tags, role, requireReview }: Props) {
  const router = useRouter();
  const isNew = !initialPost?.id;

  const [postId, setPostId] = useState<string | undefined>(initialPost?.id);
  const [title, setTitle] = useState(initialPost?.title ?? "");
  const [excerpt, setExcerpt] = useState(initialPost?.excerpt ?? "");
  const [status, setStatus] = useState<PostStatus>((initialPost?.status as PostStatus) ?? "draft");
  const [assignedWeekday, setAssignedWeekday] = useState<number | null>(
    initialPost?.assigned_weekday ?? null,
  );
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(initialPost?.tag_ids ?? []);
  const [blocks, setBlocks] = useState<CMSBlock[]>(initialPost?.blocks ?? []);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const dirtyDuringSave = useRef(false);
  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const markUnsaved = useCallback(() => {
    setSaveState((s) => {
      if (s === "saving") {
        dirtyDuringSave.current = true;
        return s;
      }
      return "unsaved";
    });
  }, []);

  const handleSave = useCallback(
    async (overrideStatus?: PostStatus) => {
      if (!title.trim()) {
        if (overrideStatus) toast.error("Add a title before saving.");
        return null;
      }
      dirtyDuringSave.current = false;
      setSaveState("saving");
      const res = await savePost({
        id: postId,
        title: title.trim(),
        excerpt: excerpt?.trim() || null,
        content_json: { type: "doc", content: [] }, // we're not using Tiptap, but keep the column populated
        content_html: "",
        blocks,
        status: overrideStatus ?? status,
        assigned_weekday: assignedWeekday,
        tag_ids: selectedTagIds,
      });
      if (!res.ok) {
        setSaveState("error");
        toast.error(res.error || "Save failed.");
        return null;
      }
      setPostId(res.id);
      setStatus((res.status as PostStatus) ?? status);
      setSaveState(dirtyDuringSave.current ? "unsaved" : "saved");
      setLastSavedAt(new Date());
      if (isNew && res.id) {
        window.history.replaceState(null, "", `/editor/${res.id}`);
      }
      return res;
    },
    [title, excerpt, postId, status, assignedWeekday, selectedTagIds, blocks, isNew],
  );

  // Debounced autosave.
  useEffect(() => {
    if (saveState !== "unsaved") return;
    if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    autosaveTimer.current = setTimeout(() => {
      void handleSave();
    }, AUTOSAVE_MS);
    return () => {
      if (autosaveTimer.current) clearTimeout(autosaveTimer.current);
    };
  }, [saveState, handleSave]);

  const handlePublish = async () => {
    setSubmitting(true);
    const next: PostStatus = requireReview && role === "author" ? "submitted" : "published";
    const res = await handleSave(next);
    setSubmitting(false);
    if (res?.ok) {
      toast.success(next === "published" ? "Published." : "Submitted for review.");
      if (next === "published" && res.slug) router.push(`/blog/${res.slug}`);
      else router.push("/me/posts");
    }
  };

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-4 flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/me/posts">← My posts</Link>
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">
          {saveState === "saving" && (
            <span className="inline-flex items-center gap-1"><Loader2 className="h-3 w-3 animate-spin" /> Saving…</span>
          )}
          {saveState === "saved" && (
            <span className="inline-flex items-center gap-1 text-success">
              <FileCheck2 className="h-3 w-3" /> Saved{" "}
              {lastSavedAt && new Intl.DateTimeFormat(undefined, { hour: "numeric", minute: "2-digit" }).format(lastSavedAt)}
            </span>
          )}
          {saveState === "unsaved" && <span className="text-warning">Unsaved changes</span>}
          {saveState === "error" && <span className="text-destructive">Save failed</span>}
        </span>
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Card className="overflow-hidden">
            <CardContent className="p-5">
              <input
                value={title}
                onChange={(e) => { setTitle(e.target.value); markUnsaved(); }}
                placeholder="Post title"
                className="w-full bg-transparent text-3xl font-bold tracking-tight outline-none placeholder:text-muted-foreground"
                maxLength={160}
              />
              <Textarea
                value={excerpt ?? ""}
                onChange={(e) => { setExcerpt(e.target.value); markUnsaved(); }}
                placeholder="Short summary (used in feed cards and previews)"
                className="mt-3 min-h-[60px] border-none px-0 text-base resize-none focus-visible:ring-0"
                maxLength={500}
              />
            </CardContent>
          </Card>

          <BlockEditor
            value={blocks}
            onChange={(next) => { setBlocks(next); markUnsaved(); }}
          />
        </div>

        <aside className="space-y-4 lg:sticky lg:top-20 lg:self-start">
          <Card>
            <CardHeader><CardTitle className="text-sm">Status</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <div>
                <Badge variant={
                  status === "published" ? "success" :
                  status === "submitted" ? "warning" :
                  status === "scheduled" ? "default" :
                  status === "archived" ? "secondary" : "muted"
                } className="capitalize">{status}</Badge>
              </div>
              <Button onClick={() => handleSave()} variant="outline" className="w-full">
                <Save className="mr-2 h-4 w-4" /> Save draft
              </Button>
              <Button onClick={handlePublish} disabled={submitting} className="w-full">
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                {requireReview && role === "author" ? "Submit for review" : "Publish"}
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-sm">Metadata</CardTitle></CardHeader>
            <CardContent className="space-y-3 text-sm">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Assigned day</span>
                <Select
                  value={assignedWeekday ?? ""}
                  onChange={(e) => {
                    const v = e.target.value === "" ? null : Number(e.target.value);
                    setAssignedWeekday(v);
                    markUnsaved();
                  }}
                >
                  <option value="">Unassigned</option>
                  {[1, 2, 3, 4, 5].map((d) => (
                    <option key={d} value={d}>{weekdayLabel(d)}</option>
                  ))}
                </Select>
              </label>
              <div>
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Tags</span>
                <div className="flex flex-wrap gap-1.5">
                  {tags.map((t) => {
                    const active = selectedTagIds.includes(t.id);
                    return (
                      <button
                        type="button"
                        key={t.id}
                        onClick={() => {
                          setSelectedTagIds((prev) => active ? prev.filter((x) => x !== t.id) : [...prev, t.id]);
                          markUnsaved();
                        }}
                        className={cn(
                          "rounded-md border px-2 py-0.5 text-xs",
                          active
                            ? "border-transparent bg-primary text-primary-foreground"
                            : "bg-secondary text-secondary-foreground hover:bg-secondary/70",
                        )}
                      >
                        {t.name}
                      </button>
                    );
                  })}
                </div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}
