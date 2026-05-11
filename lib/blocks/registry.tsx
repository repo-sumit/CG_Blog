import type { ComponentType } from "react";
import type { z } from "zod";
import type { CMSBlock, CMSBlockType, BlockData } from "./types";

// Server-safe block definition. Pure data + a server-renderable React component
// + string formatters for email and plain text. Client-only editor and
// settings UIs live in components/blocks/edits.tsx and are registered
// separately so server components never have to ship them.

export interface BlockDefinition<T extends CMSBlockType> {
  type: T;
  label: string;
  group: "text" | "media" | "engagement" | "structure";
  defaultData: () => BlockData<T>;
  schema: z.ZodType<BlockData<T>>;
  Web: ComponentType<{ block: Extract<CMSBlock, { type: T }> }>;
  toEmail: (block: Extract<CMSBlock, { type: T }>) => string;
  toPlainText: (block: Extract<CMSBlock, { type: T }>) => string;
}

type AnyDef = BlockDefinition<CMSBlockType>;

const registry = new Map<CMSBlockType, AnyDef>();

export function registerBlock<T extends CMSBlockType>(def: BlockDefinition<T>) {
  registry.set(def.type, def as unknown as AnyDef);
}

export function getBlockDef<T extends CMSBlockType>(type: T): BlockDefinition<T> | null {
  return (registry.get(type) as BlockDefinition<T> | undefined) ?? null;
}

export function listBlockDefs(): AnyDef[] {
  return Array.from(registry.values());
}
