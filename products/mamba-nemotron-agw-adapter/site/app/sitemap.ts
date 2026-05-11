import type { MetadataRoute } from 'next';

const SITE = 'https://mamba.taifoon.dev';

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  const routes: MetadataRoute.Sitemap = [
    { url: `${SITE}/`,        lastModified, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${SITE}/spec`,    lastModified, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE}/install`, lastModified, changeFrequency: 'monthly', priority: 0.9 },
    { url: `${SITE}/pricing`, lastModified, changeFrequency: 'monthly', priority: 0.7 },
  ];
  return routes;
}
