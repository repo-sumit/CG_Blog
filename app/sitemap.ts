import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";
import { listPublicPosts } from "@/lib/db/public";

export const revalidate = 3600;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const base = (publicEnv.appUrl || "http://localhost:3000").replace(/\/$/, "");
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = [
    { url: `${base}/`, lastModified: now, changeFrequency: "daily", priority: 1 },
    { url: `${base}/archive`, lastModified: now, changeFrequency: "weekly", priority: 0.6 },
  ];

  const posts = await listPublicPosts(1000);
  const postEntries: MetadataRoute.Sitemap = posts.map((p) => ({
    url: `${base}/posts/${p.slug}`,
    lastModified: p.updated_at ? new Date(p.updated_at) : p.published_at ? new Date(p.published_at) : now,
    changeFrequency: "weekly",
    priority: 0.8,
  }));

  return [...staticEntries, ...postEntries];
}
