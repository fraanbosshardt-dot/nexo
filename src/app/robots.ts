import type { MetadataRoute } from "next";
import { SITE } from "@/lib/seo";

// Los buscadores pueden leer lo público; la app, el panel interno y la API nunca.
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [{ userAgent: "*", allow: "/", disallow: ["/app", "/admin", "/api"] }],
    sitemap: `${SITE.url}/sitemap.xml`,
    host: SITE.url,
  };
}
