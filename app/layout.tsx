import type { Metadata, Viewport } from 'next';
import { Plus_Jakarta_Sans, Bebas_Neue, JetBrains_Mono } from 'next/font/google';
import { FirebaseAuthProvider } from '@/components/auth/FirebaseAuthProvider';
import { WelcomeGuideModal } from '@/components/guide/WelcomeGuideModal';
import { MotionAndThemeProvider } from '@/components/providers/MotionAndThemeProvider';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-jakarta',
  display: 'swap',
});

const bebasNeue = Bebas_Neue({
  subsets: ['latin'],
  weight: ['400'],
  variable: '--font-poster',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-mono',
  display: 'swap',
});

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: dark)', color: '#0B0D0E' },
    { media: '(prefers-color-scheme: light)', color: '#F7F8F6' },
  ],
  width: 'device-width',
  initialScale: 1,
  maximumScale: 5,
  viewportFit: 'cover',
};

export const metadata: Metadata = {
  title: 'FitForge — Studio Latihan 3D, Lari GPS & Nutrisi AI',
  description:
    'Platform kebugaran terpadu dengan Studio Latihan 3D interaktif, Pelacak Lari GPS presisi (Kalman & Haversine), Pemindai Nutrisi AI kuliner Indonesia, Poster Rencana Latihan Mingguan, serta Jadwal Sholat & Hidrasi.',
  manifest: '/manifest.webmanifest',
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
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
    title: 'FitForge — Studio Latihan 3D, Lari GPS & Nutrisi AI',
    description:
      'Platform kebugaran terpadu dengan Studio Latihan 3D interaktif, Pelacak Lari GPS presisi, Analisis Nutrisi AI kuliner Indonesia, serta Jadwal Sholat & Hidrasi.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'FitForge — Studio Latihan 3D, Lari GPS & Nutrisi AI',
    description:
      'Platform kebugaran terpadu dengan Studio Latihan 3D interaktif, Pelacak Lari GPS presisi, Analisis Nutrisi AI kuliner Indonesia, serta Jadwal Sholat & Hidrasi.',
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="id"
      className={`${plusJakarta.variable} ${bebasNeue.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body
        suppressHydrationWarning
        className="font-sans antialiased selection:bg-[#84E818] selection:text-[#0D0F10]"
        style={{ fontFamily: 'var(--font-jakarta), sans-serif' }}
      >
        <MotionAndThemeProvider>
          <FirebaseAuthProvider>
            {children}
            <WelcomeGuideModal />
          </FirebaseAuthProvider>
        </MotionAndThemeProvider>
      </body>
    </html>
  );
}
