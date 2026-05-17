import Link from "next/link";
import { CalendarClock } from "lucide-react";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { Panel, PanelBody, PanelHeader } from "@/components/portal/Panel";
import { SystemLabel } from "@/components/portal/SystemLabel";
import { weekdayLabel, todayWeekday, formatWeekRange } from "@/lib/utils/dates";
import type { ProfileRow } from "@/lib/db/types";
import { isViewModeActive } from "@/lib/auth/viewMode";

interface Props {
  team: ProfileRow[];
  postsByAuthorThisWeek: Record<string, number>;
  /** When true, render the "Manage schedule" link. Defaults to false. */
  canManageSchedule?: boolean;
}

export async function WeeklyScheduleCard({ team, postsByAuthorThisWeek, canManageSchedule = false }: Props) {
  const showManageLink = canManageSchedule && !(await isViewModeActive());
  const today = todayWeekday();
  const byDay: Record<number, ProfileRow | undefined> = {};
  for (const m of team) if (m.weekly_post_day) byDay[m.weekly_post_day] = m;
  const todaysAuthor = today ? byDay[today] : null;

  return (
    <Panel>
      <PanelHeader>
        <div className="font-hero text-base font-bold uppercase tracking-tighter text-portal-text">
          Schedule
        </div>
        <SystemLabel>{formatWeekRange()}</SystemLabel>
      </PanelHeader>

      <PanelBody className="space-y-4">
        {todaysAuthor && (
          <div className="rounded-md border border-portal-orange/30 bg-portal-orange/5 p-3">
            <div className="text-[10px] uppercase tracking-wider text-portal-orange">Today’s author</div>
            <div className="mt-2 flex items-center gap-3">
              <Avatar src={todaysAuthor.avatar_url} name={todaysAuthor.full_name} email={todaysAuthor.email} />
              <div className="min-w-0 flex-1">
                <div className="truncate font-ui text-sm font-bold text-portal-text">
                  {todaysAuthor.full_name || todaysAuthor.email}
                </div>
                <div className="text-[10px] uppercase tracking-wider text-portal-text-muted">
                  {weekdayLabel(today!)}
                </div>
              </div>
            </div>
          </div>
        )}

        <ul className="space-y-1">
          {[1, 2, 3, 4, 5].map((d) => {
            const owner = byDay[d];
            const posted = owner ? (postsByAuthorThisWeek[owner.id] ?? 0) > 0 : false;
            const isToday = today === d;
            return (
              <li
                key={d}
                className={
                  "flex items-center gap-3 rounded-md px-2 py-1.5 " +
                  (isToday ? "bg-portal-panel-raised" : "")
                }
              >
                <span className="w-16 text-[10px] uppercase tracking-wider text-portal-text-muted">
                  {weekdayLabel(d)}
                </span>
                {owner ? (
                  <>
                    <Avatar src={owner.avatar_url} name={owner.full_name} email={owner.email} size="sm" />
                    <span className="min-w-0 flex-1 truncate font-ui text-xs text-portal-text">
                      {owner.full_name || owner.email}
                    </span>
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
                  <span className="text-[10px] uppercase tracking-wider text-portal-text-muted italic">Unassigned</span>
                )}
              </li>
            );
          })}
        </ul>

        {showManageLink && (
          <div className="border-t border-portal-border-soft pt-2">
            <Link
              href="/admin/schedule"
              className="text-[11px] uppercase tracking-wider text-portal-blue hover:underline"
            >
              Manage schedule →
            </Link>
          </div>
        )}
      </PanelBody>
    </Panel>
  );
}
