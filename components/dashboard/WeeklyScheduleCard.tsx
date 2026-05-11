import Link from "next/link";
import { CalendarCheck2, CalendarClock } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Avatar } from "@/components/ui/Avatar";
import { weekdayLabel, todayWeekday, formatWeekRange } from "@/lib/utils/dates";
import type { ProfileRow } from "@/lib/db/types";

interface Props {
  team: ProfileRow[];
  postsByAuthorThisWeek: Record<string, number>;
}

export function WeeklyScheduleCard({ team, postsByAuthorThisWeek }: Props) {
  const today = todayWeekday();
  const byDay: Record<number, ProfileRow | undefined> = {};
  for (const m of team) {
    if (m.weekly_post_day) byDay[m.weekly_post_day] = m;
  }
  const todaysAuthor = today ? byDay[today] : null;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <CalendarCheck2 className="h-4 w-4 text-primary" />
            Weekly schedule
          </CardTitle>
          <span className="text-xs text-muted-foreground">{formatWeekRange()}</span>
        </div>
      </CardHeader>
      <CardContent>
        {todaysAuthor && (
          <div className="mb-4 flex items-center gap-3 rounded-lg border bg-primary/5 p-3">
            <Avatar src={todaysAuthor.avatar_url} name={todaysAuthor.full_name} email={todaysAuthor.email} />
            <div className="flex-1">
              <div className="text-xs font-medium uppercase tracking-wide text-primary">Today’s author</div>
              <div className="font-medium">{todaysAuthor.full_name || todaysAuthor.email}</div>
            </div>
            <Badge>{weekdayLabel(today!)}</Badge>
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
                  "flex items-center gap-3 rounded-md px-2 py-1.5 " +
                  (isToday ? "bg-secondary" : "")
                }
              >
                <span className="w-20 text-xs font-medium text-muted-foreground">
                  {weekdayLabel(d)}
                </span>
                {owner ? (
                  <>
                    <Avatar src={owner.avatar_url} name={owner.full_name} email={owner.email} size="sm" />
                    <span className="text-sm flex-1 truncate">{owner.full_name || owner.email}</span>
                    {posted ? (
                      <Badge variant="success">Posted</Badge>
                    ) : isToday ? (
                      <Badge variant="warning">Due today</Badge>
                    ) : d < (today ?? 0) ? (
                      <Badge variant="destructive">Missed</Badge>
                    ) : (
                      <Badge variant="muted">
                        <CalendarClock className="mr-1 h-3 w-3" />
                        Upcoming
                      </Badge>
                    )}
                  </>
                ) : (
                  <span className="text-xs italic text-muted-foreground">Unassigned</span>
                )}
              </li>
            );
          })}
        </ul>

        <div className="mt-4 text-xs text-muted-foreground">
          <Link href="/admin/schedule" className="underline-offset-2 hover:underline">
            Manage schedule →
          </Link>
        </div>
      </CardContent>
    </Card>
  );
}
