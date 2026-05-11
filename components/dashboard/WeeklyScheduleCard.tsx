import Link from "next/link";
import { CalendarCheck2, CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Panel, PanelBody, PanelHeader } from "@/components/portal/Panel";
import { SystemLabel } from "@/components/portal/SystemLabel";
import { weekdayLabel, todayWeekday, formatWeekRange } from "@/lib/utils/dates";
import type { ProfileRow } from "@/lib/db/types";

interface Props {
  team: ProfileRow[];
  postsByAuthorThisWeek: Record<string, number>;
}

export function WeeklyScheduleCard({ team, postsByAuthorThisWeek }: Props) {
  const today = todayWeekday();
  const byDay: Record<number, ProfileRow | undefined> = {};
  for (const m of team) if (m.weekly_post_day) byDay[m.weekly_post_day] = m;
  const todaysAuthor = today ? byDay[today] : null;

  return (
    <Panel>
      <PanelHeader>
        <div>
          <SystemLabel tone="orange">003 // Schedule</SystemLabel>
          <div className="font-hero text-lg font-bold uppercase tracking-tighter text-portal-text mt-1">
            <CalendarCheck2 className="inline h-4 w-4 mr-2 text-portal-orange" />
            Weekly Slot Map
          </div>
        </div>
        <SystemLabel>{formatWeekRange()}</SystemLabel>
      </PanelHeader>

      <PanelBody className="space-y-4">
        {todaysAuthor && (
          <div className="rounded-md border-2 border-portal-orange/30 bg-portal-orange/5 p-3">
            <SystemLabel tone="orange" dot>Today’s Author</SystemLabel>
            <div className="mt-2 flex items-center gap-3">
              <Avatar src={todaysAuthor.avatar_url} name={todaysAuthor.full_name} email={todaysAuthor.email} />
              <div className="flex-1">
                <div className="font-ui text-sm font-bold text-portal-text">
                  {todaysAuthor.full_name || todaysAuthor.email}
                </div>
                <SystemLabel>{weekdayLabel(today!)}</SystemLabel>
              </div>
            </div>
          </div>
        )}

        <ul className="space-y-1.5">
          {[1, 2, 3, 4, 5].map((d) => {
            const owner = byDay[d];
            const posted = owner ? (postsByAuthorThisWeek[owner.id] ?? 0) > 0 : false;
            const isToday = today === d;
            return (
              <li
                key={d}
                className={
                  "flex items-center gap-3 rounded-md px-3 py-2 " +
                  (isToday ? "bg-portal-panel-raised border border-portal-border-muted" : "")
                }
              >
                <span className="w-16 font-ui text-[10px] uppercase tracking-label text-portal-text-soft">
                  {weekdayLabel(d)}
                </span>
                {owner ? (
                  <>
                    <Avatar src={owner.avatar_url} name={owner.full_name} email={owner.email} size="sm" />
                    <span className="flex-1 truncate font-ui text-xs text-portal-text">{owner.full_name || owner.email}</span>
                    {posted ? (
                      <Badge variant="success">Posted</Badge>
                    ) : isToday ? (
                      <Badge variant="warning">Due</Badge>
                    ) : d < (today ?? 0) ? (
                      <Badge variant="destructive">Missed</Badge>
                    ) : (
                      <Badge variant="muted"><CalendarClock className="h-3 w-3" /> Upcoming</Badge>
                    )}
                  </>
                ) : (
                  <span className="font-ui text-[10px] uppercase tracking-label text-portal-text-soft">Unassigned</span>
                )}
              </li>
            );
          })}
        </ul>

        <div className="border-t-2 border-portal-border-soft pt-3">
          <Link href="/admin/schedule" className="font-ui text-[10px] uppercase tracking-label text-portal-blue hover:underline">
            Manage schedule →
          </Link>
        </div>
      </PanelBody>
    </Panel>
  );
}
