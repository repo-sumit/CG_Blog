import type { Metadata } from "next";
import Link from "next/link";
import { Plus } from "lucide-react";
import { requireAuthor } from "@/lib/auth/guards";
import { listOwnPosts } from "@/lib/db/posts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/Card";
import { Badge } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
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
    <main className="container mx-auto px-4 py-8">
      <div className="mb-6 flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">My posts</h1>
        <Button asChild>
          <Link href="/editor/new">
            <Plus className="mr-2 h-4 w-4" /> New post
          </Link>
        </Button>
      </div>

      {posts.length === 0 ? (
        <div className="rounded-xl border border-dashed p-12 text-center">
          <h2 className="text-lg font-medium">No posts yet.</h2>
          <p className="mt-1 text-sm text-muted-foreground">Start your first weekly update.</p>
          <Button asChild className="mt-4">
            <Link href="/editor/new">Create your first post</Link>
          </Button>
        </div>
      ) : (
        <div className="space-y-6">
          {(["draft", "submitted", "scheduled", "published", "archived"] as const).map((status) =>
            (grouped[status]?.length ?? 0) > 0 ? (
              <Card key={status}>
                <CardHeader>
                  <CardTitle className="capitalize">{status} ({grouped[status]!.length})</CardTitle>
                </CardHeader>
                <CardContent>
                  <ul className="divide-y">
                    {grouped[status]!.map((p) => (
                      <li key={p.id} className="flex items-center justify-between py-3">
                        <div>
                          <Link href={`/editor/${p.id}`} className="font-medium hover:text-primary">
                            {p.title || "Untitled"}
                          </Link>
                          <div className="text-xs text-muted-foreground">
                            Week of {formatPostDate(p.week_start_date)} ·{" "}
                            updated {formatPostDate(p.updated_at)}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          <Badge variant={STATUS_VARIANT[p.status] ?? "secondary"} className="capitalize">
                            {p.status}
                          </Badge>
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
                </CardContent>
              </Card>
            ) : null,
          )}
        </div>
      )}
    </main>
  );
}
