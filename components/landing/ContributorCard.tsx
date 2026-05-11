import Link from "next/link";
import { ArrowUpRight } from "lucide-react";
import { Avatar } from "@/components/ui/Avatar";
import { Badge } from "@/components/ui/Badge";
import { teamMetaFor } from "@/lib/team";
import { roleLabel } from "@/lib/auth/roles";
import { formatPostDate } from "@/lib/utils/dates";
import type { ContributorStats } from "@/lib/db/public";

/**
 * Rich contributor card. Pulls bio metadata from `TEAM_META` (designation/POD/
 * topics) and live stats (post count + latest post) from the DB. Falls back
 * gracefully if either piece is missing — useful for new joiners who don't
 * have a TEAM_META entry yet or haven't published.
 */
export function ContributorCard({ stat }: { stat: ContributorStats }) {
  const meta = teamMetaFor(stat.profile.email);
  const displayName = stat.profile.full_name || stat.profile.email.split("@")[0];
  const topics = stat.topics.length > 0 ? stat.topics : meta?.topics ?? [];

  return (
    <article className="group flex h-full flex-col rounded-md border border-portal-border-soft bg-portal-panel p-5 transition-colors hover:border-portal-border-muted">
      <header className="flex items-start gap-3">
        <Avatar
          src={stat.profile.avatar_url}
          name={displayName}
          email={stat.profile.email}
          size="lg"
        />
        <div className="min-w-0 flex-1">
          <div className="truncate font-ui text-sm font-bold text-portal-text">{displayName}</div>
          {meta && (
            <>
              <div className="mt-0.5 truncate text-xs text-portal-text-muted">{meta.designation}</div>
              <div className="text-[10px] uppercase tracking-wider text-portal-text-soft">{meta.pod}</div>
            </>
          )}
        </div>
        <Badge variant="outline">{roleLabel(stat.profile.role)}</Badge>
      </header>

      {/* Topics */}
      {topics.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {topics.map((t) => (
            <Badge key={t} variant="secondary">{t}</Badge>
          ))}
        </div>
      )}

      {/* Stats / latest post */}
      <div className="mt-auto border-t border-portal-border-soft pt-4">
        <div className="flex items-baseline gap-2">
          <span className="font-hero text-2xl font-bold tracking-tighter text-portal-text">
            {stat.postCount}
          </span>
          <span className="text-[10px] uppercase tracking-wider text-portal-text-muted">
            {stat.postCount === 1 ? "post" : "posts"}
          </span>
        </div>

        {stat.latestPost ? (
          <Link
            href={`/posts/${stat.latestPost.slug}`}
            className="mt-3 block rounded-md border border-portal-border-soft bg-portal-panel-soft p-3 transition-colors hover:border-portal-border-muted"
          >
            <div className="flex items-center justify-between gap-2">
              <span className="text-[10px] uppercase tracking-wider text-portal-text-muted">
                Latest
              </span>
              <ArrowUpRight className="h-3.5 w-3.5 text-portal-text-muted group-hover:text-portal-orange" />
            </div>
            <div className="mt-1 truncate font-ui text-sm text-portal-text">
              {stat.latestPost.title}
            </div>
            {stat.latestPost.published_at && (
              <div className="mt-1 text-[10px] uppercase tracking-wider text-portal-text-soft">
                {formatPostDate(stat.latestPost.published_at)}
              </div>
            )}
          </Link>
        ) : (
          <div className="mt-3 rounded-md border border-dashed border-portal-border-soft p-3 text-center text-[10px] uppercase tracking-wider text-portal-text-muted">
            No transmissions yet
          </div>
        )}
      </div>
    </article>
  );
}
