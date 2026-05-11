import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAuthor } from "@/lib/auth/guards";
import { listOwnPosts } from "@/lib/db/posts";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Panel, PanelBody, PanelHeader } from "@/components/portal/Panel";
import { SystemLabel } from "@/components/portal/SystemLabel";
import { formatPostDate } from "@/lib/utils/dates";

export const metadata: Metadata = { title: "My posts" };
export const dynamic = "force-dynamic";

const STATUS_VARIANT: Record<string, "default" | "secondary" | "muted" | "success" | "warning"> = {
  published: "success",
  scheduled: "default",
  submitted: "warning",
  draft: "muted",
  archived: "secondary",
};

export default async function MyPostsPage() {
  const { userId } = await requireAuthor();
  const posts = await listOwnPosts(userId);

  const grouped: Record<string, typeof posts> = { draft: [], submitted: [], scheduled: [], published: [], archived: [] };
  for (const p of posts) grouped[p.status]!.push(p);

  return (
    <div className="container mx-auto space-y-8 px-4 py-10">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-2">
          <SystemLabel tone="orange">003 // Personal Archive</SystemLabel>
          <h1 className="font-hero text-5xl font-bold uppercase tracking-tighter text-portal-text">My Posts</h1>
          <p className="text-sm text-portal-text-muted">Every signal you've broadcast, every draft you've started.</p>
        </div>
        <Button asChild>
          <Link href="/editor/new">
            <Plus className="h-4 w-4" /> New Transmission
          </Link>
        </Button>
      </div>

      {posts.length === 0 ? (
        <Panel>
          <PanelBody className="p-16 text-center">
            <SystemLabel className="mb-3 block">Archive Empty</SystemLabel>
            <h2 className="font-hero text-2xl font-bold uppercase text-portal-text">No transmissions yet</h2>
            <p className="mt-2 text-sm text-portal-text-muted">Start your first weekly update.</p>
            <Button asChild className="mt-5">
              <Link href="/editor/new">Create your first post</Link>
            </Button>
          </PanelBody>
        </Panel>
      ) : (
        <div className="space-y-6">
          {(["draft", "submitted", "scheduled", "published", "archived"] as const).map((status) =>
            (grouped[status]?.length ?? 0) > 0 ? (
              <Panel key={status}>
                <PanelHeader>
                  <div className="flex items-center gap-3">
                    <SystemLabel tone="orange">// {status}</SystemLabel>
                    <span className="font-hero text-lg font-bold uppercase tracking-tighter text-portal-text">
                      {status} ({grouped[status]!.length})
                    </span>
                  </div>
                </PanelHeader>
                <PanelBody className="p-0">
                  <ul className="divide-y-2 divide-portal-border-soft">
                    {grouped[status]!.map((p) => (
                      <li key={p.id} className="flex items-center justify-between gap-3 px-6 py-4">
                        <div className="min-w-0 flex-1">
                          <Link href={`/editor/${p.id}`} className="font-ui font-bold text-portal-text hover:text-portal-orange">
                            {p.title || "Untitled"}
                          </Link>
                          <div className="mt-1">
                            <SystemLabel>
                              Week of {formatPostDate(p.week_start_date)} · updated {formatPostDate(p.updated_at)}
                            </SystemLabel>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={STATUS_VARIANT[p.status] ?? "secondary"}>{p.status}</Badge>
                          <Button asChild size="sm" variant="outline">
                            <Link href={`/editor/${p.id}`}>Edit</Link>
                          </Button>
                          {p.status === "published" && (
                            <Button asChild size="sm" variant="ghost">
                              <Link href={`/blog/${p.slug}`}>View</Link>
                            </Button>
                          )}
                        </div>
                      </li>
                    ))}
                  </ul>
                </PanelBody>
              </Panel>
            ) : null,
          )}
        </div>
      )}
    </div>
  );
}
