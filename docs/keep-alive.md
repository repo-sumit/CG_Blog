# Supabase keep-alive

Supabase's free tier pauses projects after a stretch of inactivity. The
first request after a pause has to wake the database, which adds an extra
second or two to whatever the user was doing — usually an autosave on a
freshly-opened editor. The keep-alive cron makes that latency disappear by
running a tiny read on a schedule.

## Endpoint

[`app/api/cron/keep-alive/route.ts`](../app/api/cron/keep-alive/route.ts)

- Auth: `Authorization: Bearer $CRON_SECRET` (same shared secret as the
  other crons).
- Body: one-row select against `posts`.
- Response: `{ ok: true, elapsedMs }`.

The handler is intentionally read-only and uses the service client so RLS
doesn't get in the way of the warm-up query.

## Schedule

`vercel.json` runs this daily at 06:00 UTC. That's the densest Vercel Hobby
allows; on Pro you can bump to every 14 minutes (`*/14 * * * *`).

```jsonc
{
  "path": "/api/cron/keep-alive",
  "schedule": "0 6 * * *"
}
```

## External cadence fallbacks (when you need more than 1/day on Hobby)

Pick any external scheduler and have it hit:

```
GET https://<your-app>.vercel.app/api/cron/keep-alive
Authorization: Bearer <CRON_SECRET>
```

Tested options:

| Service | How |
|---|---|
| [cron-job.org](https://cron-job.org/) | Free, supports custom headers, 60s minimum interval. |
| GitHub Actions | `schedule: cron: "*/14 * * * *"` workflow that runs `curl -H "Authorization: Bearer ${{ secrets.CRON_SECRET }}" $URL`. |
| UptimeRobot | HTTPS monitor with a custom Authorization header. |

Do **not** ping more often than every ~5 minutes. Supabase doesn't reward
hammering and the keep-alive table read still costs bandwidth.

## What this does NOT do

- It doesn't keep your Vercel Next.js function warm — Vercel manages that
  on its own. The keep-alive is solely about the Supabase Postgres pool.
- It doesn't replace error monitoring. If Supabase returns an error, the
  function logs it but doesn't notify anyone.
