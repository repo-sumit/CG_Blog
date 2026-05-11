"use client";

import { useState, useCallback, useMemo } from "react";
import { ChevronUp, ChevronDown, Trash2, Plus, Settings as SettingsIcon, X } from "lucide-react";
import type { CMSBlock, CMSBlockType, BlockData } from "@/lib/blocks/types";
import { listBlockDefs, getBlockDef } from "@/lib/blocks/registry";
import "@/lib/blocks"; // side-effect: register
import { getEditPair } from "./edits";
import { makeBlock } from "@/lib/blocks/util";
import { cn } from "@/lib/utils/cn";

interface Props {
  value: CMSBlock[];
  onChange: (next: CMSBlock[]) => void;
}

export function BlockEditor({ value, onChange }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showInsertAt, setShowInsertAt] = useState<number | null>(null);

  const selectedBlock = useMemo(
    () => value.find((b) => b.id === selectedId) ?? null,
    [value, selectedId],
  );

  const move = useCallback((id: string, delta: -1 | 1) => {
    const idx = value.findIndex((b) => b.id === id);
    if (idx < 0) return;
    const target = idx + delta;
    if (target < 0 || target >= value.length) return;
    const next = value.slice();
    [next[idx], next[target]] = [next[target]!, next[idx]!];
    onChange(next);
  }, [value, onChange]);

  const remove = useCallback((id: string) => {
    onChange(value.filter((b) => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  }, [value, onChange, selectedId]);

  const update = useCallback((id: string, data: CMSBlock["data"]) => {
    onChange(
      value.map((b) => (b.id === id ? ({ ...b, data } as CMSBlock) : b)),
    );
  }, [value, onChange]);

  const insertAt = useCallback((at: number, type: CMSBlockType) => {
    const def = getBlockDef(type);
    if (!def) return;
    const newBlock = makeBlock(type, def.defaultData());
    const next = value.slice();
    next.splice(at, 0, newBlock);
    onChange(next);
    setShowInsertAt(null);
    setSelectedId(newBlock.id);
  }, [value, onChange]);

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-6">
      {/* Block list (main column) */}
      <div className="space-y-2">
        {value.length === 0 ? (
          <EmptyState onAdd={() => setShowInsertAt(0)} />
        ) : null}

        {value.map((block, idx) => (
          <div key={block.id}>
            <InsertGap
              open={showInsertAt === idx}
              onToggle={() => setShowInsertAt(showInsertAt === idx ? null : idx)}
              onPick={(type) => insertAt(idx, type)}
            />
            <BlockCard
              block={block}
              isSelected={selectedId === block.id}
              isFirst={idx === 0}
              isLast={idx === value.length - 1}
              onSelect={() => setSelectedId(block.id)}
              onMoveUp={() => move(block.id, -1)}
              onMoveDown={() => move(block.id, 1)}
              onRemove={() => remove(block.id)}
              onChange={(data) => update(block.id, data)}
            />
          </div>
        ))}

        <InsertGap
          open={showInsertAt === value.length}
          onToggle={() => setShowInsertAt(showInsertAt === value.length ? null : value.length)}
          onPick={(type) => insertAt(value.length, type)}
        />
      </div>

      {/* Settings panel (right column) */}
      <aside className="lg:sticky lg:top-20 lg:self-start">
        <div className="rounded-xl border bg-card p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between">
            <div className="text-sm font-semibold flex items-center gap-2">
              <SettingsIcon className="h-4 w-4" />
              Block settings
            </div>
            {selectedBlock ? (
              <button
                type="button"
                onClick={() => setSelectedId(null)}
                className="text-muted-foreground hover:text-foreground"
                aria-label="Close settings"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>
          {selectedBlock ? (
            <SelectedSettings block={selectedBlock} onChange={(data) => update(selectedBlock.id, data)} />
          ) : (
            <div className="text-xs text-muted-foreground">
              Click any block to edit its settings here.
            </div>
          )}
        </div>
      </aside>
    </div>
  );
}

// ---------- helpers ----------

function EmptyState({ onAdd }: { onAdd: () => void }) {
  return (
    <div className="rounded-xl border border-dashed p-8 text-center">
      <p className="text-sm text-muted-foreground">No blocks yet.</p>
      <button
        type="button"
        onClick={onAdd}
        className="mt-3 inline-flex items-center gap-1 rounded-md bg-primary px-3 py-1.5 text-sm text-primary-foreground"
      >
        <Plus className="h-4 w-4" /> Add your first block
      </button>
    </div>
  );
}

function InsertGap({
  open,
  onToggle,
  onPick,
}: {
  open: boolean;
  onToggle: () => void;
  onPick: (type: CMSBlockType) => void;
}) {
  return (
    <div className="relative my-1 flex justify-center">
      <button
        type="button"
        onClick={onToggle}
        className={cn(
          "h-6 w-6 inline-flex items-center justify-center rounded-full border border-dashed text-xs transition-opacity",
          open ? "opacity-100 bg-secondary" : "opacity-30 hover:opacity-100",
        )}
        aria-label="Insert block here"
      >
        <Plus className="h-3 w-3" />
      </button>
      {open ? (
        <div
          className="absolute left-1/2 top-full z-30 mt-1 -translate-x-1/2 rounded-lg border bg-popover p-2 shadow-lg"
          style={{ minWidth: 220 }}
        >
          <BlockPicker onPick={onPick} />
        </div>
      ) : null}
    </div>
  );
}

function BlockPicker({ onPick }: { onPick: (type: CMSBlockType) => void }) {
  const groups = useMemo(() => {
    const defs = listBlockDefs();
    const by: Record<string, typeof defs> = { text: [], media: [], engagement: [], structure: [] };
    for (const d of defs) by[d.group]!.push(d);
    return by;
  }, []);
  return (
    <div className="space-y-2 max-h-[360px] overflow-y-auto">
      {(["text", "media", "engagement", "structure"] as const).map((g) => (
        <div key={g}>
          <div className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
            {g}
          </div>
          <div className="grid grid-cols-1">
            {groups[g]!.map((def) => (
              <button
                key={def.type}
                type="button"
                onClick={() => onPick(def.type)}
                className="text-left px-2 py-1.5 text-sm rounded hover:bg-secondary"
              >
                {def.label}
              </button>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

interface BlockCardProps {
  block: CMSBlock;
  isSelected: boolean;
  isFirst: boolean;
  isLast: boolean;
  onSelect: () => void;
  onMoveUp: () => void;
  onMoveDown: () => void;
  onRemove: () => void;
  onChange: (data: CMSBlock["data"]) => void;
}

function BlockCard({ block, isSelected, isFirst, isLast, onSelect, onMoveUp, onMoveDown, onRemove, onChange }: BlockCardProps) {
  const def = getBlockDef(block.type);
  const pair = getEditPair(block.type);
  if (!def || !pair) return null;
  const Edit = pair.Edit as React.ComponentType<{ block: CMSBlock; onChange: (d: CMSBlock["data"]) => void }>;
  return (
    <div
      onClick={onSelect}
      className={cn(
        "group rounded-lg border bg-card p-3 transition-colors cursor-text",
        isSelected ? "ring-2 ring-primary border-primary" : "hover:border-primary/40",
      )}
    >
      <div className="mb-2 flex items-center justify-between text-[11px] uppercase tracking-wider text-muted-foreground">
        <span>{def.label}</span>
        <div className="opacity-0 group-hover:opacity-100 transition-opacity flex items-center gap-1">
          <button type="button" onClick={(e) => { e.stopPropagation(); onMoveUp(); }} disabled={isFirst} aria-label="Move up" className="p-1 hover:text-foreground disabled:opacity-30">
            <ChevronUp className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onMoveDown(); }} disabled={isLast} aria-label="Move down" className="p-1 hover:text-foreground disabled:opacity-30">
            <ChevronDown className="h-3.5 w-3.5" />
          </button>
          <button type="button" onClick={(e) => { e.stopPropagation(); onRemove(); }} aria-label="Delete block" className="p-1 hover:text-destructive">
            <Trash2 className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
      <Edit block={block} onChange={onChange} />
    </div>
  );
}

function SelectedSettings({ block, onChange }: { block: CMSBlock; onChange: (data: CMSBlock["data"]) => void }) {
  const pair = getEditPair(block.type);
  if (!pair.Settings) {
    return <div className="text-xs text-muted-foreground">No settings for this block type.</div>;
  }
  const Settings = pair.Settings as React.ComponentType<{ block: CMSBlock; onChange: (d: CMSBlock["data"]) => void }>;
  return <Settings block={block} onChange={onChange} />;
}
