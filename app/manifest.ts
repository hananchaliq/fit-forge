import type { MetadataRoute } from 'next';

export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'FitForge — Studio Latihan 3D, Lari GPS & Nutrisi AI',
    short_name: 'FitForge',
    description:
      'Aplikasi kebugaran mobile & web dengan Studio Latihan 3D 1024-Bit HD, GPS Run Tracker (Kalman & Haversine), Analisis Nutrisi AI kuliner Indonesia, serta Jadwal Sholat & Hidrasi.',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0E0E0E',
    theme_color: '#0E0E0E',
    categories: ['fitness', 'health', 'sports', 'lifestyle'],
    icons: [
      {
        src: '/pwa-192x192.png',
        sizes: '192x192',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'any',
      },
      {
        src: '/pwa-maskable-512x512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
      {
        src: '/icon.svg',
        sizes: 'any',
        type: 'image/svg+xml',
        purpose: 'any',
      },
    ],
    shortcuts: [
      {
        name: 'Mulai Lari GPS',
        short_name: 'Lari GPS',
        description: 'Buka Pelacak Lari GPS dengan Filter Kalman 1D',
        url: '/run',
        icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Studio Latihan 3D HD',
        short_name: '3D Studio',
        description: 'Buka Studio Anatomi Otot 3D 1024-Bit HD',
        url: '/workout',
        icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Scan Nutrisi AI',
        short_name: 'Nutrisi AI',
        description: 'Analisis Kalori & Protein Kuliner Indonesia',
        url: '/nutrisi',
        icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
      {
        name: 'Jadwal Sholat & Hidrasi',
        short_name: 'Sholat & Air',
        description: 'Cek Waktu Sholat Kemenag RI & Target Air Harian',
        url: '/jadwal',
        icons: [{ src: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  };
}
