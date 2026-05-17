import type { MetadataRoute } from "next";
import { publicEnv } from "@/lib/env";

export default function robots(): MetadataRoute.Robots {
  const base = (publicEnv.appUrl || "http://localhost:3000").replace(/\/$/, "");
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/admin",
          "/admin/",
          "/api/",
          "/editor",
          "/editor/",
          "/dashboard",
          "/me",
          "/my-posts",
          "/transmit",
          "/login",
          "/unauthorized",
        ],
      },
    ],
    sitemap: `${base}/sitemap.xml`,
  };
}
