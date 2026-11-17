import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, Bebas_Neue } from 'next/font/google';
import { FirebaseAuthProvider } from '@/components/auth/FirebaseAuthProvider';
import { WelcomeGuideModal } from '@/components/guide/WelcomeGuideModal';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
});

const bebasNeue = Bebas_Neue({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-poster',
});

export const viewport: Viewport = {
  themeColor: '#0E0E0E',
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'FitForge — AI Fitness, 3D Workout & GPS Run Tracker',
  description:
    'Platform kebugaran terpadu dengan Studio Latihan 3D 1024-Bit HD, Pelacak Lari GPS (Kalman & Haversine), Analisis Nutrisi AI kuliner Indonesia, Poster Rencana Latihan Mingguan, serta Jadwal Sholat & Hidrasi.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'black-translucent',
    title: 'FitForge',
  },
  icons: {
    icon: [
      { url: '/pwa-192x192.png', sizes: '192x192', type: 'image/png' },
      { url: '/pwa-512x512.png', sizes: '512x512', type: 'image/png' },
      { url: '/icon.svg', type: 'image/svg+xml' },
    ],
    apple: [{ url: '/apple-touch-icon.png', sizes: '180x180', type: 'image/png' }],
  },
  openGraph: {
    title: 'FitForge — AI Fitness, 3D Workout & GPS Run Tracker',
    description:
      'Platform kebugaran terpadu dengan Studio Latihan 3D 1024-Bit HD, Pelacak Lari GPS (Kalman & Haversine), Analisis Nutrisi AI kuliner Indonesia, Poster Rencana Latihan Mingguan, serta Jadwal Sholat & Hidrasi.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FitForge — AI Fitness, 3D Workout & GPS Run Tracker',
    description:
      'Platform kebugaran terpadu dengan Studio Latihan 3D 1024-Bit HD, Pelacak Lari GPS (Kalman & Haversine), Analisis Nutrisi AI kuliner Indonesia, Poster Rencana Latihan Mingguan, serta Jadwal Sholat & Hidrasi.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="id" className={`${plusJakarta.variable} ${bebasNeue.variable}`}>
      <body
        suppressHydrationWarning
        className="font-sans antialiased selection:bg-[#F97316] selection:text-black"
        style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}
      >
        <FirebaseAuthProvider>
          {children}
          <WelcomeGuideModal />
        </FirebaseAuthProvider>
      </body>
    </html>
  );
}
