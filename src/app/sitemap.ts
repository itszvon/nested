import type { MetadataRoute } from "next";

const SITE = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return [
    { url: `${SITE}/home`, lastModified, changeFrequency: "monthly", priority: 1 },
    { url: `${SITE}/security`, lastModified, changeFrequency: "yearly", priority: 0.4 },
    { url: `${SITE}/copyright`, lastModified, changeFrequency: "yearly", priority: 0.3 },
    { url: `${SITE}/dmca`, lastModified, changeFrequency: "yearly", priority: 0.3 },
  ];
}
