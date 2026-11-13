import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

/**
 * Public pages only. The app, settings, auth and API routes stay out.
 * `/terms` and `/privacy` are advertised because the landing page links to
 * them; their page-level robots flags agree with this list.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${SITE_URL}/home`, lastModified, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE_URL}/terms`, lastModified, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE_URL}/privacy`, lastModified, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE_URL}/security`, lastModified, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE_URL}/copyright`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE_URL}/dmca`, lastModified, changeFrequency: "yearly", priority: 0.3 },
  ];
}
