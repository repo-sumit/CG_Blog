"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Badge } from "@/components/ui/Badge";
import { createTag, deleteTag } from "@/app/(app)/admin/actions";
import type { TagRow } from "@/lib/db/types";

export function TagsAdmin({ tags }: { tags: TagRow[] }) {
  const [pending, startTransition] = useTransition();
  const [name, setName] = useState("");

  function add() {
    if (!name.trim()) return;
    startTransition(async () => {
      const res = await createTag({ name });
      if (!res.ok) toast.error(res.error || "Failed.");
      else {
        toast.success("Tag added.");
        setName("");
      }
    });
  }

  function remove(id: string, label: string) {
    if (!window.confirm(`Delete tag "${label}"?`)) return;
    startTransition(async () => {
      const res = await deleteTag(id);
      if (!res.ok) toast.error(res.error || "Failed.");
      else toast.success("Removed.");
    });
  }

  return (
    <div>
      <div className="mb-4 flex gap-2">
        <Input
          value={name}
          placeholder="Add a new tag (e.g. Launch)"
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && add()}
        />
        <Button onClick={add} disabled={pending}>
          <Plus className="mr-2 h-4 w-4" /> Add
        </Button>
      </div>
      <ul className="divide-y">
        {tags.length === 0 && (
          <li className="py-4 text-center text-sm text-muted-foreground">No tags yet.</li>
        )}
        {tags.map((t) => (
          <li key={t.id} className="flex items-center justify-between py-2">
            <div className="flex items-center gap-2">
              <Badge variant="secondary">{t.name}</Badge>
              <span className="text-xs text-muted-foreground">/{t.slug}</span>
            </div>
            <Button
              size="icon"
              variant="ghost"
              onClick={() => remove(t.id, t.name)}
              disabled={pending}
              aria-label={`Delete ${t.name}`}
            >
              <Trash2 className="h-4 w-4 text-destructive" />
            </Button>
          </li>
        ))}
      </ul>
    </div>
  );
}
