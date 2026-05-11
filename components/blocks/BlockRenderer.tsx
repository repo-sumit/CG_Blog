import "@/lib/blocks"; // side-effect import — registers all blocks
import { getBlockDef } from "@/lib/blocks/registry";
import { BlockFallback } from "@/lib/blocks";
import type { CMSBlock } from "@/lib/blocks/types";
import { BlockErrorBoundary } from "./BlockErrorBoundary";

/**
 * Renders a CMSBlock[] array on the public post page. Each block is wrapped
 * in an error boundary so one malformed block can't crash the entire post.
 */
export function BlockRenderer({ blocks }: { blocks: CMSBlock[] }) {
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return null;
  }
  return (
    <>
      {blocks.map((block) => (
        <BlockErrorBoundary key={block.id} type={block.type}>
          <BlockSwitch block={block} />
        </BlockErrorBoundary>
      ))}
    </>
  );
}

function BlockSwitch({ block }: { block: CMSBlock }) {
  const def = getBlockDef(block.type);
  if (!def) {
    return <BlockFallback>Unknown block type: {block.type}</BlockFallback>;
  }
  // The registry stores defs with a CMSBlockType key — the cast below is safe
  // at runtime because we just looked up by the exact `block.type`.
  const Web = def.Web as React.ComponentType<{ block: CMSBlock }>;
  return <Web block={block} />;
}
