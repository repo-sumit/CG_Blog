"use client";

import { useState } from "react";
import type { CMSBlock, CMSBlockType, BlockData } from "@/lib/blocks/types";
import { newId } from "@/lib/blocks/util";

// Client-only inline edit + settings UIs, keyed by block type. The 6 most-
// common blocks have purpose-built UIs; the other 11 fall back to a generic
// JSON editor in the body and a per-field form in the settings panel.

export type EditProps<T extends CMSBlockType> = {
  block: Extract<CMSBlock, { type: T }>;
  onChange: (data: BlockData<T>) => void;
};

// ---------- shared primitives ----------

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-muted-foreground">{label}</span>
      {children}
    </label>
  );
}

function Input(props: React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <input
      {...props}
      className={
        "flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm " +
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
        (props.className ?? "")
      }
    />
  );
}

function Textarea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className={
        "flex min-h-[80px] w-full rounded-md border border-input bg-background px-2 py-1 text-sm " +
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring " +
        (props.className ?? "")
      }
    />
  );
}

function Select(props: React.SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <select
      {...props}
      className={
        "flex h-9 w-full rounded-md border border-input bg-background px-2 py-1 text-sm " +
        (props.className ?? "")
      }
    />
  );
}

// ---------- Paragraph ----------
export function ParagraphEdit({ block, onChange }: EditProps<"paragraph">) {
  return (
    <Textarea
      value={block.data.text}
      onChange={(e) => onChange({ ...block.data, text: e.target.value })}
      placeholder="Type a paragraph…"
    />
  );
}
export function ParagraphSettings({ block, onChange }: EditProps<"paragraph">) {
  return (
    <div className="space-y-3">
      <Field label="Variant">
        <Select
          value={block.data.variant}
          onChange={(e) => onChange({ ...block.data, variant: e.target.value as BlockData<"paragraph">["variant"] })}
        >
          <option value="lead">Lead</option>
          <option value="body">Body</option>
          <option value="small">Small</option>
        </Select>
      </Field>
      <Field label="Alignment">
        <Select
          value={block.data.align}
          onChange={(e) => onChange({ ...block.data, align: e.target.value as BlockData<"paragraph">["align"] })}
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </Select>
      </Field>
      <label className="flex items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={block.data.dropCap}
          onChange={(e) => onChange({ ...block.data, dropCap: e.target.checked })}
        />
        Drop cap on first letter
      </label>
    </div>
  );
}

// ---------- Heading ----------
export function HeadingEdit({ block, onChange }: EditProps<"heading">) {
  return (
    <Input
      value={block.data.text}
      onChange={(e) => onChange({ ...block.data, text: e.target.value })}
      placeholder="Heading text…"
      className="h-11 text-2xl font-semibold border-0 px-0"
    />
  );
}
export function HeadingSettings({ block, onChange }: EditProps<"heading">) {
  return (
    <div className="space-y-3">
      <Field label="Level">
        <Select
          value={String(block.data.level)}
          onChange={(e) => onChange({ ...block.data, level: Number(e.target.value) as BlockData<"heading">["level"] })}
        >
          <option value="1">H1</option>
          <option value="2">H2</option>
          <option value="3">H3</option>
        </Select>
      </Field>
      <Field label="Anchor (auto if empty)">
        <Input
          value={block.data.anchor}
          onChange={(e) => onChange({ ...block.data, anchor: e.target.value })}
          placeholder="section-id"
        />
      </Field>
      <Field label="Alignment">
        <Select
          value={block.data.align}
          onChange={(e) => onChange({ ...block.data, align: e.target.value as BlockData<"heading">["align"] })}
        >
          <option value="left">Left</option>
          <option value="center">Center</option>
          <option value="right">Right</option>
        </Select>
      </Field>
    </div>
  );
}

// ---------- Callout ----------
export function CalloutEdit({ block, onChange }: EditProps<"callout">) {
  return (
    <div className="space-y-2">
      <Input
        value={block.data.heading ?? ""}
        onChange={(e) => onChange({ ...block.data, heading: e.target.value || null })}
        placeholder="Heading (optional)"
      />
      <Textarea
        value={block.data.body}
        onChange={(e) => onChange({ ...block.data, body: e.target.value })}
        placeholder="Callout body…"
      />
    </div>
  );
}
export function CalloutSettings({ block, onChange }: EditProps<"callout">) {
  return (
    <Field label="Tone">
      <Select
        value={block.data.tone}
        onChange={(e) => onChange({ ...block.data, tone: e.target.value as BlockData<"callout">["tone"] })}
      >
        <option value="info">Info</option>
        <option value="warning">Warning</option>
        <option value="tip">Tip</option>
        <option value="danger">Danger</option>
      </Select>
    </Field>
  );
}

// ---------- Image ----------
export function ImageEdit({ block, onChange }: EditProps<"image">) {
  return (
    <div className="space-y-2">
      <Input
        value={block.data.src}
        onChange={(e) => onChange({ ...block.data, src: e.target.value })}
        placeholder="Image URL or /api/media/file?path=…"
      />
      <Input
        value={block.data.alt}
        onChange={(e) => onChange({ ...block.data, alt: e.target.value })}
        placeholder="Alt text (accessibility)"
      />
      <Input
        value={block.data.caption ?? ""}
        onChange={(e) => onChange({ ...block.data, caption: e.target.value || null })}
        placeholder="Caption (optional)"
      />
    </div>
  );
}
export function ImageSettings({ block, onChange }: EditProps<"image">) {
  return (
    <div className="space-y-3">
      <Field label="Layout">
        <Select
          value={block.data.layout}
          onChange={(e) => onChange({ ...block.data, layout: e.target.value as BlockData<"image">["layout"] })}
        >
          <option value="full">Full-width</option>
          <option value="inset">Inset</option>
          <option value="float-left">Float left</option>
          <option value="float-right">Float right</option>
        </Select>
      </Field>
      <Field label="Click-through URL (optional)">
        <Input
          value={block.data.href ?? ""}
          onChange={(e) => onChange({ ...block.data, href: e.target.value || null })}
          placeholder="https://…"
        />
      </Field>
    </div>
  );
}

// ---------- Code ----------
export function CodeEdit({ block, onChange }: EditProps<"code">) {
  return (
    <Textarea
      value={block.data.code}
      onChange={(e) => onChange({ ...block.data, code: e.target.value })}
      placeholder="Code…"
      spellCheck={false}
      className="font-mono text-xs min-h-[120px]"
    />
  );
}
export function CodeSettings({ block, onChange }: EditProps<"code">) {
  return (
    <div className="space-y-3">
      <Field label="Variant">
        <Select
          value={block.data.variant}
          onChange={(e) => onChange({ ...block.data, variant: e.target.value as BlockData<"code">["variant"] })}
        >
          <option value="fenced">Fenced (block)</option>
          <option value="inline">Inline</option>
        </Select>
      </Field>
      <Field label="Language">
        <Input
          value={block.data.language}
          onChange={(e) => onChange({ ...block.data, language: e.target.value })}
          placeholder="ts, py, bash, …"
        />
      </Field>
    </div>
  );
}

// ---------- Divider ----------
export function DividerEdit() {
  return <div className="text-xs text-muted-foreground italic py-2">— divider —</div>;
}
export function DividerSettings({ block, onChange }: EditProps<"divider">) {
  return (
    <div className="space-y-3">
      <Field label="Variant">
        <Select
          value={block.data.variant}
          onChange={(e) => onChange({ ...block.data, variant: e.target.value as BlockData<"divider">["variant"] })}
        >
          <option value="line">Line</option>
          <option value="dots">Dots</option>
          <option value="section-label">Section label</option>
        </Select>
      </Field>
      {block.data.variant === "section-label" ? (
        <Field label="Label">
          <Input
            value={block.data.label ?? ""}
            onChange={(e) => onChange({ ...block.data, label: e.target.value || null })}
            placeholder="Section"
          />
        </Field>
      ) : null}
    </div>
  );
}

// ---------- List ----------
export function ListEdit({ block, onChange }: EditProps<"list">) {
  function setItem(idx: number, patch: Partial<{ text: string; checked: boolean }>) {
    const items = block.data.items.map((it, i) => (i === idx ? { ...it, ...patch } : it));
    onChange({ ...block.data, items });
  }
  function addItem() {
    onChange({ ...block.data, items: [...block.data.items, { id: newId(), text: "", checked: false }] });
  }
  function removeItem(idx: number) {
    if (block.data.items.length <= 1) return;
    onChange({ ...block.data, items: block.data.items.filter((_, i) => i !== idx) });
  }
  return (
    <div className="space-y-1">
      {block.data.items.map((item, idx) => (
        <div key={item.id} className="flex items-center gap-2">
          {block.data.variant === "checklist" ? (
            <input
              type="checkbox"
              checked={item.checked}
              onChange={(e) => setItem(idx, { checked: e.target.checked })}
              aria-label="Toggle item"
            />
          ) : (
            <span className="text-xs text-muted-foreground w-4">
              {block.data.variant === "numbered" ? `${idx + 1}.` : "•"}
            </span>
          )}
          <Input
            value={item.text}
            onChange={(e) => setItem(idx, { text: e.target.value })}
            placeholder={`Item ${idx + 1}`}
          />
          <button
            type="button"
            onClick={() => removeItem(idx)}
            className="text-xs text-muted-foreground hover:text-destructive px-2"
            aria-label="Remove item"
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addItem}
        className="mt-1 text-xs text-primary hover:underline"
      >
        + Add item
      </button>
    </div>
  );
}
export function ListSettings({ block, onChange }: EditProps<"list">) {
  return (
    <Field label="Variant">
      <Select
        value={block.data.variant}
        onChange={(e) => onChange({ ...block.data, variant: e.target.value as BlockData<"list">["variant"] })}
      >
        <option value="bullet">Bullet</option>
        <option value="numbered">Numbered</option>
        <option value="checklist">Checklist</option>
      </Select>
    </Field>
  );
}

// ---------- Spacer ----------
export function SpacerEdit({ block }: EditProps<"spacer">) {
  return <div className="text-xs text-muted-foreground italic py-2">spacer ({block.data.size})</div>;
}
export function SpacerSettings({ block, onChange }: EditProps<"spacer">) {
  return (
    <Field label="Size">
      <Select
        value={block.data.size}
        onChange={(e) => onChange({ ...block.data, size: e.target.value as BlockData<"spacer">["size"] })}
      >
        <option value="xs">Extra small</option>
        <option value="s">Small</option>
        <option value="m">Medium</option>
        <option value="l">Large</option>
      </Select>
    </Field>
  );
}

// ---------- Generic JSON editor (used by all blocks without a dedicated UI) ----------
export function GenericJsonEdit<T extends CMSBlockType>({ block, onChange }: EditProps<T>) {
  const [text, setText] = useState(() => JSON.stringify(block.data, null, 2));
  const [error, setError] = useState<string | null>(null);
  return (
    <div>
      <Textarea
        value={text}
        onChange={(e) => {
          setText(e.target.value);
          try {
            const next = JSON.parse(e.target.value) as BlockData<T>;
            onChange(next);
            setError(null);
          } catch (err) {
            setError(err instanceof Error ? err.message : "Invalid JSON");
          }
        }}
        spellCheck={false}
        className="font-mono text-xs min-h-[140px]"
      />
      {error ? <div className="mt-1 text-xs text-destructive">{error}</div> : null}
      <div className="mt-1 text-[11px] text-muted-foreground">
        Block: <code className="font-mono">{block.type}</code> · Custom editor UI coming soon — edit the JSON directly for now.
      </div>
    </div>
  );
}

// ---------- Client registry: type → { Edit, Settings } ----------
type EditComp<T extends CMSBlockType> = React.ComponentType<EditProps<T>>;

interface ClientPair<T extends CMSBlockType> {
  Edit: EditComp<T>;
  Settings: EditComp<T> | null;
}

const CLIENT_REGISTRY: { [K in CMSBlockType]: ClientPair<K> } = {
  paragraph: { Edit: ParagraphEdit, Settings: ParagraphSettings },
  heading: { Edit: HeadingEdit, Settings: HeadingSettings },
  callout: { Edit: CalloutEdit, Settings: CalloutSettings },
  image: { Edit: ImageEdit, Settings: ImageSettings },
  code: { Edit: CodeEdit, Settings: CodeSettings },
  divider: { Edit: DividerEdit as EditComp<"divider">, Settings: DividerSettings },
  list: { Edit: ListEdit, Settings: ListSettings },
  spacer: { Edit: SpacerEdit, Settings: SpacerSettings },
  // The other 9 fall back to the generic JSON editor — they store correctly,
  // render correctly, but author UX is "edit JSON" until we ship dedicated UIs.
  pullquote: { Edit: GenericJsonEdit as EditComp<"pullquote">, Settings: null },
  video: { Edit: GenericJsonEdit as EditComp<"video">, Settings: null },
  gallery: { Edit: GenericJsonEdit as EditComp<"gallery">, Settings: null },
  audio: { Edit: GenericJsonEdit as EditComp<"audio">, Settings: null },
  cta: { Edit: GenericJsonEdit as EditComp<"cta">, Settings: null },
  poll: { Edit: GenericJsonEdit as EditComp<"poll">, Settings: null },
  subscribe: { Edit: GenericJsonEdit as EditComp<"subscribe">, Settings: null },
  embed: { Edit: GenericJsonEdit as EditComp<"embed">, Settings: null },
  "author-bio": { Edit: GenericJsonEdit as EditComp<"author-bio">, Settings: null },
};

export function getEditPair<T extends CMSBlockType>(type: T): ClientPair<T> {
  return CLIENT_REGISTRY[type];
}
