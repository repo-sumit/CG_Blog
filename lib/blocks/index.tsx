// Server-safe block definitions (Web component + email + plain-text fallbacks).
// All 17 blocks are registered here. Edit + Settings UIs are client-only and
// live in components/blocks/edits.tsx.

import { z } from "zod";
import type {
  CMSBlock,
  ParagraphBlock,
  HeadingBlock,
  PullquoteBlock,
  CalloutBlock,
  ListBlock,
  CodeBlock as CodeBlockT,
  ImageBlock,
  VideoBlock,
  GalleryBlock,
  AudioBlock,
  CTABlock,
  PollBlock,
  SubscribeBlock,
  DividerBlock,
  EmbedBlock,
  AuthorBioBlock,
  SpacerBlock,
  BlockData,
} from "./types";
import { escapeHtml, escapeAttr, headingAnchor, newId } from "./util";
import { parseEmbedUrl } from "@/lib/utils/embeds";
import { registerBlock, type BlockDefinition } from "./registry";

// ---------- shared Zod fragments ----------
const id = z.string().min(1);
const rich = z.string();
const optionalRich = z.string().nullable();
const optionalUrl = z.string().url().nullable();

// ---------- defensive fallback (used by error boundary in renderer) ----------
export function BlockFallback({ children }: { children: React.ReactNode }) {
  return (
    <div className="my-4 rounded-md border border-dashed border-destructive/40 bg-destructive/5 p-3 text-sm text-destructive">
      {children}
    </div>
  );
}

// =============================================================================
// TEXT BLOCKS
// =============================================================================

// ----- Paragraph -----
function ParagraphWeb({ block }: { block: ParagraphBlock }) {
  const { variant, text, dropCap, align } = block.data;
  const cls = [
    variant === "lead" ? "text-lg leading-8" : variant === "small" ? "text-sm leading-6" : "text-base leading-7",
    align === "center" ? "text-center" : align === "right" ? "text-right" : "",
    dropCap
      ? "first-letter:text-5xl first-letter:font-bold first-letter:mr-2 first-letter:float-left first-letter:leading-none"
      : "",
    "my-4 whitespace-pre-wrap",
  ]
    .filter(Boolean)
    .join(" ");
  return <p className={cls}>{text}</p>;
}

const paragraphDef: BlockDefinition<"paragraph"> = {
  type: "paragraph",
  label: "Paragraph",
  group: "text",
  defaultData: () => ({ variant: "body", text: "", dropCap: false, align: "left" }),
  schema: z.object({
    variant: z.enum(["lead", "body", "small"]),
    text: rich,
    dropCap: z.boolean(),
    align: z.enum(["left", "center", "right"]),
  }) as z.ZodType<BlockData<"paragraph">>,
  Web: ParagraphWeb,
  toEmail(block) {
    const { variant, text, align } = block.data;
    const fontSize = variant === "lead" ? 18 : variant === "small" ? 13 : 16;
    return `<p style="margin:16px 0;font-size:${fontSize}px;line-height:1.6;text-align:${align};">${escapeHtml(text)}</p>`;
  },
  toPlainText: (block) => block.data.text,
};

// ----- Heading -----
function HeadingWeb({ block }: { block: HeadingBlock }) {
  const { level, text, anchor, align } = block.data;
  const cls = [
    level === 1 ? "text-4xl font-bold tracking-tight mt-10 mb-4" : level === 2 ? "text-3xl font-semibold mt-8 mb-3" : "text-2xl font-semibold mt-6 mb-2",
    align === "center" ? "text-center" : align === "right" ? "text-right" : "",
  ]
    .filter(Boolean)
    .join(" ");
  const aid = anchor || headingAnchor(text);
  if (level === 1) return <h1 id={aid} className={cls}>{text}</h1>;
  if (level === 2) return <h2 id={aid} className={cls}>{text}</h2>;
  return <h3 id={aid} className={cls}>{text}</h3>;
}

const headingDef: BlockDefinition<"heading"> = {
  type: "heading",
  label: "Heading",
  group: "text",
  defaultData: () => ({ level: 2, text: "", anchor: "", align: "left" }),
  schema: z.object({
    level: z.union([z.literal(1), z.literal(2), z.literal(3)]),
    text: rich,
    anchor: z.string(),
    align: z.enum(["left", "center", "right"]),
  }) as z.ZodType<BlockData<"heading">>,
  Web: HeadingWeb,
  toEmail(block) {
    const { level, text, align } = block.data;
    const size = level === 1 ? 28 : level === 2 ? 22 : 18;
    return `<h${level} style="margin:24px 0 8px;font-size:${size}px;line-height:1.3;text-align:${align};font-weight:600;">${escapeHtml(text)}</h${level}>`;
  },
  toPlainText: (block) => `\n${"#".repeat(block.data.level)} ${block.data.text}\n`,
};

// ----- Pullquote -----
function PullquoteWeb({ block }: { block: PullquoteBlock }) {
  const big = block.data.variant === "large";
  return (
    <blockquote className={`my-8 border-l-4 border-primary pl-6 ${big ? "text-2xl" : "text-lg"} italic`}>
      <p>“{block.data.quote}”</p>
      {block.data.attribution ? (
        <footer className="mt-2 text-sm not-italic text-muted-foreground">— {block.data.attribution}</footer>
      ) : null}
    </blockquote>
  );
}

const pullquoteDef: BlockDefinition<"pullquote"> = {
  type: "pullquote",
  label: "Pullquote",
  group: "text",
  defaultData: () => ({ variant: "default", quote: "", attribution: null }),
  schema: z.object({
    variant: z.enum(["default", "large"]),
    quote: rich,
    attribution: optionalRich,
  }) as z.ZodType<BlockData<"pullquote">>,
  Web: PullquoteWeb,
  toEmail(block) {
    const attr = block.data.attribution ? `<div style="margin-top:8px;font-size:13px;color:#6b7280;">— ${escapeHtml(block.data.attribution)}</div>` : "";
    return `<blockquote style="margin:24px 0;padding-left:16px;border-left:4px solid #3b82f6;font-style:italic;font-size:${block.data.variant === "large" ? 20 : 16}px;">“${escapeHtml(block.data.quote)}”${attr}</blockquote>`;
  },
  toPlainText(block) {
    const attr = block.data.attribution ? ` — ${block.data.attribution}` : "";
    return `\n"${block.data.quote}"${attr}\n`;
  },
};

// ----- Callout -----
const CALLOUT_TONE = {
  info: { bg: "bg-primary/5", border: "border-primary/30", icon: "ℹ", label: "Info", emailBg: "#eff6ff", emailBorder: "#3b82f6" },
  warning: { bg: "bg-warning/10", border: "border-warning/30", icon: "⚠", label: "Warning", emailBg: "#fef3c7", emailBorder: "#f59e0b" },
  tip: { bg: "bg-success/10", border: "border-success/30", icon: "💡", label: "Tip", emailBg: "#dcfce7", emailBorder: "#16a34a" },
  danger: { bg: "bg-destructive/10", border: "border-destructive/40", icon: "⛔", label: "Danger", emailBg: "#fee2e2", emailBorder: "#dc2626" },
} as const;

function CalloutWeb({ block }: { block: CalloutBlock }) {
  const t = CALLOUT_TONE[block.data.tone];
  return (
    <aside className={`my-6 rounded-lg border-l-4 p-4 ${t.bg} ${t.border}`} role="note" aria-label={t.label}>
      <div className="flex gap-3">
        <div className="text-xl leading-none" aria-hidden>{t.icon}</div>
        <div className="flex-1">
          {block.data.heading ? <div className="font-semibold mb-1">{block.data.heading}</div> : null}
          <div className="text-sm leading-6 whitespace-pre-wrap">{block.data.body}</div>
        </div>
      </div>
    </aside>
  );
}

const calloutDef: BlockDefinition<"callout"> = {
  type: "callout",
  label: "Callout",
  group: "text",
  defaultData: () => ({ tone: "info", heading: null, body: "" }),
  schema: z.object({
    tone: z.enum(["info", "warning", "tip", "danger"]),
    heading: optionalRich,
    body: rich,
  }) as z.ZodType<BlockData<"callout">>,
  Web: CalloutWeb,
  toEmail(block) {
    const t = CALLOUT_TONE[block.data.tone];
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:16px 0;width:100%;background:${t.emailBg};border-left:4px solid ${t.emailBorder};"><tr><td style="padding:12px 16px;"><strong style="display:block;margin-bottom:4px;">${t.icon}&nbsp;${escapeHtml(block.data.heading || t.label)}</strong><div style="font-size:14px;line-height:1.6;">${escapeHtml(block.data.body)}</div></td></tr></table>`;
  },
  toPlainText(block) {
    const head = block.data.heading ? `[${block.data.heading}] ` : `[${CALLOUT_TONE[block.data.tone].label}] `;
    return `${head}${block.data.body}\n`;
  },
};

// ----- List -----
function ListWeb({ block }: { block: ListBlock }) {
  if (block.data.variant === "checklist") {
    return (
      <ul className="my-4 space-y-1 list-none pl-0">
        {block.data.items.map((item) => (
          <li key={item.id} className="flex items-start gap-2">
            <span
              aria-hidden
              className={`mt-1 inline-grid h-4 w-4 place-items-center rounded border text-[10px] ${item.checked ? "bg-primary text-primary-foreground border-primary" : "border-input"}`}
            >
              {item.checked ? "✓" : ""}
            </span>
            <span className={item.checked ? "line-through text-muted-foreground" : ""}>{item.text}</span>
          </li>
        ))}
      </ul>
    );
  }
  if (block.data.variant === "numbered") {
    return (
      <ol className="my-4 list-decimal pl-6 space-y-1">
        {block.data.items.map((item) => <li key={item.id}>{item.text}</li>)}
      </ol>
    );
  }
  return (
    <ul className="my-4 list-disc pl-6 space-y-1">
      {block.data.items.map((item) => <li key={item.id}>{item.text}</li>)}
    </ul>
  );
}

const listDef: BlockDefinition<"list"> = {
  type: "list",
  label: "List",
  group: "text",
  defaultData: () => ({ variant: "bullet", items: [{ id: newId(), text: "", checked: false }] }),
  schema: z.object({
    variant: z.enum(["bullet", "numbered", "checklist"]),
    items: z.array(z.object({ id, text: rich, checked: z.boolean() })).min(1),
  }) as z.ZodType<BlockData<"list">>,
  Web: ListWeb,
  toEmail(block) {
    if (block.data.variant === "numbered") {
      return `<ol style="margin:12px 0;padding-left:24px;">${block.data.items.map((i) => `<li style="margin:4px 0;">${escapeHtml(i.text)}</li>`).join("")}</ol>`;
    }
    const marker = (i: { checked: boolean }) => block.data.variant === "checklist" ? (i.checked ? "☑ " : "☐ ") : "";
    return `<ul style="margin:12px 0;padding-left:24px;list-style:${block.data.variant === "checklist" ? "none" : "disc"};">${block.data.items.map((i) => `<li style="margin:4px 0;">${marker(i)}${escapeHtml(i.text)}</li>`).join("")}</ul>`;
  },
  toPlainText(block) {
    return block.data.items.map((i, idx) => {
      if (block.data.variant === "numbered") return `${idx + 1}. ${i.text}`;
      if (block.data.variant === "checklist") return `${i.checked ? "[x]" : "[ ]"} ${i.text}`;
      return `• ${i.text}`;
    }).join("\n");
  },
};

// ----- Code -----
function CodeWeb({ block }: { block: CodeBlockT }) {
  const { variant, language, code } = block.data;
  if (variant === "inline") {
    return <code className="bg-muted px-1.5 py-0.5 rounded text-sm font-mono">{code}</code>;
  }
  return (
    <pre className="my-6 overflow-x-auto rounded-lg bg-muted p-4 text-sm">
      {language ? <div className="mb-2 text-xs uppercase tracking-wide text-muted-foreground">{language}</div> : null}
      <code className="font-mono whitespace-pre">{code}</code>
    </pre>
  );
}

const codeDef: BlockDefinition<"code"> = {
  type: "code",
  label: "Code",
  group: "text",
  defaultData: () => ({ variant: "fenced", language: "", code: "" }),
  schema: z.object({
    variant: z.enum(["inline", "fenced"]),
    language: z.string(),
    code: z.string(),
  }) as z.ZodType<BlockData<"code">>,
  Web: CodeWeb,
  toEmail(block) {
    return `<pre style="margin:16px 0;padding:12px 16px;background:#f3f4f6;border-radius:6px;font-family:Menlo,Consolas,monospace;font-size:13px;overflow-x:auto;white-space:pre;">${escapeHtml(block.data.code)}</pre>`;
  },
  toPlainText(block) {
    return block.data.variant === "inline" ? `\`${block.data.code}\`` : `\n\`\`\`${block.data.language}\n${block.data.code}\n\`\`\`\n`;
  },
};

// =============================================================================
// MEDIA BLOCKS
// =============================================================================

// ----- Image -----
function ImageWeb({ block }: { block: ImageBlock }) {
  const { layout, src, alt, caption, href } = block.data;
  if (!src) return <BlockFallback>Image has no source.</BlockFallback>;
  const wrapperCls =
    layout === "full" ? "my-6 -mx-4 md:-mx-12"
    : layout === "float-left" ? "float-left mr-6 mb-3 max-w-[45%]"
    : layout === "float-right" ? "float-right ml-6 mb-3 max-w-[45%]"
    : "my-6";
  /* eslint-disable-next-line @next/next/no-img-element */
  const img = <img src={src} alt={alt} loading="lazy" className="w-full h-auto rounded-lg" />;
  return (
    <figure className={wrapperCls}>
      {href ? <a href={href} target="_blank" rel="noopener noreferrer">{img}</a> : img}
      {caption ? <figcaption className="mt-2 text-center text-sm text-muted-foreground">{caption}</figcaption> : null}
    </figure>
  );
}

const imageDef: BlockDefinition<"image"> = {
  type: "image",
  label: "Image",
  group: "media",
  defaultData: () => ({ layout: "inset", src: "", alt: "", caption: null, href: null }),
  schema: z.object({
    layout: z.enum(["full", "inset", "float-left", "float-right"]),
    src: z.string().min(1),
    alt: z.string(),
    caption: optionalRich,
    href: optionalUrl,
  }) as z.ZodType<BlockData<"image">>,
  Web: ImageWeb,
  toEmail(block) {
    const img = `<img src="${escapeAttr(block.data.src)}" alt="${escapeAttr(block.data.alt)}" width="600" style="max-width:100%;height:auto;border-radius:8px;display:block;" />`;
    const wrapped = block.data.href ? `<a href="${escapeAttr(block.data.href)}">${img}</a>` : img;
    const cap = block.data.caption ? `<div style="margin-top:6px;font-size:12px;color:#6b7280;text-align:center;">${escapeHtml(block.data.caption)}</div>` : "";
    return `<div style="margin:16px 0;">${wrapped}${cap}</div>`;
  },
  toPlainText(block) {
    const cap = block.data.caption ? ` (${block.data.caption})` : "";
    return `[image: ${block.data.alt || block.data.src}${cap}]`;
  },
};

// ----- Video -----
function VideoWeb({ block }: { block: VideoBlock }) {
  const { provider, url, layout, caption, title } = block.data;
  if (!url) return <BlockFallback>Video has no URL.</BlockFallback>;
  const wrapper = layout === "hero" ? "my-8 -mx-4 md:-mx-12" : "my-6";
  if (provider === "direct") {
    return (
      <figure className={wrapper}>
        {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
        <video controls preload="metadata" src={url} className="w-full rounded-lg" />
        {(title || caption) ? <figcaption className="mt-2 text-center text-sm text-muted-foreground">{title || caption}</figcaption> : null}
      </figure>
    );
  }
  const info = parseEmbedUrl(url);
  if (!info) return <BlockFallback>Unsupported video URL.</BlockFallback>;
  return (
    <figure className={wrapper}>
      <div style={{ position: "relative", paddingBottom: "56.25%", height: 0, overflow: "hidden", borderRadius: "0.75rem" }}>
        <iframe
          src={info.embedUrl}
          title={title || "video"}
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0 }}
          allow="autoplay; fullscreen; encrypted-media"
          allowFullScreen
          loading="lazy"
          referrerPolicy="no-referrer"
        />
      </div>
      {(title || caption) ? <figcaption className="mt-2 text-center text-sm text-muted-foreground">{title || caption}</figcaption> : null}
    </figure>
  );
}

const videoDef: BlockDefinition<"video"> = {
  type: "video",
  label: "Video",
  group: "media",
  defaultData: () => ({ layout: "inline", provider: "youtube", url: "", thumbnail: null, title: null, caption: null }),
  schema: z.object({
    layout: z.enum(["hero", "inline"]),
    provider: z.enum(["youtube", "vimeo", "loom", "direct"]),
    url: z.string().min(1),
    thumbnail: optionalUrl,
    title: optionalRich,
    caption: optionalRich,
  }) as z.ZodType<BlockData<"video">>,
  Web: VideoWeb,
  toEmail(block) {
    const thumb = block.data.thumbnail
      ? `<img src="${escapeAttr(block.data.thumbnail)}" alt="${escapeAttr(block.data.title || "Video")}" width="600" style="max-width:100%;border-radius:8px;display:block;" />`
      : `<div style="background:#111827;color:#fff;padding:48px;text-align:center;border-radius:8px;font-size:24px;">▶ Watch video</div>`;
    return `<div style="margin:16px 0;"><a href="${escapeAttr(block.data.url)}" target="_blank" rel="noopener">${thumb}</a>${block.data.title ? `<div style="margin-top:6px;text-align:center;font-size:14px;">${escapeHtml(block.data.title)}</div>` : ""}</div>`;
  },
  toPlainText(block) {
    return `[video: ${block.data.title || block.data.url}]`;
  },
};

// ----- Gallery -----
function GalleryWeb({ block }: { block: GalleryBlock }) {
  if (block.data.images.length === 0) return <BlockFallback>Gallery is empty.</BlockFallback>;
  const cls = block.data.columns === 2 ? "grid-cols-2" : block.data.columns === 4 ? "grid-cols-2 md:grid-cols-4" : "grid-cols-2 md:grid-cols-3";
  return (
    <div className={`my-6 grid gap-3 ${cls}`}>
      {block.data.images.map((img) => (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img key={img.id} src={img.src} alt={img.alt} loading="lazy" className="w-full h-auto rounded-md" />
      ))}
    </div>
  );
}

const galleryDef: BlockDefinition<"gallery"> = {
  type: "gallery",
  label: "Gallery",
  group: "media",
  defaultData: () => ({ columns: 3, images: [] }),
  schema: z.object({
    columns: z.union([z.literal(2), z.literal(3), z.literal(4)]),
    images: z.array(z.object({ id, src: z.string().min(1), alt: z.string(), caption: optionalRich })),
  }) as z.ZodType<BlockData<"gallery">>,
  Web: GalleryWeb,
  toEmail(block) {
    const rows: string[] = [];
    for (let i = 0; i < block.data.images.length; i += 2) {
      const a = block.data.images[i];
      const b = block.data.images[i + 1];
      if (!a) continue;
      rows.push(`<tr><td width="50%" style="padding:4px;"><img src="${escapeAttr(a.src)}" alt="${escapeAttr(a.alt)}" style="width:100%;border-radius:6px;" /></td><td width="50%" style="padding:4px;">${b ? `<img src="${escapeAttr(b.src)}" alt="${escapeAttr(b.alt)}" style="width:100%;border-radius:6px;" />` : ""}</td></tr>`);
    }
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="width:100%;margin:16px 0;">${rows.join("")}</table>`;
  },
  toPlainText(block) {
    return `[gallery: ${block.data.images.length} images]`;
  },
};

// ----- Audio -----
function AudioWeb({ block }: { block: AudioBlock }) {
  if (!block.data.url) return <BlockFallback>Audio has no URL.</BlockFallback>;
  return (
    <figure className="my-6">
      {block.data.title ? <div className="text-sm font-medium mb-2">{block.data.title}</div> : null}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio controls src={block.data.url} className="w-full" />
      {block.data.caption ? <figcaption className="mt-1 text-xs text-muted-foreground">{block.data.caption}</figcaption> : null}
    </figure>
  );
}

const audioDef: BlockDefinition<"audio"> = {
  type: "audio",
  label: "Audio",
  group: "media",
  defaultData: () => ({ url: "", title: null, durationSeconds: null, caption: null }),
  schema: z.object({
    url: z.string().min(1),
    title: optionalRich,
    durationSeconds: z.number().int().nullable(),
    caption: optionalRich,
  }) as z.ZodType<BlockData<"audio">>,
  Web: AudioWeb,
  toEmail(block) {
    return `<div style="margin:16px 0;padding:12px;background:#f3f4f6;border-radius:8px;"><strong>🎧 ${escapeHtml(block.data.title || "Audio")}</strong><br/><a href="${escapeAttr(block.data.url)}" style="color:#2563eb;">Open audio</a></div>`;
  },
  toPlainText(block) {
    return `[audio: ${block.data.title || block.data.url}]`;
  },
};

// =============================================================================
// ENGAGEMENT BLOCKS
// =============================================================================

// ----- CTA -----
function CTAWeb({ block }: { block: CTABlock }) {
  if (!block.data.buttonHref) return <BlockFallback>CTA button has no URL.</BlockFallback>;
  if (block.data.layout === "button-only") {
    return (
      <div className="my-6 text-center">
        <a href={block.data.buttonHref} className="inline-block rounded-md bg-primary px-5 py-2.5 text-primary-foreground font-medium">
          {block.data.buttonLabel}
        </a>
      </div>
    );
  }
  const cls = block.data.layout === "card" ? "rounded-xl border bg-card p-6 shadow-sm" : "rounded-xl bg-primary/5 p-6";
  return (
    <div className={`my-6 ${cls}`}>
      {block.data.heading ? <h3 className="text-xl font-semibold">{block.data.heading}</h3> : null}
      {block.data.subtext ? <p className="mt-1 text-sm text-muted-foreground">{block.data.subtext}</p> : null}
      <a href={block.data.buttonHref} className="mt-4 inline-block rounded-md bg-primary px-4 py-2 text-primary-foreground font-medium">
        {block.data.buttonLabel}
      </a>
    </div>
  );
}

const ctaDef: BlockDefinition<"cta"> = {
  type: "cta",
  label: "Call-to-action",
  group: "engagement",
  defaultData: () => ({ layout: "banner", heading: null, subtext: null, buttonLabel: "Learn more", buttonHref: "" }),
  schema: z.object({
    layout: z.enum(["banner", "button-only", "card"]),
    heading: optionalRich,
    subtext: optionalRich,
    buttonLabel: rich,
    buttonHref: z.string().min(1),
  }) as z.ZodType<BlockData<"cta">>,
  Web: CTAWeb,
  toEmail(block) {
    const head = block.data.heading ? `<h3 style="margin:0 0 4px;font-size:18px;">${escapeHtml(block.data.heading)}</h3>` : "";
    const sub = block.data.subtext ? `<p style="margin:0 0 12px;font-size:14px;color:#4b5563;">${escapeHtml(block.data.subtext)}</p>` : "";
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px auto;text-align:center;"><tr><td style="padding:16px 20px;background:#eff6ff;border-radius:12px;">${head}${sub}<a href="${escapeAttr(block.data.buttonHref)}" style="display:inline-block;padding:10px 20px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:6px;font-weight:600;">${escapeHtml(block.data.buttonLabel)}</a></td></tr></table>`;
  },
  toPlainText(block) {
    return `[CTA: ${block.data.heading || ""} → ${block.data.buttonHref}]`;
  },
};

// ----- Poll -----
function PollWeb({ block }: { block: PollBlock }) {
  return (
    <div className="my-6 rounded-lg border p-4">
      <div className="font-semibold mb-2">📊 {block.data.question}</div>
      <ul className="space-y-1.5 list-none pl-0">
        {block.data.options.map((o) => (
          <li key={o.id} className="rounded border px-3 py-2 text-sm">{o.label}</li>
        ))}
      </ul>
      {block.data.externalUrl ? (
        <a href={block.data.externalUrl} className="mt-3 inline-block text-sm text-primary hover:underline" target="_blank" rel="noopener noreferrer">
          Vote in the live poll →
        </a>
      ) : (
        <div className="mt-3 text-xs text-muted-foreground">
          Votes are not collected here — share results in a follow-up post or link to an external poll.
        </div>
      )}
    </div>
  );
}

const pollDef: BlockDefinition<"poll"> = {
  type: "poll",
  label: "Poll",
  group: "engagement",
  defaultData: () => ({
    mode: "single",
    question: "",
    options: [{ id: newId(), label: "" }, { id: newId(), label: "" }],
    showResults: false,
    externalUrl: null,
  }),
  schema: z.object({
    mode: z.enum(["single", "multi"]),
    question: rich,
    options: z.array(z.object({ id, label: rich })).min(2),
    showResults: z.boolean(),
    externalUrl: optionalUrl,
  }) as z.ZodType<BlockData<"poll">>,
  Web: PollWeb,
  toEmail(block) {
    const opts = block.data.options.map((o) => `<li style="margin:4px 0;">${escapeHtml(o.label)}</li>`).join("");
    const link = block.data.externalUrl
      ? `<a href="${escapeAttr(block.data.externalUrl)}" style="display:inline-block;margin-top:8px;color:#2563eb;">Vote →</a>`
      : "";
    return `<div style="margin:16px 0;padding:12px;border:1px solid #e5e7eb;border-radius:8px;"><strong>📊 ${escapeHtml(block.data.question)}</strong><ul>${opts}</ul>${link}</div>`;
  },
  toPlainText(block) {
    return `[Poll] ${block.data.question}\n${block.data.options.map((o, i) => `  ${i + 1}. ${o.label}`).join("\n")}`;
  },
};

// ----- Subscribe -----
function SubscribeWeb({ block }: { block: SubscribeBlock }) {
  const cls = block.data.layout === "full-card" ? "rounded-xl border p-6" : "rounded-lg bg-muted/50 p-4";
  return (
    <div className={`my-6 ${cls}`}>
      <div className="font-semibold mb-3">{block.data.heading}</div>
      {block.data.externalUrl ? (
        <a href={block.data.externalUrl} target="_blank" rel="noopener noreferrer" className="inline-block rounded-md bg-primary px-4 py-2 text-primary-foreground">
          {block.data.buttonLabel}
        </a>
      ) : (
        <div className="flex gap-2">
          <span className="flex-1 rounded-md border px-3 py-2 text-sm text-muted-foreground bg-background">
            {block.data.placeholder}
          </span>
          <span className="rounded-md bg-primary/60 px-3 py-2 text-sm text-primary-foreground">
            {block.data.buttonLabel}
          </span>
          <span className="self-center text-xs text-muted-foreground italic">(disabled — no backend)</span>
        </div>
      )}
    </div>
  );
}

const subscribeDef: BlockDefinition<"subscribe"> = {
  type: "subscribe",
  label: "Subscribe",
  group: "engagement",
  defaultData: () => ({
    layout: "minimal",
    heading: "Stay in the loop",
    placeholder: "you@convegenius.ai",
    buttonLabel: "Follow author",
    externalUrl: null,
  }),
  schema: z.object({
    layout: z.enum(["minimal", "full-card"]),
    heading: rich,
    placeholder: rich,
    buttonLabel: rich,
    externalUrl: optionalUrl,
  }) as z.ZodType<BlockData<"subscribe">>,
  Web: SubscribeWeb,
  toEmail(block) {
    if (block.data.externalUrl) {
      return `<table role="presentation" style="margin:24px auto;"><tr><td style="padding:12px;text-align:center;"><strong>${escapeHtml(block.data.heading)}</strong><br/><a href="${escapeAttr(block.data.externalUrl)}" style="display:inline-block;margin-top:8px;padding:10px 18px;background:#3b82f6;color:#fff;text-decoration:none;border-radius:6px;">${escapeHtml(block.data.buttonLabel)}</a></td></tr></table>`;
    }
    return `<p style="margin:16px 0;font-size:14px;color:#6b7280;text-align:center;">${escapeHtml(block.data.heading)}</p>`;
  },
  toPlainText(block) {
    return `[Subscribe: ${block.data.heading}]`;
  },
};

// =============================================================================
// STRUCTURE BLOCKS
// =============================================================================

// ----- Divider -----
function DividerWeb({ block }: { block: DividerBlock }) {
  if (block.data.variant === "dots") {
    return <div className="my-8 text-center text-muted-foreground tracking-widest" aria-hidden>· · ·</div>;
  }
  if (block.data.variant === "section-label") {
    return (
      <div className="my-10 flex items-center gap-4 text-xs uppercase tracking-widest text-muted-foreground">
        <div className="h-px flex-1 bg-border" />
        <span>{block.data.label || "Section"}</span>
        <div className="h-px flex-1 bg-border" />
      </div>
    );
  }
  return <hr className="my-8 border-t" />;
}

const dividerDef: BlockDefinition<"divider"> = {
  type: "divider",
  label: "Divider",
  group: "structure",
  defaultData: () => ({ variant: "line", label: null }),
  schema: z.object({
    variant: z.enum(["line", "dots", "section-label"]),
    label: optionalRich,
  }) as z.ZodType<BlockData<"divider">>,
  Web: DividerWeb,
  toEmail(block) {
    if (block.data.variant === "dots") return `<p style="text-align:center;color:#9ca3af;letter-spacing:0.3em;margin:24px 0;">· · ·</p>`;
    if (block.data.variant === "section-label") return `<p style="text-align:center;color:#9ca3af;text-transform:uppercase;letter-spacing:0.15em;font-size:12px;margin:32px 0;">${escapeHtml(block.data.label || "Section")}</p>`;
    return `<hr style="border:none;border-top:1px solid #e5e7eb;margin:24px 0;" />`;
  },
  toPlainText(block) {
    return block.data.variant === "section-label" ? `\n--- ${block.data.label || "Section"} ---\n` : `\n---\n`;
  },
};

// ----- Embed -----
function isAllowlistedIframe(rawUrl: string): string | null {
  try {
    const u = new URL(rawUrl);
    const host = u.hostname.toLowerCase();
    if (host === "datawrapper.dwcdn.net") return rawUrl;
    if (host.endsWith(".notion.site")) return rawUrl;
    return null;
  } catch {
    return null;
  }
}

function EmbedWeb({ block }: { block: EmbedBlock }) {
  const iframeUrl = isAllowlistedIframe(block.data.url);
  if (!iframeUrl) {
    // Fallback: link card — never embed unknown providers as iframes.
    return (
      <a href={block.data.url} target="_blank" rel="noopener noreferrer" className="my-6 block rounded-lg border p-4 hover:bg-muted/50">
        <div className="text-xs uppercase tracking-wide text-muted-foreground">{block.data.provider}</div>
        <div className="mt-1 font-medium">{block.data.title || block.data.url}</div>
      </a>
    );
  }
  return (
    <div className="my-6">
      <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
        <iframe
          src={iframeUrl}
          title={block.data.title || block.data.provider}
          style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: 0, borderRadius: "0.5rem" }}
          allow="encrypted-media"
          referrerPolicy="no-referrer"
          loading="lazy"
          sandbox="allow-scripts allow-same-origin allow-popups"
        />
      </div>
    </div>
  );
}

const embedDef: BlockDefinition<"embed"> = {
  type: "embed",
  label: "Embed",
  group: "structure",
  defaultData: () => ({ provider: "generic", url: "", title: null }),
  schema: z.object({
    provider: z.enum(["twitter", "notion", "datawrapper", "generic"]),
    url: z.string().url(),
    title: optionalRich,
  }) as z.ZodType<BlockData<"embed">>,
  Web: EmbedWeb,
  toEmail(block) {
    return `<a href="${escapeAttr(block.data.url)}" style="display:block;margin:16px 0;padding:12px;border:1px solid #e5e7eb;border-radius:8px;text-decoration:none;color:#111;"><div style="font-size:12px;color:#6b7280;text-transform:uppercase;">${escapeHtml(block.data.provider)}</div><div style="margin-top:4px;font-weight:600;">${escapeHtml(block.data.title || block.data.url)}</div></a>`;
  },
  toPlainText(block) {
    return `[${block.data.provider} embed: ${block.data.title || block.data.url}]`;
  },
};

// ----- Author bio -----
function AuthorBioWeb({ block }: { block: AuthorBioBlock }) {
  return (
    <div className="my-8 flex items-start gap-4 rounded-xl border p-4">
      {block.data.avatarUrl ? (
        /* eslint-disable-next-line @next/next/no-img-element */
        <img src={block.data.avatarUrl} alt={block.data.name} className="h-12 w-12 rounded-full object-cover" />
      ) : (
        <div className="h-12 w-12 rounded-full bg-primary/10 grid place-items-center font-semibold text-primary">
          {block.data.name.slice(0, 1).toUpperCase() || "?"}
        </div>
      )}
      <div className="flex-1">
        <div className="font-semibold">{block.data.name}</div>
        {block.data.role ? <div className="text-xs text-muted-foreground">{block.data.role}</div> : null}
        {block.data.layout === "full" && block.data.bio ? <p className="mt-2 text-sm leading-6">{block.data.bio}</p> : null}
        {block.data.socials.length > 0 ? (
          <div className="mt-2 flex gap-3 text-sm">
            {block.data.socials.map((s) => (
              <a key={s.id} href={s.href} className="text-primary hover:underline" target="_blank" rel="noopener noreferrer">
                {s.label}
              </a>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}

const authorBioDef: BlockDefinition<"author-bio"> = {
  type: "author-bio",
  label: "Author bio",
  group: "structure",
  defaultData: () => ({ layout: "compact", avatarUrl: null, name: "", role: null, bio: null, socials: [] }),
  schema: z.object({
    layout: z.enum(["compact", "full"]),
    avatarUrl: optionalUrl,
    name: rich,
    role: optionalRich,
    bio: optionalRich,
    socials: z.array(z.object({ id, label: rich, href: z.string().url() })),
  }) as z.ZodType<BlockData<"author-bio">>,
  Web: AuthorBioWeb,
  toEmail(block) {
    return `<table role="presentation" style="margin:24px 0;width:100%;"><tr><td style="padding:12px;border:1px solid #e5e7eb;border-radius:8px;"><strong>${escapeHtml(block.data.name)}</strong>${block.data.role ? `<br/><span style="font-size:12px;color:#6b7280;">${escapeHtml(block.data.role)}</span>` : ""}${block.data.bio ? `<p style="margin:8px 0 0;font-size:13px;line-height:1.5;">${escapeHtml(block.data.bio)}</p>` : ""}</td></tr></table>`;
  },
  toPlainText(block) {
    return `\n— ${block.data.name}${block.data.role ? `, ${block.data.role}` : ""}\n`;
  },
};

// ----- Spacer -----
const SPACER_HEIGHTS = { xs: 8, s: 16, m: 32, l: 56 } as const;

function SpacerWeb({ block }: { block: SpacerBlock }) {
  return <div style={{ height: SPACER_HEIGHTS[block.data.size] }} aria-hidden />;
}

const spacerDef: BlockDefinition<"spacer"> = {
  type: "spacer",
  label: "Spacer",
  group: "structure",
  defaultData: () => ({ size: "m" }),
  schema: z.object({ size: z.enum(["xs", "s", "m", "l"]) }) as z.ZodType<BlockData<"spacer">>,
  Web: SpacerWeb,
  toEmail(block) {
    const h = SPACER_HEIGHTS[block.data.size];
    return `<div style="height:${h}px;line-height:${h}px;font-size:1px;">&nbsp;</div>`;
  },
  toPlainText: () => "\n",
};

// =============================================================================
// Register everything
// =============================================================================
registerBlock(paragraphDef);
registerBlock(headingDef);
registerBlock(pullquoteDef);
registerBlock(calloutDef);
registerBlock(listDef);
registerBlock(codeDef);
registerBlock(imageDef);
registerBlock(videoDef);
registerBlock(galleryDef);
registerBlock(audioDef);
registerBlock(ctaDef);
registerBlock(pollDef);
registerBlock(subscribeDef);
registerBlock(dividerDef);
registerBlock(embedDef);
registerBlock(authorBioDef);
registerBlock(spacerDef);

// Discriminated-union schema for the whole blocks array. Use this when
// validating savePost payloads from the editor.
export const BlocksArraySchema = z.array(
  z.discriminatedUnion("type", [
    z.object({ id, type: z.literal("paragraph"), data: paragraphDef.schema }),
    z.object({ id, type: z.literal("heading"), data: headingDef.schema }),
    z.object({ id, type: z.literal("pullquote"), data: pullquoteDef.schema }),
    z.object({ id, type: z.literal("callout"), data: calloutDef.schema }),
    z.object({ id, type: z.literal("list"), data: listDef.schema }),
    z.object({ id, type: z.literal("code"), data: codeDef.schema }),
    z.object({ id, type: z.literal("image"), data: imageDef.schema }),
    z.object({ id, type: z.literal("video"), data: videoDef.schema }),
    z.object({ id, type: z.literal("gallery"), data: galleryDef.schema }),
    z.object({ id, type: z.literal("audio"), data: audioDef.schema }),
    z.object({ id, type: z.literal("cta"), data: ctaDef.schema }),
    z.object({ id, type: z.literal("poll"), data: pollDef.schema }),
    z.object({ id, type: z.literal("subscribe"), data: subscribeDef.schema }),
    z.object({ id, type: z.literal("divider"), data: dividerDef.schema }),
    z.object({ id, type: z.literal("embed"), data: embedDef.schema }),
    z.object({ id, type: z.literal("author-bio"), data: authorBioDef.schema }),
    z.object({ id, type: z.literal("spacer"), data: spacerDef.schema }),
  ]),
) as z.ZodType<CMSBlock[]>;
