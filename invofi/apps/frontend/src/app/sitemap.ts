import type { MetadataRoute } from 'next';

const BASE = 'https://invofi-five.vercel.app';

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  return [
    { url: BASE,                      lastModified: now, changeFrequency: 'weekly',  priority: 1.0 },
    { url: `${BASE}/marketplace`,     lastModified: now, changeFrequency: 'hourly',  priority: 0.9 },
    { url: `${BASE}/auth/register`,   lastModified: now, changeFrequency: 'monthly', priority: 0.6 },
    { url: `${BASE}/auth/login`,      lastModified: now, changeFrequency: 'monthly', priority: 0.5 },
  ];
}
