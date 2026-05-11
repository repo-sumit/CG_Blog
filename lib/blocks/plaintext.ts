import "@/lib/blocks"; // side-effect: register blocks
import { getBlockDef } from "@/lib/blocks/registry";
import type { CMSBlock } from "./types";

/**
 * Renders a CMSBlock[] to plain text. Used for RSS descriptions, search
 * indexing, post summaries, and email plaintext alternates.
 */
export function blocksToPlainText(blocks: CMSBlock[]): string {
  if (!Array.isArray(blocks)) return "";
  return blocks
    .map((block) => {
      const def = getBlockDef(block.type);
      if (!def) return "";
      try {
        return (def.toPlainText as (b: CMSBlock) => string)(block);
      } catch {
        return "";
      }
    })
    .filter(Boolean)
    .join("\n\n")
    .trim();
}
