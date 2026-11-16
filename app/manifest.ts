import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'FitForge — Studio Latihan 3D, Lari GPS & Nutrisi AI',
    short_name: 'FitForge',
    description:
      'Aplikasi kebugaran terpadu dengan Studio 3D interaktif, GPS Run Tracker, Analisis Nutrisi AI kuliner Indonesia, serta Jadwal Sholat & Hidrasi.',
    start_url: '/dashboard',
    scope: '/',
    display: 'standalone',
    background_color: '#0E0E0E',
    theme_color: '#0E0E0E',
    icons: [
      {
        src: '/icon.svg',
        sizes: '192x192',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'any',
      },
      {
        src: '/icon.svg',
        sizes: '512x512',
        type: 'image/svg+xml',
        purpose: 'maskable',
      },
    ],
  };
}
