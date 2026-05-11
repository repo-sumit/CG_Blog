import "@/lib/blocks"; // side-effect: register blocks
import { getBlockDef } from "@/lib/blocks/registry";
import type { CMSBlock } from "./types";

/**
 * Renders a CMSBlock[] to an email-safe HTML string (table-based layouts,
 * inline styles, no JS, no modern CSS). Returns just the body — callers
 * compose the outer `<html><head>…</head><body>` shell with their preferred
 * template (subject, header, footer, unsubscribe link, etc.).
 */
export function blocksToEmailHtml(blocks: CMSBlock[]): string {
  if (!Array.isArray(blocks)) return "";
  return blocks
    .map((block) => {
      const def = getBlockDef(block.type);
      if (!def) return "";
      try {
        // Each toEmail handler narrows the block via its own type.
        return (def.toEmail as (b: CMSBlock) => string)(block);
      } catch (err) {
        console.error("[blocksToEmailHtml] failed block", block.type, err);
        return "";
      }
    })
    .join("\n");
}
