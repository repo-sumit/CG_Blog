// Block-based CMS — strongly-typed discriminated union for post content.
//
// Every block:
//   - Has a unique `id` (so React keys and reorder operations are stable).
//   - Has a `type` (the discriminator).
//   - Has a `data` payload whose shape is uniquely determined by `type`.
//
// Each block kind lives in its own module under `lib/blocks/types/<name>.ts`,
// where the type, Zod schema, default, web renderer, email renderer, and
// plain-text fallback are co-located.

// ---------- common ----------

export interface BlockId {
  /** Stable, client-generated id (crypto.randomUUID). Survives reorder. */
  id: string;
}

export type RichText = string; // Single-line or short multi-line text. No raw HTML.

export type Alignment = "left" | "center" | "right";

// ---------- text blocks ----------

export interface ParagraphBlock extends BlockId {
  type: "paragraph";
  data: {
    variant: "lead" | "body" | "small";
    text: RichText;
    dropCap: boolean;
    align: Alignment;
  };
}

export interface HeadingBlock extends BlockId {
  type: "heading";
  data: {
    level: 1 | 2 | 3;
    text: RichText;
    anchor: string; // auto-generated slug, manually overridable
    align: Alignment;
  };
}

export interface PullquoteBlock extends BlockId {
  type: "pullquote";
  data: {
    variant: "default" | "large";
    quote: RichText;
    attribution: RichText | null;
  };
}

export interface CalloutBlock extends BlockId {
  type: "callout";
  data: {
    tone: "info" | "warning" | "tip" | "danger";
    heading: RichText | null;
    body: RichText;
  };
}

export interface ListBlock extends BlockId {
  type: "list";
  data: {
    variant: "bullet" | "numbered" | "checklist";
    items: { id: string; text: RichText; checked: boolean }[];
  };
}

export interface CodeBlock extends BlockId {
  type: "code";
  data: {
    variant: "inline" | "fenced";
    language: string; // e.g. "ts", "py", "bash", or "" for plain
    code: string;
  };
}

// ---------- media blocks ----------

export interface ImageBlock extends BlockId {
  type: "image";
  data: {
    layout: "full" | "inset" | "float-left" | "float-right";
    src: string; // stable /api/media/file?path=... URL, or external https URL
    alt: string;
    caption: RichText | null;
    href: string | null; // optional click-through
  };
}

export interface VideoBlock extends BlockId {
  type: "video";
  data: {
    layout: "hero" | "inline";
    provider: "youtube" | "vimeo" | "loom" | "direct";
    url: string; // canonical embed URL or direct file
    thumbnail: string | null;
    title: RichText | null;
    caption: RichText | null;
  };
}

export interface GalleryBlock extends BlockId {
  type: "gallery";
  data: {
    columns: 2 | 3 | 4;
    images: { id: string; src: string; alt: string; caption: RichText | null }[];
  };
}

export interface AudioBlock extends BlockId {
  type: "audio";
  data: {
    url: string;
    title: RichText | null;
    durationSeconds: number | null;
    caption: RichText | null;
  };
}

// ---------- engagement blocks ----------

export interface CTABlock extends BlockId {
  type: "cta";
  data: {
    layout: "banner" | "button-only" | "card";
    heading: RichText | null;
    subtext: RichText | null;
    buttonLabel: RichText;
    buttonHref: string;
  };
}

export interface PollBlock extends BlockId {
  type: "poll";
  data: {
    mode: "single" | "multi";
    question: RichText;
    options: { id: string; label: RichText }[];
    showResults: boolean;
    externalUrl: string | null; // we DO NOT have a backend for votes — link out
  };
}

export interface SubscribeBlock extends BlockId {
  type: "subscribe";
  data: {
    layout: "minimal" | "full-card";
    heading: RichText;
    placeholder: RichText;
    buttonLabel: RichText;
    // For now: no backend; renders a disabled placeholder unless an external
    // URL is supplied (e.g. a Mailchimp / Substack form).
    externalUrl: string | null;
  };
}

// ---------- structure blocks ----------

export interface DividerBlock extends BlockId {
  type: "divider";
  data: {
    variant: "line" | "dots" | "section-label";
    label: RichText | null; // only used when variant === "section-label"
  };
}

export interface EmbedBlock extends BlockId {
  type: "embed";
  data: {
    provider: "twitter" | "notion" | "datawrapper" | "generic";
    url: string;
    title: RichText | null;
  };
}

export interface AuthorBioBlock extends BlockId {
  type: "author-bio";
  data: {
    layout: "compact" | "full";
    avatarUrl: string | null;
    name: RichText;
    role: RichText | null;
    bio: RichText | null;
    socials: { id: string; label: RichText; href: string }[];
  };
}

export interface SpacerBlock extends BlockId {
  type: "spacer";
  data: {
    size: "xs" | "s" | "m" | "l";
  };
}

// ---------- union ----------

export type CMSBlock =
  | ParagraphBlock
  | HeadingBlock
  | PullquoteBlock
  | CalloutBlock
  | ListBlock
  | CodeBlock
  | ImageBlock
  | VideoBlock
  | GalleryBlock
  | AudioBlock
  | CTABlock
  | PollBlock
  | SubscribeBlock
  | DividerBlock
  | EmbedBlock
  | AuthorBioBlock
  | SpacerBlock;

export type CMSBlockType = CMSBlock["type"];

/** Narrow a CMSBlock to a specific kind. */
export type BlockOf<T extends CMSBlockType> = Extract<CMSBlock, { type: T }>;

/** Data payload for a given block kind. */
export type BlockData<T extends CMSBlockType> = BlockOf<T>["data"];
