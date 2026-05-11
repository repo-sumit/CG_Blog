"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEditor, EditorContent } from "@tiptap/react";
import { toast } from "sonner";
import { Eye, Save, Send, FileCheck2, Loader2, Sparkles, Image as ImageIcon, Video, Music, Link as LinkIcon } from "lucide-react";
import { editorExtensions } from "@/lib/editor/extensions";
import { WEEKLY_TEMPLATE } from "@/lib/editor/template";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Input, Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { savePost } from "@/app/(app)/editor/actions";
import { wordCount } from "@/lib/utils/read-time";
import { weekdayLabel } from "@/lib/utils/dates";
import { parseEmbedUrl } from "@/lib/utils/embeds";
import { validateFile } from "@/lib/utils/file-validation";
import { publicEnv } from "@/lib/env";
import type { PostRow, PostStatus, TagRow, AppRole } from "@/lib/db/types";
import { cn } from "@/lib/utils/cn";

type SaveState = "idle" | "saving" | "saved" | "unsaved" | "error";

interface Props {
  initialPost?: Partial<PostRow> & {
    tag_ids?: string[];
    content_json?: unknown;
  };
  tags: Pick<TagRow, "id" | "name" | "slug">[];
  role: AppRole;
  requireReview: boolean;
}

const AUTOSAVE_MS = 4000;

export function PostEditor({ initialPost, tags, role, requireReview }: Props) {
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
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [words, setWords] = useState(() => wordCount((initialPost?.excerpt ?? "") + " "));

  const editor = useEditor({
    extensions: editorExtensions(),
    content: (initialPost?.content_json as object) ?? { type: "doc", content: [{ type: "paragraph" }] },
    editorProps: { attributes: { class: "prose max-w-none focus:outline-none" } },
    immediatelyRender: false,
  });

  // Mark unsaved on any edit and refresh the word counter.
  useEffect(() => {
    if (!editor) return;
    const onUpdate = () => {
      setSaveState((s) => (s === "saving" ? s : "unsaved"));
      setWords(wordCount(editor.getText()));
    };
    editor.on("update", onUpdate);
    setWords(wordCount(editor.getText()));
    return () => {
      editor.off("update", onUpdate);
    };
  }, [editor]);

  const autosaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSave = useCallback(
    async (overrideStatus?: PostStatus) => {
      if (!editor) return null;
      if (!title.trim()) {
        if (overrideStatus) toast.error("Add a title before saving.");
        return null;
      }
      setSaveState("saving");
      const json = editor.getJSON();
      const html = editor.getHTML();
      const res = await savePost({
        id: postId,
        title: title.trim(),
        excerpt: excerpt?.trim() || null,
        content_json: json,
        content_html: html,
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
      setSaveState("saved");
      setLastSavedAt(new Date());
      // If we just created the post, switch the URL to /editor/[id] without reloading.
      if (isNew && res.id) {
        window.history.replaceState(null, "", `/editor/${res.id}`);
      }
      return res;
    },
    [editor, title, excerpt, postId, status, assignedWeekday, selectedTagIds, isNew],
  );

  // Autosave loop (debounced via timeout).
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

  const insertTemplate = useCallback(() => {
    if (!editor) return;
    if (
      editor.getText().trim().length > 0 &&
      !window.confirm("Replace the current content with the weekly template?")
    ) {
      return;
    }
    editor.chain().focus().setContent(WEEKLY_TEMPLATE).run();
    setSaveState("unsaved");
  }, [editor]);

  const handleFileInsert = useCallback(
    (kind: "image" | "video" | "audio") => async (file: File) => {
      if (!editor) return;
      const maxBytes = publicEnv.maxUploadMb * 1024 * 1024;
      const v = validateFile({ size: file.size, mime: file.type, maxBytes });
      if (!v.ok) {
        toast.error(v.error || "File rejected.");
        return;
      }
      if (kind === "image" && v.mediaType !== "image") {
        toast.error("Choose an image file.");
        return;
      }
      if (kind === "video" && v.mediaType !== "video") {
        toast.error("Choose a video file.");
        return;
      }
      if (kind === "audio" && v.mediaType !== "audio") {
        toast.error("Choose an audio file.");
        return;
      }

      const form = new FormData();
      form.append("file", file);
      if (postId) form.append("postId", postId);
      const toastId = toast.loading(`Uploading ${file.name}…`);
      try {
        const res = await fetch("/api/media/upload", { method: "POST", body: form });
        if (!res.ok) {
          const text = await res.text();
          throw new Error(text || "Upload failed.");
        }
        const json = (await res.json()) as { signedUrl: string; mediaType: "image" | "video" | "audio" };
        if (json.mediaType === "image") {
          editor.chain().focus().setImage({ src: json.signedUrl, alt: file.name }).run();
        } else if (json.mediaType === "video") {
          editor
            .chain()
            .focus()
            .insertContent(
              `<video controls preload="metadata" src="${json.signedUrl}" style="max-width:100%; border-radius:0.5rem"></video><p></p>`,
            )
            .run();
        } else {
          editor
            .chain()
            .focus()
            .insertContent(`<audio controls src="${json.signedUrl}"></audio><p></p>`)
            .run();
        }
        setSaveState("unsaved");
        toast.success("Inserted.", { id: toastId });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : "Upload failed.";
        toast.error(msg, { id: toastId });
      }
    },
    [editor, postId],
  );

  const handleEmbed = useCallback(() => {
    if (!editor) return;
    const url = window.prompt("Paste a YouTube, Vimeo, Loom, or Google Drive video URL:");
    if (!url) return;
    const info = parseEmbedUrl(url);
    if (!info) {
      toast.error("Unsupported embed URL. Use YouTube, Vimeo, Loom, or Google Drive.");
      return;
    }
    editor
      .chain()
      .focus()
      .insertContent(
        `<div data-embed="${info.provider}" style="position:relative;padding-bottom:56.25%;height:0;overflow:hidden;border-radius:0.75rem"><iframe src="${info.embedUrl}" style="position:absolute;top:0;left:0;width:100%;height:100%;border:0" allow="autoplay; fullscreen; encrypted-media" allowfullscreen loading="lazy"></iframe></div><p></p>`,
      )
      .run();
    setSaveState("unsaved");
  }, [editor]);

  const handlePublish = async () => {
    setSubmitting(true);
    const next: PostStatus = requireReview && role === "author" ? "submitted" : "published";
    const res = await handleSave(next);
    setSubmitting(false);
    if (res?.ok) {
      toast.success(next === "published" ? "Published." : "Submitted for review.");
      if (next === "published" && res.slug) {
        router.push(`/blog/${res.slug}`);
      } else {
        router.push("/me/posts");
      }
    }
  };

  const readMin = Math.max(1, Math.round(words / 220));

  return (
    <div className="container mx-auto px-4 py-6">
      <div className="mb-4 flex items-center gap-2">
        <Button asChild variant="ghost" size="sm">
          <Link href="/me/posts">← My posts</Link>
        </Button>
        <span className="text-xs text-muted-foreground ml-auto">
          {saveState === "saving" && (
            <span className="inline-flex items-center gap-1">
              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
            </span>
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
        <Card className="overflow-hidden">
          {!previewMode && (
            <>
              <EditorToolbar
                editor={editor}
                onInsertImage={() => pickFile("image/*", handleFileInsert("image"))}
                onInsertVideo={() => pickFile("video/*", handleFileInsert("video"))}
                onInsertAudio={() => pickFile("audio/*", handleFileInsert("audio"))}
                onInsertEmbed={handleEmbed}
              />
            </>
          )}
          <CardContent className="p-0">
            <div className="p-5">
              <input
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setSaveState("unsaved");
                }}
                placeholder="Post title"
                className="w-full bg-transparent text-3xl font-bold tracking-tight outline-none placeholder:text-muted-foreground"
                maxLength={160}
              />
              <Textarea
                value={excerpt ?? ""}
                onChange={(e) => {
                  setExcerpt(e.target.value);
                  setSaveState("unsaved");
                }}
                placeholder="Short summary (used in feed cards and previews)"
                className="mt-3 min-h-[60px] border-none px-0 text-base resize-none focus-visible:ring-0"
                maxLength={500}
              />
            </div>
            {previewMode ? (
              <div className="article-body px-5 pb-8">
                <div dangerouslySetInnerHTML={{ __html: editor?.getHTML() ?? "" }} />
              </div>
            ) : (
              <EditorContent editor={editor} />
            )}
            <div className="flex items-center justify-between border-t bg-muted/30 px-5 py-2 text-xs text-muted-foreground">
              <div>{words} words · ~{readMin} min read</div>
              <button
                type="button"
                className="inline-flex items-center gap-1 hover:text-foreground"
                onClick={() => setPreviewMode((v) => !v)}
              >
                <Eye className="h-3.5 w-3.5" /> {previewMode ? "Edit" : "Preview"}
              </button>
            </div>
          </CardContent>
        </Card>

        <aside className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm">Status</CardTitle>
            </CardHeader>
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
            <CardHeader>
              <CardTitle className="text-sm">Metadata</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              <label className="block">
                <span className="mb-1 block text-xs font-medium text-muted-foreground">Assigned day</span>
                <Select
                  value={assignedWeekday ?? ""}
                  onChange={(e) => {
                    const v = e.target.value === "" ? null : Number(e.target.value);
                    setAssignedWeekday(v);
                    setSaveState("unsaved");
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
                          setSelectedTagIds((prev) =>
                            active ? prev.filter((x) => x !== t.id) : [...prev, t.id],
                          );
                          setSaveState("unsaved");
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

          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <Sparkles className="h-4 w-4" /> Quick actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm">
              <Button variant="outline" className="w-full justify-start" onClick={insertTemplate}>
                Use weekly template
              </Button>
              <Button variant="ghost" className="w-full justify-start" onClick={() => pickFile("image/*", handleFileInsert("image"))}>
                <ImageIcon className="mr-2 h-4 w-4" /> Insert image
              </Button>
              <Button variant="ghost" className="w-full justify-start" onClick={() => pickFile("video/*", handleFileInsert("video"))}>
                <Video className="mr-2 h-4 w-4" /> Upload video
              </Button>
              <Button variant="ghost" className="w-full justify-start" onClick={() => pickFile("audio/*", handleFileInsert("audio"))}>
                <Music className="mr-2 h-4 w-4" /> Upload audio
              </Button>
              <Button variant="ghost" className="w-full justify-start" onClick={handleEmbed}>
                <LinkIcon className="mr-2 h-4 w-4" /> Embed external video
              </Button>
            </CardContent>
          </Card>
        </aside>
      </div>
    </div>
  );
}

function pickFile(accept: string, onPick: (file: File) => void) {
  const input = document.createElement("input");
  input.type = "file";
  input.accept = accept;
  input.onchange = () => {
    const file = input.files?.[0];
    if (file) onPick(file);
  };
  input.click();
}
