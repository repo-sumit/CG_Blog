"use client";

import {
  Bold, Italic, Underline as UIcon, Strikethrough, Heading2, Heading3, Heading4,
  List, ListOrdered, Quote, Code, Link as LinkIcon, Image as ImageIcon, Highlighter,
  Undo2, Redo2, Eraser, Minus, Type,
} from "lucide-react";
import type { Editor } from "@tiptap/react";
import { cn } from "@/lib/utils/cn";

interface BtnProps {
  onClick: () => void;
  active?: boolean;
  disabled?: boolean;
  title: string;
  children: React.ReactNode;
}
function ToolbarButton({ onClick, active, disabled, title, children }: BtnProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      title={title}
      aria-label={title}
      className={cn(
        "inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground",
        "hover:bg-secondary hover:text-foreground disabled:opacity-40 disabled:pointer-events-none",
        active && "bg-secondary text-foreground",
      )}
    >
      {children}
    </button>
  );
}

const COLORS = ["#0f172a", "#dc2626", "#ea580c", "#16a34a", "#0284c7", "#7c3aed"];

interface Props {
  editor: Editor | null;
  onInsertImage: () => void;
  onInsertVideo: () => void;
  onInsertAudio: () => void;
  onInsertEmbed: () => void;
}

export function EditorToolbar({ editor, onInsertImage, onInsertVideo, onInsertAudio, onInsertEmbed }: Props) {
  if (!editor) return <div className="h-10 border-b" />;

  const setLink = () => {
    const prev = editor.getAttributes("link").href as string | undefined;
    const url = window.prompt("Link URL", prev ?? "https://");
    if (url === null) return;
    if (url === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
  };

  return (
    // Sticks just below the 64px-tall TopNav (`h-16`). Critical: the parent
    // <Card> MUST NOT set `overflow-hidden` — when it does, CSS treats the
    // Card as a scroll context and the toolbar pins to the Card's top
    // instead of the viewport, scrolling away with it.
    //
    // Z-index 30 sits below the nav (z-40) but above the editor body and
    // the BubbleMenu (default tippy z-index is 9999, but that floats over
    // the toolbar only while text is selected — intended).
    //
    // `bg-portal-panel` (solid) instead of `bg-background/95` so the
    // backdrop-blur fallback isn't needed in older browsers — the toolbar
    // reads cleanly on both themes via CSS variables.
    <div className="sticky top-16 z-30 -mx-px flex max-w-full flex-wrap items-center gap-1 overflow-x-auto border-b border-portal-border-soft bg-portal-panel p-2 supports-[backdrop-filter]:bg-portal-panel/95 supports-[backdrop-filter]:backdrop-blur">
      <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Bold">
        <Bold className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Italic">
        <Italic className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Underline">
        <UIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Strikethrough">
        <Strikethrough className="h-4 w-4" />
      </ToolbarButton>

      <span className="mx-1 h-5 w-px bg-border" />

      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Heading 2">
        <Heading2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Heading 3">
        <Heading3 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 4 }).run()} active={editor.isActive("heading", { level: 4 })} title="Heading 4">
        <Heading4 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setParagraph().run()} active={editor.isActive("paragraph")} title="Paragraph">
        <Type className="h-4 w-4" />
      </ToolbarButton>

      <span className="mx-1 h-5 w-px bg-border" />

      <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Bullet list">
        <List className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Numbered list">
        <ListOrdered className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Blockquote">
        <Quote className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} active={editor.isActive("codeBlock")} title="Code block">
        <Code className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().setHorizontalRule().run()} title="Horizontal rule">
        <Minus className="h-4 w-4" />
      </ToolbarButton>

      <span className="mx-1 h-5 w-px bg-border" />

      <ToolbarButton onClick={setLink} active={editor.isActive("link")} title="Link">
        <LinkIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={onInsertImage} title="Insert image">
        <ImageIcon className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={onInsertVideo} title="Insert video">
        <span className="text-[10px] font-semibold">▶</span>
      </ToolbarButton>
      <ToolbarButton onClick={onInsertAudio} title="Insert audio">
        <span className="text-[10px] font-semibold">♪</span>
      </ToolbarButton>
      <ToolbarButton onClick={onInsertEmbed} title="Embed YouTube/Vimeo/Loom">
        <span className="text-[10px] font-semibold">⤴</span>
      </ToolbarButton>

      <span className="mx-1 h-5 w-px bg-border" />

      {COLORS.map((c) => (
        <button
          key={c}
          type="button"
          title={`Text color ${c}`}
          aria-label={`Text color ${c}`}
          onClick={() => editor.chain().focus().setColor(c).run()}
          className="inline-block h-5 w-5 rounded-full border border-border"
          style={{ backgroundColor: c }}
        />
      ))}
      <ToolbarButton
        onClick={() => editor.chain().focus().toggleHighlight({ color: "#fef08a" }).run()}
        active={editor.isActive("highlight")}
        title="Highlight"
      >
        <Highlighter className="h-4 w-4" />
      </ToolbarButton>

      <span className="mx-1 h-5 w-px bg-border" />

      <ToolbarButton onClick={() => editor.chain().focus().undo().run()} disabled={!editor.can().undo()} title="Undo">
        <Undo2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().redo().run()} disabled={!editor.can().redo()} title="Redo">
        <Redo2 className="h-4 w-4" />
      </ToolbarButton>
      <ToolbarButton onClick={() => editor.chain().focus().unsetAllMarks().clearNodes().run()} title="Clear formatting">
        <Eraser className="h-4 w-4" />
      </ToolbarButton>
    </div>
  );
}
