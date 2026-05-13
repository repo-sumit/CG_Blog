"use client";

import { Node, mergeAttributes, type Editor } from "@tiptap/core";

/**
 * Custom TipTap node extensions for <audio> and <video> blocks.
 *
 * Why these exist:
 *   The previous implementation inserted audio/video via raw HTML
 *   (`editor.chain().insertContent("<audio …>")`). ProseMirror has no
 *   built-in schema entry for <audio> / <video>, so the HTML parser
 *   silently stripped those elements during reconciliation. That's the
 *   root cause of TWO bugs at once:
 *
 *     1. "removeChild: The node to be removed is not a child of this node."
 *        — ProseMirror briefly renders the unknown DOM node, then the
 *        reconciler can't find it where it expects and throws.
 *     2. "Audio inserted but not visible." — once parsing finishes, the
 *        node was already dropped from the doc; only the trailing empty
 *        <p> survives.
 *
 *   Registering proper Node extensions gives the schema a stable place to
 *   keep these blocks. ProseMirror manages their DOM lifecycle natively
 *   and `<audio controls>` / `<video controls>` render with the browser's
 *   default player.
 *
 * The nodes are atomic (`atom: true`) — they're a single block that the
 * cursor can't enter, like an image. They're selectable + draggable so
 * the author can move them around the document.
 */

interface MediaAttrs {
  src: string | null;
  title: string | null;
}

declare module "@tiptap/core" {
  interface Commands<ReturnType> {
    cgAudio: {
      setAudio: (attrs: { src: string; title?: string }) => ReturnType;
    };
    cgVideo: {
      setVideo: (attrs: { src: string; title?: string }) => ReturnType;
    };
  }
}

export const AudioBlock = Node.create({
  name: "audio",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      title: { default: null },
    } as Record<keyof MediaAttrs, { default: null }>;
  },

  parseHTML() {
    return [{ tag: "audio[src]" }];
  },

  renderHTML({ HTMLAttributes }) {
    // `controls preload="metadata"` gives the browser-default player without
    // forcing autoplay. We do NOT serialise the `title` attribute onto the
    // <audio> DOM node — it's stored as a schema attribute for future use
    // (a label row above the player) and isn't valid HTML on <audio>.
    const { title: _title, ...rest } = HTMLAttributes as Record<string, unknown>;
    return [
      "audio",
      mergeAttributes(
        {
          controls: "controls",
          preload: "metadata",
          style: "width:100%;max-width:560px;display:block;margin:14px 0;",
        },
        rest,
      ),
    ];
  },

  addCommands() {
    return {
      setAudio:
        (attrs) =>
        ({ chain }) =>
          chain()
            .insertContent({ type: this.name, attrs })
            .focus()
            .run(),
    };
  },
});

export const VideoBlock = Node.create({
  name: "video",
  group: "block",
  atom: true,
  selectable: true,
  draggable: true,

  addAttributes() {
    return {
      src: { default: null },
      title: { default: null },
    } as Record<keyof MediaAttrs, { default: null }>;
  },

  parseHTML() {
    return [{ tag: "video[src]" }];
  },

  renderHTML({ HTMLAttributes }) {
    const { title: _title, ...rest } = HTMLAttributes as Record<string, unknown>;
    return [
      "video",
      mergeAttributes(
        {
          controls: "controls",
          preload: "metadata",
          style: "max-width:100%;border-radius:0.5rem;display:block;margin:14px 0;",
        },
        rest,
      ),
    ];
  },

  addCommands() {
    return {
      setVideo:
        (attrs) =>
        ({ chain }) =>
          chain()
            .insertContent({ type: this.name, attrs })
            .focus()
            .run(),
    };
  },
});

/**
 * Helper for callers that just want to insert a typed node without
 * importing the chain command directly. Returns true on success.
 */
export function insertMediaBlock(
  editor: Editor,
  kind: "audio" | "video",
  attrs: { src: string; title?: string },
): boolean {
  if (kind === "audio") return editor.chain().focus().setAudio(attrs).run();
  return editor.chain().focus().setVideo(attrs).run();
}
