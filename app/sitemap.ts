import type { MetadataRoute } from "next";
import { APP } from "@/lib/config";

const SITE = (APP as { app_url?: string }).app_url ?? "https://applywithproof.vercel.app";

/** The public pages, for search engines (round 31). */
export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: `${SITE}/`, lastModified: now, changeFrequency: "weekly", priority: 1 },
    { url: `${SITE}/sign-in`, lastModified: now, changeFrequency: "monthly", priority: 0.6 },
    { url: `${SITE}/legal/privacy`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/legal/terms`, lastModified: now, changeFrequency: "yearly", priority: 0.3 },
  ];
}
