"use client";

import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import Underline from "@tiptap/extension-underline";
import TextStyle from "@tiptap/extension-text-style";
import Color from "@tiptap/extension-color";
import Highlight from "@tiptap/extension-highlight";
import Placeholder from "@tiptap/extension-placeholder";
import Image from "@tiptap/extension-image";
import type { Extensions } from "@tiptap/react";
import { AudioBlock, VideoBlock } from "@/lib/editor/media-extensions";

export function editorExtensions(): Extensions {
  return [
    StarterKit.configure({
      heading: { levels: [2, 3, 4] },
      codeBlock: { HTMLAttributes: { class: "rounded-lg bg-muted p-3 text-sm" } },
    }),
    Underline,
    Link.configure({
      openOnClick: false,
      autolink: true,
      protocols: ["http", "https", "mailto"],
      HTMLAttributes: { rel: "noopener noreferrer", target: "_blank" },
    }),
    TextStyle,
    Color,
    Highlight.configure({ multicolor: true }),
    Placeholder.configure({
      placeholder: "Write your signal… (markdown shortcuts supported)",
    }),
    Image.configure({ HTMLAttributes: { class: "rounded-lg" } }),
    // Custom nodes for <audio> + <video>. Without these, ProseMirror has no
    // schema for those tags so it silently strips them during parse — which
    // both makes the uploaded media invisible AND causes the React reconciler
    // to throw `removeChild` errors mid-render. See media-extensions.ts for
    // the full context.
    AudioBlock,
    VideoBlock,
  ];
}
