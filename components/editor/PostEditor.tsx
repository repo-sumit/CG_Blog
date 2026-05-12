"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { useEditor, EditorContent } from "@tiptap/react";
import { toast } from "sonner";
import {
  Eye, Save, Send, FileCheck2, Loader2, Sparkles,
  Image as ImageIcon, Video, Music, Link as LinkIcon,
  Upload, X, Check,
} from "lucide-react";
import { editorExtensions } from "@/lib/editor/extensions";
import { WEEKLY_TEMPLATE } from "@/lib/editor/template";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Badge } from "@/components/ui/Badge";
import { Select } from "@/components/ui/Select";
import { EditorToolbar } from "@/components/editor/EditorToolbar";
import { savePost } from "@/app/(app)/editor/actions";
import { wordCount } from "@/lib/utils/read-time";
import { formatScheduledLabel, weekdayLabel } from "@/lib/utils/dates";
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
    /** Pre-resolved cover image — `url` points at /api/media/file. */
    cover?: { id: string; url: string } | null;
  };
  tags: Pick<TagRow, "id" | "name" | "slug">[];
  role: AppRole;
  requireReview: boolean;
}

interface PostImage {
  id: string;
  url: string;
  title?: string | null;
}

const AUTOSAVE_MS = 4000;

export function PostEditor({ initialPost, tags, role, requireReview }: Props) {
  const router = useRouter();
  const isNew = !initialPost?.id;

  const initialTitle = initialPost?.title === "Untitled draft" ? "" : (initialPost?.title ?? "");

  const [postId, setPostId] = useState<string | undefined>(initialPost?.id);
  const [title, setTitle] = useState(initialTitle);
  const [titleTouched, setTitleTouched] = useState(initialTitle.trim().length > 0);
  const [excerpt, setExcerpt] = useState(initialPost?.excerpt ?? "");
  const [status, setStatus] = useState<PostStatus>((initialPost?.status as PostStatus) ?? "draft");
  const [scheduledFor, setScheduledFor] = useState<string | null>(initialPost?.scheduled_for ?? null);
  const [assignedWeekday, setAssignedWeekday] = useState<number | null>(
    initialPost?.assigned_weekday ?? null,
  );
  const [selectedTagIds, setSelectedTagIds] = useState<string[]>(initialPost?.tag_ids ?? []);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [lastSavedAt, setLastSavedAt] = useState<Date | null>(null);
  const [previewMode, setPreviewMode] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [words, setWords] = useState(() => wordCount((initialPost?.excerpt ?? "") + " "));
  const [coverMediaId, setCoverMediaId] = useState<string | null>(initialPost?.cover?.id ?? null);
  const [coverUrl, setCoverUrl] = useState<string | null>(initialPost?.cover?.url ?? null);
  const [coverBrowserOpen, setCoverBrowserOpen] = useState(false);
  const [postImages, setPostImages] = useState<PostImage[]>([]);
  const [coverBrowserLoading, setCoverBrowserLoading] = useState(false);
  const [coverUploading, setCoverUploading] = useState(false);

  const titleEmpty = title.trim().length === 0;
  const titleInvalid = titleEmpty && titleTouched;

  const editor = useEditor({
    extensions: editorExtensions(),
    content: (initialPost?.content_json as object) ?? { type: "doc", content: [{ type: "paragraph" }] },
    editorProps: { attributes: { class: "prose max-w-none focus:outline-none" } },
    immediatelyRender: false,
  });

  // Track whether the user edited during an in-flight save. If so, we must NOT
  // overwrite the post-save state with "saved" — the editor content has diverged
  // from what we just persisted, so mark "unsaved" to trigger another autosave.
  const dirtyDuringSave = useRef(false);

  // Mark unsaved on any edit and refresh the word counter.
  useEffect(() => {
    if (!editor) return;
    const onUpdate = () => {
      setSaveState((s) => {
        if (s === "saving") {
          dirtyDuringSave.current = true;
          return s;
        }
        return "unsaved";
      });
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
      // Title is required for anything beyond a draft. Drafts may save with
      // an empty title (autosave keeps running while the user is still typing
      // a title or the body).
      const promotingBeyondDraft = (overrideStatus ?? status) !== "draft";
      if (promotingBeyondDraft && !title.trim()) {
        setTitleTouched(true);
        toast.error("Add a title before publishing.");
        return null;
      }
      dirtyDuringSave.current = false;
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
        cover_media_id: coverMediaId,
        tag_ids: selectedTagIds,
      });
      if (!res.ok) {
        setSaveState("error");
        toast.error(res.error || "Save failed.");
        return null;
      }
      setPostId(res.id);
      setStatus((res.status as PostStatus) ?? status);
      if (res.scheduledFor !== undefined) setScheduledFor(res.scheduledFor);
      // If the user typed during the await, keep state "unsaved" so the
      // autosave effect schedules another save.
      setSaveState(dirtyDuringSave.current ? "unsaved" : "saved");
      setLastSavedAt(new Date());
      // If we just created the post, switch the URL to /editor/[id] without reloading.
      if (isNew && res.id) {
        window.history.replaceState(null, "", `/editor/${res.id}`);
      }
      return res;
    },
    [editor, title, excerpt, postId, status, assignedWeekday, coverMediaId, selectedTagIds, isNew],
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
    const requested: PostStatus = requireReview && role === "author" ? "submitted" : "published";
    const res = await handleSave(requested);
    setSubmitting(false);
    if (!res?.ok) return;
    const final = (res.status as PostStatus) ?? requested;
    if (final === "scheduled" && res.scheduledFor) {
      toast.success(`Scheduled for ${formatScheduledLabel(res.scheduledFor)}.`);
      router.push("/me/posts");
    } else if (final === "submitted") {
      toast.success("Submitted for review.");
      router.push("/me/posts");
    } else if (final === "published" && res.slug) {
      toast.success("Published.");
      router.push(`/posts/${res.slug}`);
    } else {
      router.push("/me/posts");
    }
  };

  const publishLabel = useMemo(() => {
    if (requireReview && role === "author") return "Submit for review";
    return "Publish";
  }, [requireReview, role]);

  // Thumbnail picker handlers.
  const openCoverBrowser = useCallback(async () => {
    setCoverBrowserOpen(true);
    if (!postId) return;
    setCoverBrowserLoading(true);
    try {
      const res = await fetch(`/api/media/list?postId=${postId}`);
      if (!res.ok) throw new Error(await res.text());
      const data = (await res.json()) as { images?: PostImage[] };
      setPostImages(data.images ?? []);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to load images.";
      toast.error(msg);
    } finally {
      setCoverBrowserLoading(false);
    }
  }, [postId]);

  const selectCover = useCallback((img: PostImage) => {
    setCoverMediaId(img.id);
    setCoverUrl(img.url);
    setCoverBrowserOpen(false);
    setSaveState("unsaved");
  }, []);

  const clearCover = useCallback(() => {
    setCoverMediaId(null);
    setCoverUrl(null);
    setSaveState("unsaved");
  }, []);

  const uploadCover = useCallback(
    async (file: File) => {
      const maxBytes = publicEnv.maxUploadMb * 1024 * 1024;
      const v = validateFile({ size: file.size, mime: file.type, maxBytes });
      if (!v.ok) {
        toast.error(v.error || "File rejected.");
        return;
      }
      if (v.mediaType !== "image") {
        toast.error("Choose an image file.");
        return;
      }
      setCoverUploading(true);
      const form = new FormData();
      form.append("file", file);
      if (postId) form.append("postId", postId);
      const toastId = toast.loading(`Uploading ${file.name}…`);
      try {
        const res = await fetch("/api/media/upload", { method: "POST", body: form });
        if (!res.ok) throw new Error(await res.text());
        const json = (await res.json()) as { mediaId?: string | null; signedUrl?: string };
        if (!json.mediaId || !json.signedUrl) throw new Error("Upload did not return a media id.");
        setCoverMediaId(json.mediaId);
        setCoverUrl(json.signedUrl);
        setSaveState("unsaved");
        toast.success("Thumbnail set.", { id: toastId });
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Upload failed.";
        toast.error(msg, { id: toastId });
      } finally {
        setCoverUploading(false);
      }
    },
    [postId],
  );

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
              <label className="block">
                <span className="mb-1 flex items-center gap-1 text-[10px] uppercase tracking-wider text-portal-text-muted">
                  Title
                  <span aria-hidden className="text-portal-red">*</span>
                  <span className="sr-only"> (required)</span>
                </span>
                <input
                  value={title}
                  onChange={(e) => {
                    setTitle(e.target.value);
                    if (!titleTouched) setTitleTouched(true);
                    setSaveState("unsaved");
                  }}
                  onBlur={() => setTitleTouched(true)}
                  placeholder="Give your transmission a title…"
                  aria-required="true"
                  aria-invalid={titleInvalid || undefined}
                  className={cn(
                    "w-full bg-transparent text-3xl font-bold tracking-tight outline-none placeholder:text-muted-foreground",
                    "border-b-2 pb-1 transition-colors",
                    titleInvalid
                      ? "border-portal-red"
                      : "border-portal-border-soft focus:border-portal-blue",
                  )}
                  maxLength={160}
                />
                {titleInvalid && (
                  <span className="mt-1 block text-[11px] font-medium text-portal-red">
                    Title is required.
                  </span>
                )}
              </label>
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
              {status === "scheduled" && scheduledFor && (
                <div className="rounded-md border border-portal-border-soft bg-portal-panel-soft p-3 text-xs">
                  <div className="text-[10px] uppercase tracking-wider text-portal-text-muted">
                    Goes live
                  </div>
                  <div className="mt-1 font-ui text-portal-text">
                    {formatScheduledLabel(scheduledFor)}
                  </div>
                  <div className="mt-1 text-[10px] text-portal-text-muted">
                    You can keep editing — changes will be visible the moment the slot hits.
                  </div>
                </div>
              )}
              <Button onClick={() => handleSave()} variant="outline" className="w-full">
                <Save className="mr-2 h-4 w-4" /> Save draft
              </Button>
              <Button
                onClick={handlePublish}
                disabled={submitting || titleEmpty}
                title={titleEmpty ? "Add a title first" : undefined}
                className="w-full"
              >
                {submitting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Send className="mr-2 h-4 w-4" />}
                {publishLabel}
              </Button>
              {assignedWeekday && !titleEmpty && status !== "scheduled" && (
                <p className="text-[10px] leading-relaxed text-portal-text-muted">
                  Publishes on your assigned day ({weekdayLabel(assignedWeekday)}). If that day
                  hasn't arrived yet, the post will be scheduled and auto-released then.
                </p>
              )}
            </CardContent>
          </Card>

          {/* Thumbnail picker — fulfills the "upload or pick from inserted images" UX */}
          <Card>
            <CardHeader>
              <CardTitle className="text-sm flex items-center gap-2">
                <ImageIcon className="h-4 w-4" /> Thumbnail
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3 text-sm">
              {coverUrl ? (
                <div className="relative overflow-hidden rounded-md border border-portal-border-soft bg-portal-panel-soft">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={coverUrl}
                    alt="Thumbnail preview"
                    className="aspect-video w-full object-cover"
                  />
                  <button
                    type="button"
                    onClick={clearCover}
                    aria-label="Remove thumbnail"
                    className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-portal-panel/90 text-portal-text hover:bg-portal-panel"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="flex aspect-video items-center justify-center rounded-md border-2 border-dashed border-portal-border-soft bg-portal-panel-soft text-center text-xs text-portal-text-muted">
                  <span>
                    No thumbnail yet.<br />Pick one to feature this post.
                  </span>
                </div>
              )}
              <div className="grid grid-cols-2 gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={openCoverBrowser}
                  disabled={!postId}
                  title={postId ? undefined : "Save the draft once so we can list its images."}
                >
                  <ImageIcon className="mr-1.5 h-3.5 w-3.5" /> From post
                </Button>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => pickFile("image/*", uploadCover)}
                  disabled={coverUploading}
                >
                  {coverUploading ? (
                    <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Upload className="mr-1.5 h-3.5 w-3.5" />
                  )}
                  Upload
                </Button>
              </div>
              {!postId && (
                <p className="text-[10px] leading-relaxed text-portal-text-muted">
                  Tip: type a title and the post auto-saves — you'll then be able to pick a
                  thumbnail from any image you've inserted in the body.
                </p>
              )}

              {coverBrowserOpen && (
                <div className="rounded-md border border-portal-border-soft bg-portal-panel-soft p-2">
                  <div className="mb-2 flex items-center justify-between">
                    <div className="text-[10px] uppercase tracking-wider text-portal-text-muted">
                      Images in this post
                    </div>
                    <button
                      type="button"
                      onClick={() => setCoverBrowserOpen(false)}
                      className="text-[10px] text-portal-text-muted hover:text-portal-text"
                    >
                      Close
                    </button>
                  </div>
                  {coverBrowserLoading ? (
                    <div className="flex items-center justify-center py-6 text-portal-text-muted">
                      <Loader2 className="h-4 w-4 animate-spin" />
                    </div>
                  ) : postImages.length === 0 ? (
                    <div className="py-4 text-center text-xs text-portal-text-muted">
                      No images uploaded to this post yet. Insert one in the editor body or
                      use Upload above.
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-1.5">
                      {postImages.map((img) => {
                        const active = img.id === coverMediaId;
                        return (
                          <button
                            type="button"
                            key={img.id}
                            onClick={() => selectCover(img)}
                            className={cn(
                              "group relative overflow-hidden rounded border-2 bg-portal-panel transition-colors",
                              active
                                ? "border-portal-blue"
                                : "border-transparent hover:border-portal-border-muted",
                            )}
                            aria-label={`Use ${img.title ?? "image"} as thumbnail`}
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={img.url}
                              alt={img.title ?? ""}
                              className="aspect-square w-full object-cover"
                              loading="lazy"
                            />
                            {active && (
                              <span className="absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full bg-portal-blue text-white">
                                <Check className="h-3 w-3" />
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
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
