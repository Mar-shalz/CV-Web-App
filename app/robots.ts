import type { MetadataRoute } from "next";
import { APP } from "@/lib/config";

const SITE = (APP as { app_url?: string }).app_url ?? "https://applywithproof.vercel.app";

/** Search engines read the public pages only; everything behind sign in stays out (round 31). */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/legal/", "/sign-in"],
        disallow: ["/home", "/jobs", "/applications", "/experience", "/settings", "/onboarding", "/pass", "/extension", "/admin", "/api", "/auth", "/c/", "/suspended", "/offline"],
      },
    ],
    sitemap: `${SITE}/sitemap.xml`,
    host: SITE,
  };
}
