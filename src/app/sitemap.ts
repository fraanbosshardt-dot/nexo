import type { MetadataRoute } from "next";
import { PUBLIC_PAGES, SITE } from "@/lib/seo";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return PUBLIC_PAGES.map((p) => ({ url: `${SITE.url}${p.path}`, lastModified: now, changeFrequency: p.priority >= 0.8 ? "weekly" : "monthly", priority: p.priority }));
}
