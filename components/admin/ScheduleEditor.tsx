"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Avatar } from "@/components/ui/Avatar";
import { Select } from "@/components/ui/Select";
import { setWeekday } from "@/app/(app)/admin/actions";
import { weekdayLabel } from "@/lib/utils/dates";
import type { ProfileRow } from "@/lib/db/types";

export function ScheduleEditor({ team }: { team: ProfileRow[] }) {
  const [pending, startTransition] = useTransition();
  const [days, setDays] = useState<Record<string, number | null>>(
    Object.fromEntries(team.map((m) => [m.id, m.weekly_post_day ?? null])),
  );

  function update(userId: string, weekday: number | null) {
    setDays((prev) => ({ ...prev, [userId]: weekday }));
    startTransition(async () => {
      const res = await setWeekday({ userId, weekday });
      if (!res.ok) toast.error(res.error || "Failed to save.");
      else toast.success("Saved.");
    });
  }

  return (
    <ul className="divide-y">
      {team.map((m) => (
        <li key={m.id} className="flex items-center gap-3 py-3">
          <Avatar src={m.avatar_url} name={m.full_name} email={m.email} />
          <div className="flex-1">
            <div className="font-medium">{m.full_name || m.email}</div>
            <div className="text-xs text-muted-foreground capitalize">{m.role} · {m.email}</div>
          </div>
          <Select
            value={days[m.id] ?? ""}
            onChange={(e) => update(m.id, e.target.value === "" ? null : Number(e.target.value))}
            disabled={pending}
            className="w-40"
          >
            <option value="">Unassigned</option>
            {[1, 2, 3, 4, 5].map((d) => (
              <option key={d} value={d}>{weekdayLabel(d)}</option>
            ))}
          </Select>
        </li>
      ))}
    </ul>
  );
}
