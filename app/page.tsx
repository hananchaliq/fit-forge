'use client';

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useScroll, useTransform, AnimatePresence } from 'motion/react';
import {
  ArrowRight,
  ArrowUpRight,
  Box,
  Bone,
  MapPin,
  Utensils,
  BellRing,
  Activity,
  BookOpen,
  LayoutDashboard,
  CalendarRange,
  Cpu,
  Compass,
  Flame,
  ShieldCheck,
  Sparkles,
  Volume2,
  Database,
  Layers,
  Clock,
  Sun,
  Moon,
  Loader2,
} from 'lucide-react';
import { signInWithGoogleSafe } from '@/lib/firebase';
import { useFitForgeStore } from '@/store/useFitForgeStore';
import { BiomechanicalLoader } from '@/components/ui/BiomechanicalLoader';
import { Canvas3DErrorBoundary } from '@/components/ui/Canvas3DErrorBoundary';
import {
  ScrollProgressBar,
  MotionReveal,
  MotionLine,
  MotionCounter,
  MotionCard,
  MotionIconBox,
  MotionProgressBar,
  MOTION_SPRING,
} from '@/components/ui/MotionPrimitives';
import HeroRunner3D from '@/components/landing/HeroRunner3D';
import type { MannequinDisplayMode } from '@/components/workout3d/TrainerStudio3D';

const ECOSYSTEM_MODULES = [
  {
    href: '/workout',
    title: 'Studio Latihan 3D',
    icon: Box,
    desc: 'Rig anatomi 22-tulang dengan sorotan otot primer & sekunder, kontrol tempo 0.5×–1.5×, serta mode tulang X-Ray.',
  },
  {
    href: '/run',
    title: 'Pelacak Lari GPS',
    icon: MapPin,
    desc: 'Filter Kalman 1D, jarak geodesik Haversine, checkpoint IndexedDB tiap detik, dan Voice Coach Bahasa Indonesia.',
  },
  {
    href: '/nutrisi',
    title: 'Nutrisi AI Nusantara',
    icon: Utensils,
    desc: 'Analisis foto atau teks masakan Indonesia real-time via Gemini API lengkap dengan rincian makro dan transparansi token.',
  },
  {
    href: '/jadwal',
    title: 'Sholat & Hidrasi',
    icon: BellRing,
    desc: 'Jadwal sholat Kemenag RI otomatis sesuai kota, alarm bangun bertahap Web Audio, serta pengingat hidrasi berkala.',
  },
];

const FEATURED_SHOWCASE = [
  {
    index: '01',
    href: '/workout',
    title: 'Studio 3D Biomekanik',
    meta: '56 Latihan · 22-Bone IK · 4 Sudut Kamera',
    desc: 'Mannequin anatomis proporsi 180 cm dengan 56 gerakan unik—dilengkapi mode Otot, X-Ray, dan Kerangka Tulang.',
    metricLabel: 'Gerakan Terverifikasi',
    metricVal: '56',
    metricSub: 'Split Gym & Rumah',
    visualTitle: 'Anatomi Presisi untuk Form Sempurna',
    visualSub: 'Interactive WebGL PBR Studio',
    bars: [72, 88, 64, 96, 82],
  },
  {
    index: '02',
    href: '/run',
    title: 'Telemetri Lari GPS',
    meta: 'Kalman 1D · Haversine · Offline Cache',
    desc: 'Pelacakan rute lari luar ruangan dengan pemulusan sinyal GPS, split pace per kilometer, dan ekspor kartu ringkasan.',
    metricLabel: 'Akurasi Filter Sinyal',
    metricVal: '1 Hz',
    metricSub: 'Checkpoint IndexedDB',
    visualTitle: 'Lacak. Analisis. Tingkatkan Pace.',
    visualSub: 'Geodesic Route Telemetry',
    bars: [54, 68, 76, 84, 95],
  },
  {
    index: '03',
    href: '/nutrisi',
    title: 'Pemindai Nutrisi Gemini',
    meta: 'Real-Time API · Kuliner Lokal · Info Token',
    desc: 'Estimasi kalori, protein, karbohidrat, lemak, dan serat secara langsung dari foto atau deskripsi hidangan harian.',
    metricLabel: 'Transparansi Model',
    metricVal: '100%',
    metricSub: 'Tanpa Fallback Palsu',
    visualTitle: 'Nutrisi Terukur untuk Pemulihan Otot',
    visualSub: 'Gemini Vision & Macro Engine',
    bars: [80, 92, 70, 86, 94],
  },
];

const TECH_PILLARS = [
  { label: 'Three.js WebGL', icon: Box },
  { label: '22-Bone IK', icon: Bone },
  { label: 'Kalman 1D GPS', icon: Compass },
  { label: 'Gemini AI', icon: Sparkles },
  { label: 'Kemenag RI', icon: Clock },
  { label: 'IndexedDB', icon: Database },
  { label: 'Web Audio', icon: Volume2 },
  { label: 'PWA Offline', icon: ShieldCheck },
];

const CAPABILITY_METERS = [
  { label: 'Akurasi Kinematik 22-Bone IK', percent: 100 },
  { label: 'Stabilitas Sinyal GPS Kalman 1D', percent: 96 },
  { label: 'Cakupan Split Latihan 7 Hari', percent: 100 },
  { label: 'Analisis Makro Kuliner Indonesia', percent: 95 },
  { label: 'Kesiapan Mode Offline & PWA', percent: 98 },
  { label: 'Sinkronisasi Jadwal Sholat & Air', percent: 100 },
];

const JOURNEY_STEPS = [
  {
    step: '01',
    phase: 'Langkah 01',
    title: 'Masuk Akun Google',
    body: 'Profil cloud pribadi dibuat otomatis dengan seluruh metrik dimulai bersih dari angka 0.',
  },
  {
    step: '02',
    phase: 'Langkah 02',
    title: 'Atur Profil & Kota',
    body: 'Sesuaikan berat, tinggi, target kebugaran, serta lokasi kota untuk jadwal sholat Kemenag RI.',
  },
  {
    step: '03',
    phase: 'Langkah 03',
    title: 'Latihan 3D & Lari GPS',
    body: 'Ikuti form gerakan di Studio 3D ber-IK dan rekam rute lari GPS dengan Voice Coach aktif.',
  },
  {
    step: '04',
    phase: 'Langkah 04',
    title: 'Nutrisi & 5 Golden Rules',
    body: 'Pindai makanan harian via Gemini AI, tambah hidrasi +250ml, dan bangun konsistensi streak.',
  },
];

const emptySubscribe = () => () => {};

export default function LandingPage() {
  const router = useRouter();
  const {
    isAuthenticated,
    profile,
    darkMode,
    toggleDarkMode,
    setGuideOpen,
    hasCompletedOnboarding,
  } = useFitForgeStore();
  const [heroDisplayMode, setHeroDisplayMode] = useState<MannequinDisplayMode>('muscle');
  const [authLoading, setAuthLoading] = useState(false);
  const heroMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const { scrollY } = useScroll();
  const haloY = useTransform(scrollY, [0, 700], [0, 72]);
  const haloScale = useTransform(scrollY, [0, 700], [1, 1.08]);

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', darkMode);
    }
  }, [darkMode]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        router.replace('/dashboard');
      }
    }
  }, [router]);

  const handleQuickGoogleLogin = async () => {
    if (authLoading) return;
    setAuthLoading(true);
    try {
      const res = await signInWithGoogleSafe();
      if (res.ok) {
        setGuideOpen(true);
        router.push(hasCompletedOnboarding ? '/dashboard' : '/onboarding');
        return;
      }
      const params = new URLSearchParams();
      if (res.code) params.set('authError', res.code);
      if (res.isEmbeddedIframe) params.set('iframe', '1');
      router.push(`/login?${params.toString()}`);
    } finally {
      setAuthLoading(false);
    }
  };

  return (
    <div className="min-h-dvh bg-[#F7F8F6] dark:bg-[#0B0D0E] text-[#0D0F10] dark:text-[#F5F7F5] relative overflow-x-clip">
      <ScrollProgressBar />

      {/* =====================================================================
          TOP NAVIGATION BAR — CLEAN 3-ZONE EDITORIAL HEADER
          ===================================================================== */}
      <header className="sticky top-0 z-30 pt-safe bg-white/92 dark:bg-[#0B0D0E]/92 backdrop-blur-md border-b border-[#E6E8E4] dark:border-[#1E2328]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Geometric Brand Mark (Obsidian in Light <-> Crisp White in Dark) */}
          <Link
            href="/"
            className="flex items-center gap-2.5 min-h-[44px] whitespace-nowrap shrink-0 group"
          >
            <motion.div
              whileHover={{ rotate: -6, scale: 1.06 }}
              whileTap={{ scale: 0.94 }}
              transition={MOTION_SPRING}
              className="w-8 h-8 rounded-lg bg-[#0D0F10] dark:bg-[#F7F8F6] flex items-center justify-center shrink-0"
            >
              <span className="font-extrabold text-sm tracking-tighter text-[#84E818] dark:text-[#0D0F10]">
                FF
              </span>
            </motion.div>
            <span className="text-[17px] font-extrabold tracking-tight text-[#0D0F10] dark:text-white">
              FitForge
            </span>
          </Link>

          {/* Zone 2: 5 Clean Single-Line Nav Links */}
          <nav
            className="hidden md:flex items-center gap-7 text-sm font-medium text-[#5A6068] dark:text-[#9AA2AC]"
            aria-label="Navigasi Utama"
          >
            {[
              { href: '/dashboard', label: 'Dashboard' },
              { href: '/workout', label: 'Studio 3D' },
              { href: '/run', label: 'Lari GPS' },
              { href: '/nutrisi', label: 'Nutrisi AI' },
              { href: '/plan', label: 'Rencana 7H' },
            ].map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className="group relative py-2 hover:text-[#0D0F10] dark:hover:text-white transition-colors whitespace-nowrap shrink-0"
              >
                <span>{item.label}</span>
                <span className="absolute bottom-1 left-0 right-0 h-[2px] bg-[#84E818] scale-x-0 group-hover:scale-x-100 transition-transform duration-200 origin-left rounded-full" />
              </Link>
            ))}
          </nav>

          {/* Zone 3: Theme Toggle + Polarity-Inverted Primary Pill CTA */}
          <div className="flex items-center gap-2 shrink-0">
            <motion.button
              type="button"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.92 }}
              transition={MOTION_SPRING}
              onClick={toggleDarkMode}
              aria-label={darkMode ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
              title={darkMode ? 'Mode Terang' : 'Mode Gelap'}
              className="w-10 h-10 rounded-full bg-[#F5F7F4] dark:bg-[#131618] hover:bg-[#EAECE8] dark:hover:bg-[#1B1F23] border border-[#E3E6E0] dark:border-[#23282D] flex items-center justify-center transition cursor-pointer shrink-0 overflow-hidden"
            >
              <AnimatePresence mode="wait" initial={false}>
                {darkMode ? (
                  <motion.span
                    key="sun"
                    initial={{ rotate: -60, opacity: 0, scale: 0.6 }}
                    animate={{ rotate: 0, opacity: 1, scale: 1 }}
                    exit={{ rotate: 60, opacity: 0, scale: 0.6 }}
                    transition={MOTION_SPRING}
                    className="inline-flex"
                  >
                    <Sun className="w-4 h-4 text-[#84E818]" />
                  </motion.span>
                ) : (
                  <motion.span
                    key="moon"
                    initial={{ rotate: 60, opacity: 0, scale: 0.6 }}
                    animate={{ rotate: 0, opacity: 1, scale: 1 }}
                    exit={{ rotate: -60, opacity: 0, scale: 0.6 }}
                    transition={MOTION_SPRING}
                    className="inline-flex"
                  >
                    <Moon className="w-4 h-4 text-[#0D0F10]" />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

            {isAuthenticated ? (
              <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} transition={MOTION_SPRING}>
                <Link
                  href="/dashboard"
                  className="group inline-flex items-center gap-2 min-h-[40px] px-4 sm:px-5 rounded-full bg-[#0D0F10] dark:bg-[#F7F8F6] text-white dark:text-[#0D0F10] text-xs sm:text-sm font-bold hover:opacity-92 transition whitespace-nowrap shrink-0"
                >
                  <span className="max-w-[110px] sm:max-w-none truncate">
                    {profile.displayName.split(' ')[0]}
                  </span>
                  <ArrowRight className="w-4 h-4 text-[#84E818] dark:text-[#448500] group-hover:translate-x-0.5 transition-transform shrink-0" />
                </Link>
              </motion.div>
            ) : (
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                transition={MOTION_SPRING}
                disabled={authLoading}
                onClick={handleQuickGoogleLogin}
                className="group inline-flex items-center gap-2 min-h-[40px] px-4 sm:px-5 rounded-full bg-[#0D0F10] dark:bg-[#F7F8F6] text-white dark:text-[#0D0F10] text-xs sm:text-sm font-bold hover:opacity-92 disabled:opacity-60 transition whitespace-nowrap shrink-0 cursor-pointer"
              >
                {authLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#84E818] dark:text-[#448500] shrink-0" />
                ) : null}
                <span>{authLoading ? 'Menghubungkan...' : 'Mulai Sekarang'}</span>
                {!authLoading && (
                  <ArrowRight className="w-4 h-4 text-[#84E818] dark:text-[#448500] group-hover:translate-x-1 transition-transform shrink-0" />
                )}
              </motion.button>
            )}
          </div>
        </div>
      </header>

      {/* =====================================================================
          HERO SECTION — GALLERY WHITE CANVAS + SOFT VOLT-LIME HALO + 3D STAGE
          ===================================================================== */}
      <section className="relative z-10 overflow-hidden bg-gradient-to-b from-white via-[#F7F8F6] to-[#F7F8F6] dark:from-[#0B0D0E] dark:via-[#0B0D0E] dark:to-[#0B0D0E]">
        {/* Architectural Soft Ambient Lime Aura behind Hero 3D Stage */}
        <motion.div
          aria-hidden="true"
          style={{ y: haloY, scale: haloScale }}
          className="pointer-events-none absolute right-[-60px] lg:right-[6%] top-12 w-[360px] sm:w-[460px] lg:w-[540px] h-[360px] sm:h-[460px] lg:h-[540px] rounded-full blur-[90px] opacity-45 dark:opacity-20 will-change-transform"
        >
          <div className="w-full h-full rounded-full bg-gradient-to-br from-[#A6FA3C] via-[#84E818] to-[#D9FCA2]" />
        </motion.div>

        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 pt-10 pb-14 lg:pt-14 lg:pb-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-center">
            {/* LEFT COLUMN: Editorial Headline, Dual CTAs & Animated Counter KPIs */}
            <div className="lg:col-span-7 space-y-6 min-w-0 relative z-10">
              <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[11px] sm:text-xs font-semibold tracking-[0.06em] text-[#5A6068] dark:text-[#9AA2AC]">
                <span>Studio 3D Anatomi</span>
                <span className="text-[#448500] dark:text-[#84E818]" aria-hidden="true">·</span>
                <span>Pelacak Lari GPS</span>
                <span className="text-[#448500] dark:text-[#84E818]" aria-hidden="true">·</span>
                <span>Nutrisi Gemini AI</span>
                <span className="text-[#448500] dark:text-[#84E818]" aria-hidden="true">·</span>
                <span>Sholat &amp; Hidrasi</span>
              </div>

              <h1 className="text-fluid-display font-extrabold tracking-[-0.035em] text-[#0D0F10] dark:text-white leading-[1.01]">
                MEMBANGUN{' '}
                <span className="text-[#72D60C] dark:text-[#84E818]">PERFORMA</span>{' '}
                TUBUH TERUKUR.
              </h1>

              <p className="text-sm sm:text-base lg:text-[17px] text-[#525860] dark:text-[#A4ACB5] max-w-xl leading-relaxed">
                Platform kebugaran terpadu yang menyatukan panduan anatomi 3D 22-tulang, pelacakan rute lari GPS berfilter Kalman, pemindai nutrisi masakan Indonesia berbasis Gemini AI real-time, serta jadwal sholat dan hidrasi.
              </p>

              {/* CTA Row: Polarity-Inverted Primary Pill + Crisp Outlined Secondary */}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                {isAuthenticated ? (
                  <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} transition={MOTION_SPRING}>
                    <Link
                      href="/dashboard"
                      className="group inline-flex items-center justify-center gap-3 min-h-[48px] px-6 rounded-full bg-[#0D0F10] dark:bg-[#F7F8F6] text-white dark:text-[#0D0F10] font-bold text-sm shadow-sm hover:opacity-92 transition whitespace-nowrap"
                    >
                      <span>Buka Dashboard</span>
                      <ArrowRight className="w-4 h-4 text-[#84E818] dark:text-[#448500] group-hover:translate-x-1 transition-transform" />
                    </Link>
                  </motion.div>
                ) : (
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    transition={MOTION_SPRING}
                    disabled={authLoading}
                    onClick={handleQuickGoogleLogin}
                    className="group inline-flex items-center justify-center gap-3 min-h-[48px] px-6 rounded-full bg-[#0D0F10] dark:bg-[#F7F8F6] text-white dark:text-[#0D0F10] font-bold text-sm shadow-sm hover:opacity-92 disabled:opacity-60 transition whitespace-nowrap cursor-pointer"
                  >
                    {authLoading ? (
                      <Loader2 className="w-4 h-4 animate-spin text-[#84E818] dark:text-[#448500]" />
                    ) : null}
                    <span>{authLoading ? 'Menghubungkan...' : 'Mulai Latihan'}</span>
                    {!authLoading && (
                      <ArrowRight className="w-4 h-4 text-[#84E818] dark:text-[#448500] group-hover:translate-x-1 transition-transform" />
                    )}
                  </motion.button>
                )}

                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02, y: -1 }}
                  whileTap={{ scale: 0.97 }}
                  transition={MOTION_SPRING}
                  onClick={() => setGuideOpen(true)}
                  className="inline-flex items-center justify-center gap-2 min-h-[48px] px-5 rounded-full bg-white dark:bg-[#131618] hover:bg-[#F1F3EF] dark:hover:bg-[#1B1F23] border border-[#DFE2DC] dark:border-[#262B30] text-[#0D0F10] dark:text-white font-semibold text-sm transition whitespace-nowrap cursor-pointer"
                >
                  <BookOpen className="w-4 h-4 text-[#448500] dark:text-[#84E818]" />
                  <span>Panduan</span>
                </motion.button>

                <Link
                  href="/workout"
                  className="group inline-flex items-center gap-1.5 min-h-[44px] px-2 text-xs sm:text-sm font-semibold text-[#525860] dark:text-[#A4ACB5] hover:text-[#0D0F10] dark:hover:text-white transition-colors whitespace-nowrap"
                >
                  <span>Coba Studio 3D</span>
                  <ArrowUpRight className="w-4 h-4 text-[#448500] dark:text-[#84E818] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                </Link>
              </div>

              {/* 3 Architectural KPI Counters Separated by Animated Vertical Hairlines */}
              <div className="pt-4">
                <MotionLine className="mb-6" />
                <div className="grid grid-cols-3 gap-4 sm:gap-6 max-w-lg">
                  <div className="min-w-0">
                    <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0D0F10] dark:text-white font-telemetry">
                      <MotionCounter value={56} suffix="+" durationMs={620} />
                    </p>
                    <p className="text-xs text-[#5A6068] dark:text-[#9AA2AC] mt-1 leading-snug">
                      Gerakan 3D Terverifikasi
                    </p>
                  </div>

                  <div className="relative pl-4 sm:pl-6 min-w-0">
                    <MotionLine
                      orientation="vertical"
                      delay={0.12}
                      className="absolute left-0 top-0.5 bottom-0.5"
                    />
                    <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0D0F10] dark:text-white font-telemetry">
                      <MotionCounter value={22} durationMs={680} delayMs={60} />
                    </p>
                    <p className="text-xs text-[#5A6068] dark:text-[#9AA2AC] mt-1 leading-snug">
                      Tulang &amp; Sendi IK Rig
                    </p>
                  </div>

                  <div className="relative pl-4 sm:pl-6 min-w-0">
                    <MotionLine
                      orientation="vertical"
                      delay={0.22}
                      className="absolute left-0 top-0.5 bottom-0.5"
                    />
                    <p className="text-2xl sm:text-3xl font-extrabold tracking-tight text-[#0D0F10] dark:text-white font-telemetry">
                      <MotionCounter value={7} suffix="H" durationMs={560} delayMs={120} />
                    </p>
                    <p className="text-xs text-[#5A6068] dark:text-[#9AA2AC] mt-1 leading-snug">
                      Split Gym &amp; Rumah
                    </p>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Glowing Lime Circular Disc + Sculpted 3D Mannequin Stage + Glass Callout */}
            <div className="lg:col-span-5 min-w-0 relative">
              {/* Crisp Soft Volt-Lime Circle Disc echoing Reference Image Hero Composition */}
              <div
                aria-hidden="true"
                className="pointer-events-none hidden sm:block absolute -right-4 top-10 w-64 h-64 rounded-full bg-gradient-to-br from-[#A6FA3C]/55 to-[#84E818]/25 dark:from-[#84E818]/20 dark:to-transparent"
              />
              {/* Architectural precision crosshair marks */}
              <span
                aria-hidden="true"
                className="pointer-events-none hidden lg:block absolute -top-5 -right-5 text-[#65C80B] dark:text-[#84E818] text-lg font-light select-none"
              >
                +
              </span>
              <span
                aria-hidden="true"
                className="pointer-events-none hidden lg:block absolute -bottom-5 -left-5 text-[#84E818] text-base font-light select-none"
              >
                +
              </span>

              <motion.div
                initial={false}
                whileHover={{ y: -3 }}
                transition={MOTION_SPRING}
                className="relative rounded-xl bg-[#0D0F10] dark:bg-[#14171A] border border-[#22272C] dark:border-[#2C333A] p-3 shadow-[0_24px_60px_rgba(13,15,16,0.16)] dark:shadow-[0_24px_60px_rgba(0,0,0,0.55)] overflow-hidden"
              >
                {/* Subtle radial lime spotlight inside stage */}
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -top-12 right-0 w-56 h-56 rounded-full opacity-25 blur-[65px]"
                  style={{
                    background: 'radial-gradient(circle, #84E818 0%, transparent 72%)',
                  }}
                />

                {/* Top Control Strip: Mode Switcher */}
                <div className="relative z-10 flex items-center justify-between gap-2 px-1.5 sm:px-2 pb-2.5 border-b border-white/10">
                  <div className="flex items-center gap-1.5 sm:gap-2 min-w-0">
                    <span className="w-1.5 h-1.5 rounded-[2px] bg-[#84E818] shrink-0" />
                    <span className="text-xs font-semibold text-neutral-200 whitespace-nowrap">
                      Mannequin 3D
                      <span className="hidden sm:inline text-neutral-400"> · Sprint Rig</span>
                    </span>
                  </div>

                  <div
                    className="inline-flex rounded-lg bg-white/[0.06] p-0.5 border border-white/10 shrink-0"
                    role="group"
                    aria-label="Mode tampilan mannequin 3D"
                  >
                    {(
                      [
                        { key: 'muscle', label: 'Otot' },
                        { key: 'xray', label: 'X-Ray' },
                        { key: 'skeleton', label: 'Tulang' },
                      ] as const
                    ).map((m) => (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setHeroDisplayMode(m.key)}
                        className={`relative min-h-[30px] px-2 sm:px-2.5 py-1 rounded-md text-[11px] font-bold flex items-center gap-1 transition-colors cursor-pointer whitespace-nowrap ${
                          heroDisplayMode === m.key
                            ? 'text-[#0D0F10]'
                            : 'text-neutral-300 hover:text-white'
                        }`}
                      >
                        {heroDisplayMode === m.key && (
                          <motion.span
                            layoutId="hero-displaymode-pill"
                            transition={MOTION_SPRING}
                            className="absolute inset-0 rounded-md bg-[#84E818]"
                          />
                        )}
                        {m.key === 'skeleton' && (
                          <Bone className="relative z-10 w-3 h-3 shrink-0" />
                        )}
                        <span className="relative z-10">{m.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                {/* 3D Canvas Stage */}
                <div className="relative">
                  <Canvas3DErrorBoundary
                    title="Mannequin Biomekanik 3D FitForge"
                    description="Mode pratinjau hemat daya aktif. Buka Studio 3D untuk latihan interaktif penuh."
                    heightClass="h-[340px] sm:h-[420px]"
                  >
                    {heroMounted ? (
                      <HeroRunner3D displayMode={heroDisplayMode} />
                    ) : (
                      <BiomechanicalLoader
                        compact
                        label="MEMUAT VISUALISASI 3D"
                        sublabel="Menyiapkan Mannequin PBR & Kerangka Tulang..."
                      />
                    )}
                  </Canvas3DErrorBoundary>

                  {/* Polarity-Inverted Corner Callout (Dark in Light Mode <-> White in Dark Mode) */}
                  <Link
                    href="/workout"
                    className="group absolute bottom-3 right-3 z-20 w-[184px] rounded-xl bg-[#16191D]/90 dark:bg-[#F7F8F6]/94 backdrop-blur-md border border-white/12 dark:border-[#DDE1DA] p-3 text-white dark:text-[#0D0F10] hover:border-[#84E818] transition-colors"
                  >
                    <div className="flex items-center justify-between mb-2">
                      <span className="w-5 h-5 rounded-md bg-[#84E818] text-[#0D0F10] flex items-center justify-center">
                        <Activity className="w-3 h-3 stroke-[2.6]" />
                      </span>
                      <ArrowRight className="w-3.5 h-3.5 text-neutral-300 dark:text-[#5A6068] group-hover:text-[#84E818] dark:group-hover:text-[#448500] group-hover:translate-x-0.5 transition-all" />
                    </div>
                    <p className="text-[11px] font-semibold leading-snug text-neutral-100 dark:text-[#0D0F10]">
                      Ubah gerakan rutin menjadi progres otot terukur.
                    </p>
                  </Link>
                </div>

                <div className="relative z-10 flex items-center justify-between gap-2 px-2.5 pt-2.5 border-t border-white/10 text-[11px] text-neutral-400">
                  <span>
                    {heroDisplayMode === 'skeleton'
                      ? 'Mode Tulang · Sendi Fleksibel'
                      : heroDisplayMode === 'xray'
                      ? 'Mode X-Ray · Otot & Kerangka'
                      : 'Tekstur PBR · Gerak Sprint Fleksibel'}
                  </span>
                  <span className="text-[#84E818] font-semibold">Geser untuk putar 3D</span>
                </div>
              </motion.div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          TRUST & ENGINE STRIP — CRISP FULL-WIDTH BORDERED BAR
          ===================================================================== */}
      <section className="relative z-10 bg-white dark:bg-[#101315] border-y border-[#E6E8E4] dark:border-[#1E2328]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-4 sm:py-5">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-center gap-2 text-[11px] font-semibold tracking-[0.08em] uppercase text-[#5A6068] dark:text-[#9AA2AC] shrink-0">
              <Cpu className="w-3.5 h-3.5 text-[#448500] dark:text-[#84E818]" />
              <span>Ditenagai Arsitektur Presisi</span>
            </div>

            <div className="flex flex-wrap items-center gap-x-6 sm:gap-x-8 gap-y-2.5 text-xs sm:text-sm font-bold text-[#272C30] dark:text-neutral-200">
              {TECH_PILLARS.slice(0, 6).map((item) => {
                const Icon = item.icon;
                return (
                  <motion.span
                    key={item.label}
                    whileHover={{ y: -1.5 }}
                    transition={MOTION_SPRING}
                    className="inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Icon className="w-3.5 h-3.5 text-[#5A6068] dark:text-[#9AA2AC]" />
                    <span>{item.label}</span>
                  </motion.span>
                );
              })}
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          SECTION 1: 4-COLUMN ARCHITECTURAL FEATURE GRID ("EKOSISTEM YANG BEKERJA.")
          ===================================================================== */}
      <section className="relative z-10 max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.06em] uppercase text-[#5A6068] dark:text-[#9AA2AC] mb-2">
              <span className="w-1.5 h-1.5 rounded-[2px] bg-[#84E818]" />
              <span>Ekosistem FitForge</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-[-0.03em] text-[#0D0F10] dark:text-white leading-[1.06] text-balance">
              FITUR PRESISI YANG{' '}
              <span className="text-[#72D60C] dark:text-[#84E818]">BEKERJA NYATA.</span>
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 lg:gap-8 max-w-lg text-left">
            <p className="text-xs sm:text-sm text-[#5A6068] dark:text-[#9AA2AC] leading-relaxed max-w-sm">
              Dari panduan form 3D hingga pencatatan lari GPS, nutrisi kuliner Nusantara, dan pengingat ibadah harian dalam satu sistem ringan.
            </p>
            <Link
              href="/plan"
              className="group inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0D0F10] dark:text-white hover:text-[#448500] dark:hover:text-[#84E818] whitespace-nowrap shrink-0"
            >
              <span>Lihat Rencana</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#448500] dark:text-[#84E818] group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {ECOSYSTEM_MODULES.map((mod, idx) => {
            const Icon = mod.icon;
            return (
              <MotionReveal key={mod.href} delay={idx * 0.06}>
                <MotionCard className="h-full">
                  <Link
                    href={mod.href}
                    className="group h-full rounded-xl bg-white dark:bg-[#131618] border border-[#E3E6E0] dark:border-[#23282D] hover:border-[#84E818] dark:hover:border-[#84E818]/70 p-6 transition-colors flex flex-col justify-between shadow-[0_2px_12px_rgba(13,15,16,0.03)] hover:shadow-[0_14px_30px_rgba(13,15,16,0.07)] min-w-0"
                  >
                    <div>
                      <div className="flex items-center justify-between mb-6">
                        <MotionIconBox className="w-10 h-10 rounded-lg bg-[#F5F7F4] dark:bg-[#1B1F23] border border-[#E3E6E0] dark:border-[#2A3036] group-hover:bg-[#0D0F10] dark:group-hover:bg-[#F7F8F6] group-hover:border-[#0D0F10] dark:group-hover:border-[#F7F8F6] flex items-center justify-center transition-colors">
                          <Icon className="w-4 h-4 text-[#0D0F10] dark:text-[#F5F7F5] group-hover:text-[#84E818] dark:group-hover:text-[#0D0F10] transition-colors" />
                        </MotionIconBox>

                        <ArrowRight className="w-4 h-4 text-[#9AA2AC] group-hover:text-[#0D0F10] dark:group-hover:text-[#84E818] group-hover:translate-x-1 transition-all" />
                      </div>

                      <h3 className="text-base font-extrabold text-[#0D0F10] dark:text-white tracking-tight">
                        {mod.title}
                      </h3>
                      <p className="text-xs sm:text-[13px] text-[#5A6068] dark:text-[#9AA2AC] mt-2 leading-relaxed">
                        {mod.desc}
                      </p>
                    </div>

                    <div className="mt-6 pt-3 border-t border-[#EFF1EE] dark:border-[#1E2328] flex items-center justify-between text-xs font-bold text-[#448500] dark:text-[#84E818]">
                      <span>Buka Modul</span>
                      <ArrowUpRight className="w-3.5 h-3.5 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
                    </div>
                  </Link>
                </MotionCard>
              </MotionReveal>
            );
          })}
        </div>
      </section>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
        <MotionLine />
      </div>

      {/* =====================================================================
          SECTION 2: 3-COLUMN INDEXED SHOWCASE ("MODUL UNGGULAN. DAMPAK NYATA.")
          ===================================================================== */}
      <section className="relative z-10 max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <div className="flex flex-col lg:flex-row lg:items-end justify-between gap-6 mb-10">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.06em] uppercase text-[#5A6068] dark:text-[#9AA2AC] mb-2">
              <span className="w-1.5 h-1.5 rounded-[2px] bg-[#84E818]" />
              <span>Modul Utama</span>
            </div>
            <h2 className="text-2xl sm:text-4xl font-extrabold tracking-[-0.03em] text-[#0D0F10] dark:text-white leading-[1.06] text-balance">
              DATA NYATA.{' '}
              <span className="text-[#72D60C] dark:text-[#84E818]">PROGRES NYATA.</span>
            </h2>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-4 lg:gap-8 max-w-lg text-left">
            <p className="text-xs sm:text-sm text-[#5A6068] dark:text-[#9AA2AC] leading-relaxed max-w-sm">
              Setiap sesi tercatat jujur mulai dari 0—tanpa simulasi palsu, langsung tersinkronisasi dengan target mingguan Anda.
            </p>
            <Link
              href="/dashboard"
              className="group inline-flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-[#0D0F10] dark:text-white hover:text-[#448500] dark:hover:text-[#84E818] whitespace-nowrap shrink-0"
            >
              <span>Buka Dashboard</span>
              <ArrowRight className="w-3.5 h-3.5 text-[#448500] dark:text-[#84E818] group-hover:translate-x-1 transition-transform" />
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-5 sm:gap-6">
          {FEATURED_SHOWCASE.map((card, idx) => (
            <MotionReveal key={card.index} delay={idx * 0.08}>
              <MotionCard className="h-full">
                <Link
                  href={card.href}
                  className="group h-full rounded-xl bg-white dark:bg-[#131618] border border-[#E3E6E0] dark:border-[#23282D] hover:border-[#0D0F10] dark:hover:border-[#F7F8F6]/70 p-4 flex flex-col justify-between transition-colors shadow-[0_2px_16px_rgba(13,15,16,0.035)]"
                >
                  {/* Polarity-Inverted Preview Frame: Obsidian in Light Mode <-> Crisp White in Dark Mode */}
                  <div className="relative rounded-lg bg-[#0D0F10] dark:bg-[#F7F8F6] text-white dark:text-[#0D0F10] p-5 h-[204px] flex flex-col justify-between overflow-hidden mb-5">
                    <div
                      aria-hidden="true"
                      className="pointer-events-none absolute -right-10 -bottom-10 w-44 h-44 rounded-full opacity-25 dark:opacity-35 blur-[48px] group-hover:opacity-45 transition-opacity"
                      style={{
                        background: 'radial-gradient(circle, #84E818 0%, transparent 70%)',
                      }}
                    />

                    <div className="relative z-10 flex items-center justify-between">
                      <span className="inline-flex items-center justify-center w-8 h-8 rounded-lg bg-white dark:bg-[#0D0F10] text-[#0D0F10] dark:text-[#84E818] font-telemetry font-extrabold text-xs">
                        {card.index}
                      </span>
                      <span className="text-[11px] font-telemetry text-neutral-400 dark:text-[#5A6068]">
                        {card.visualSub}
                      </span>
                    </div>

                    <div className="relative z-10 my-auto">
                      <p className="text-base sm:text-lg font-extrabold tracking-tight leading-snug max-w-[85%]">
                        {card.visualTitle}
                      </p>
                    </div>

                    {/* Mini Architectural Telemetry Bars + Corner Circular Action Arrow */}
                    <div className="relative z-10 flex items-end justify-between gap-3">
                      <div>
                        <p className="text-[10px] uppercase tracking-wider text-neutral-400 dark:text-[#5A6068]">
                          {card.metricLabel}
                        </p>
                        <div className="flex items-baseline gap-2 mt-0.5">
                          <span className="text-xl font-extrabold font-telemetry text-[#84E818] dark:text-[#3D7A00]">
                            {card.metricVal}
                          </span>
                          <span className="text-[11px] text-neutral-400 dark:text-[#5A6068]">
                            {card.metricSub}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-end gap-1 h-8 mr-11" aria-hidden="true">
                        {card.bars.map((h, bi) => (
                          <span
                            key={bi}
                            className="w-1.5 rounded-full bg-white/15 dark:bg-[#0D0F10]/12 overflow-hidden flex items-end h-full"
                          >
                            <span
                              className="w-full rounded-full bg-[#84E818] dark:bg-[#5BB808] transition-transform duration-300 group-hover:scale-y-110 origin-bottom"
                              style={{ height: `${h}%` }}
                            />
                          </span>
                        ))}
                      </div>

                      <span className="absolute right-0 bottom-0 w-9 h-9 rounded-full bg-white dark:bg-[#0D0F10] text-[#0D0F10] dark:text-white group-hover:bg-[#84E818] dark:group-hover:bg-[#84E818] dark:group-hover:text-[#0D0F10] flex items-center justify-center transition-colors">
                        <ArrowRight className="w-4 h-4 group-hover:translate-x-0.5 transition-transform" />
                      </span>
                    </div>
                  </div>

                  {/* Clean Card Body */}
                  <div className="px-1.5 pb-1 flex-1 flex flex-col justify-between">
                    <div>
                      <h3 className="text-lg font-extrabold text-[#0D0F10] dark:text-white tracking-tight">
                        {card.title}
                      </h3>
                      <p className="text-[11px] font-semibold text-[#448500] dark:text-[#84E818] mt-1 font-telemetry">
                        {card.meta}
                      </p>
                      <p className="text-xs sm:text-[13px] text-[#5A6068] dark:text-[#9AA2AC] mt-2.5 leading-relaxed">
                        {card.desc}
                      </p>
                    </div>
                  </div>
                </Link>
              </MotionCard>
            </MotionReveal>
          ))}
        </div>
      </section>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
        <MotionLine />
      </div>

      {/* =====================================================================
          SECTION 3: PRECISION ENGINE MATRIX + ANIMATED ELECTRIC-LIME METERS
          ===================================================================== */}
      <section className="relative z-10 max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 lg:gap-12 items-start">
          {/* Left: Heading + 8 Clean Architectural Module Tiles */}
          <div className="lg:col-span-7 space-y-6">
            <div>
              <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.06em] uppercase text-[#5A6068] dark:text-[#9AA2AC] mb-2">
                <span className="w-1.5 h-1.5 rounded-[2px] bg-[#84E818]" />
                <span>Teknologi &amp; Sensor</span>
              </div>
              <h2 className="text-2xl sm:text-4xl font-extrabold tracking-[-0.03em] text-[#0D0F10] dark:text-white leading-[1.06] text-balance">
                DIRANCANG UNTUK{' '}
                <span className="text-[#72D60C] dark:text-[#84E818]">PRESISI HARIAN.</span>
              </h2>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {TECH_PILLARS.map((tech, idx) => {
                const Icon = tech.icon;
                return (
                  <MotionReveal key={tech.label} delay={idx * 0.04}>
                    <motion.div
                      whileHover={{ y: -3, borderColor: '#84E818' }}
                      transition={MOTION_SPRING}
                      className="rounded-xl bg-white dark:bg-[#131618] border border-[#E3E6E0] dark:border-[#23282D] p-4 flex flex-col items-center justify-center text-center gap-2.5 shadow-[0_1px_8px_rgba(13,15,16,0.025)]"
                    >
                      <MotionIconBox className="w-10 h-10 rounded-lg bg-[#F5F7F4] dark:bg-[#1B1F23] flex items-center justify-center">
                        <Icon className="w-4 h-4 text-[#0D0F10] dark:text-[#84E818]" />
                      </MotionIconBox>
                      <span className="text-xs font-bold text-[#0D0F10] dark:text-neutral-200 whitespace-nowrap">
                        {tech.label}
                      </span>
                    </motion.div>
                  </MotionReveal>
                );
              })}
            </div>
          </div>

          {/* Right: Core Capabilities Card with Animated Electric-Lime Bars & Counters */}
          <MotionReveal delay={0.1} className="lg:col-span-5">
            <div className="rounded-xl bg-white dark:bg-[#131618] border border-[#E3E6E0] dark:border-[#23282D] p-6 sm:p-7 shadow-[0_4px_24px_rgba(13,15,16,0.035)]">
              <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-2 text-xs font-extrabold uppercase tracking-[0.08em] text-[#0D0F10] dark:text-white">
                  <span className="w-1.5 h-1.5 rounded-[2px] bg-[#84E818]" />
                  <span>Kapabilitas Inti</span>
                </div>
                <Layers className="w-4 h-4 text-[#5A6068] dark:text-[#9AA2AC]" />
              </div>

              <div className="space-y-4">
                {CAPABILITY_METERS.map((cap, idx) => (
                  <div key={cap.label} className="space-y-1.5">
                    <div className="flex items-center justify-between gap-2 text-xs">
                      <span className="font-semibold text-[#2A3036] dark:text-neutral-200">
                        {cap.label}
                      </span>
                      <span className="font-telemetry font-bold text-[#448500] dark:text-[#84E818] shrink-0">
                        <MotionCounter
                          value={cap.percent}
                          suffix="%"
                          durationMs={850}
                          delayMs={idx * 70}
                        />
                      </span>
                    </div>
                    <MotionProgressBar
                      percent={cap.percent}
                      inView
                      delay={idx * 0.08}
                      className="h-1.5"
                    />
                  </div>
                ))}
              </div>
            </div>
          </MotionReveal>
        </div>
      </section>

      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8">
        <MotionLine />
      </div>

      {/* =====================================================================
          SECTION 4: 4-STEP HORIZONTAL JOURNEY WITH ANIMATED DRAWING LINE RAIL
          ===================================================================== */}
      <section className="relative z-10 max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-start">
          <div className="lg:col-span-3">
            <div className="flex items-center gap-2 text-xs font-semibold tracking-[0.06em] uppercase text-[#5A6068] dark:text-[#9AA2AC] mb-2">
              <span className="w-1.5 h-1.5 rounded-[2px] bg-[#84E818]" />
              <span>Alur Memulai</span>
            </div>
            <h2 className="text-2xl sm:text-3xl font-extrabold tracking-[-0.03em] text-[#0D0F10] dark:text-white leading-[1.08] text-balance">
              RITME SEHAT &amp;{' '}
              <span className="text-[#72D60C] dark:text-[#84E818]">KONSISTENSI.</span>
            </h2>
          </div>

          <div className="lg:col-span-9 relative">
            {/* Continuous Animated Horizontal Rail connecting Step Nodes (Desktop lg+) */}
            <div className="hidden lg:block absolute top-[10px] left-2 right-12 z-0">
              <MotionLine accent delay={0.1} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 relative z-10">
              {JOURNEY_STEPS.map((item, idx) => (
                <MotionReveal key={item.step} delay={idx * 0.09} className="space-y-3">
                  <div className="inline-flex items-center gap-2 bg-[#F7F8F6] dark:bg-[#0B0D0E] pr-3 -ml-0.5 pl-0.5 relative z-10">
                    <motion.span
                      initial={{ scale: 0.6, opacity: 0 }}
                      whileInView={{ scale: 1, opacity: 1 }}
                      viewport={{ once: true, amount: 0.4 }}
                      transition={{ ...MOTION_SPRING, delay: idx * 0.09 }}
                      className="w-5 h-5 rounded-md bg-[#0D0F10] dark:bg-[#F7F8F6] text-[#84E818] dark:text-[#0D0F10] font-telemetry font-extrabold text-[10px] flex items-center justify-center shrink-0"
                    >
                      {item.step}
                    </motion.span>
                    <span className="text-xs font-telemetry font-semibold text-[#5A6068] dark:text-[#9AA2AC] whitespace-nowrap">
                      {item.phase}
                    </span>
                  </div>
                  <h3 className="text-sm sm:text-base font-extrabold text-[#0D0F10] dark:text-white">
                    {item.title}
                  </h3>
                  <p className="text-xs text-[#5A6068] dark:text-[#9AA2AC] leading-relaxed">
                    {item.body}
                  </p>
                </MotionReveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          CLOSING EDITORIAL CTA BAND — POLARITY-INVERTED HIGH CONTRAST
          ===================================================================== */}
      <section className="relative z-10 bg-white dark:bg-[#101315] border-t border-[#E6E8E4] dark:border-[#1E2328]">
        <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-5">
              <h2 className="text-3xl sm:text-5xl font-extrabold tracking-[-0.035em] text-[#0D0F10] dark:text-white leading-[1.02] text-balance">
                BANGUN RITME{' '}
                <span className="text-[#72D60C] dark:text-[#84E818]">SEHAT BERSAMA.</span>
              </h2>
            </div>

            <div className="lg:col-span-7 flex flex-col sm:flex-row sm:items-center justify-between gap-6">
              <p className="text-sm text-[#5A6068] dark:text-[#9AA2AC] max-w-md leading-relaxed">
                Mulai sesi latihan 3D pertama, catat lari GPS luar ruangan, atau analisis gizi makanan harian Anda sekarang juga—gratis dan sinkron cloud.
              </p>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} transition={MOTION_SPRING}>
                  <Link
                    href="/dashboard"
                    className="group inline-flex items-center justify-center gap-2.5 min-h-[48px] px-6 rounded-full bg-[#0D0F10] dark:bg-[#F7F8F6] text-white dark:text-[#0D0F10] text-sm font-bold hover:opacity-92 transition whitespace-nowrap"
                  >
                    <span>Masuk Workspace</span>
                    <ArrowRight className="w-4 h-4 text-[#84E818] dark:text-[#448500] group-hover:translate-x-1 transition-transform" />
                  </Link>
                </motion.div>

                <Link
                  href="/workout"
                  className="inline-flex items-center justify-center gap-2 min-h-[48px] px-5 rounded-full bg-[#F7F8F6] dark:bg-[#181C20] hover:bg-[#ECEFEA] dark:hover:bg-[#22272C] border border-[#DFE2DC] dark:border-[#2A3036] text-[#0D0F10] dark:text-white text-sm font-semibold transition whitespace-nowrap"
                >
                  <Flame className="w-4 h-4 text-[#448500] dark:text-[#84E818]" />
                  <span>Studio 3D</span>
                </Link>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          QUIET EDITORIAL FOOTER
          ===================================================================== */}
      <footer className="relative z-10 border-t border-[#E6E8E4] dark:border-[#1E2328] bg-[#F7F8F6] dark:bg-[#0B0D0E] py-8 main-mobile-safe md:pb-8 px-4 sm:px-6 lg:px-8">
        <div className="max-w-[1280px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-[#5A6068] dark:text-[#9AA2AC]">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2.5">
            <span className="w-6 h-6 rounded-md bg-[#0D0F10] dark:bg-[#F7F8F6] text-[#84E818] dark:text-[#0D0F10] font-extrabold text-[10px] inline-flex items-center justify-center">
              FF
            </span>
            <span className="font-bold text-[#0D0F10] dark:text-white">FitForge</span>
            <span aria-hidden="true">·</span>
            <span>Konsisten, Disiplin, Terukur.</span>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-x-6 gap-y-2 font-medium">
            <Link href="/dashboard" className="min-h-[44px] flex items-center hover:text-[#0D0F10] dark:hover:text-white transition-colors">
              Dashboard
            </Link>
            <Link href="/workout" className="min-h-[44px] flex items-center hover:text-[#0D0F10] dark:hover:text-white transition-colors">
              Studio 3D
            </Link>
            <Link href="/plan" className="min-h-[44px] flex items-center hover:text-[#0D0F10] dark:hover:text-white transition-colors">
              Rencana 7H
            </Link>
            <Link href="/login" className="min-h-[44px] flex items-center hover:text-[#0D0F10] dark:hover:text-white transition-colors">
              Masuk Akun
            </Link>
            <Link href="/about/credits" className="min-h-[44px] flex items-center hover:text-[#0D0F10] dark:hover:text-white transition-colors">
              Kredit Aset
            </Link>
          </div>
        </div>
      </footer>

      {/* EDGE-ANCHORED COMPACT MOBILE BOTTOM BAR (< 768px) — POLARITY INVERTED */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 pb-safe bg-[#0D0F10]/96 dark:bg-[#F7F8F6]/96 backdrop-blur-md border-t border-[#23282D] dark:border-[#DDE1DA] shadow-[0_-8px_24px_rgba(0,0,0,0.16)] select-none"
        aria-label="Navigasi Cepat Mobile"
      >
        <div className="h-[60px] max-w-lg mx-auto px-2 flex items-center justify-around gap-1">
          <Link
            href="/dashboard"
            className="flex-1 min-w-[44px] min-h-[48px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold text-neutral-300 dark:text-[#5A6068] hover:text-white dark:hover:text-[#0D0F10]"
          >
            <LayoutDashboard className="w-4 h-4 text-[#84E818] dark:text-[#448500]" />
            <span>Home</span>
          </Link>
          <Link
            href="/workout"
            className="flex-1 min-w-[44px] min-h-[48px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold text-neutral-300 dark:text-[#5A6068] hover:text-white dark:hover:text-[#0D0F10]"
          >
            <Box className="w-4 h-4 text-neutral-200 dark:text-[#0D0F10]" />
            <span>Studio 3D</span>
          </Link>
          <Link
            href="/run"
            className="flex flex-col items-center justify-center min-w-[56px] min-h-[48px] px-1 shrink-0 active:scale-95 transition-transform"
            aria-label="Mulai Lari GPS"
          >
            <span className="w-10 h-10 rounded-full bg-[#84E818] text-[#0D0F10] shadow-[0_4px_14px_rgba(132,232,24,0.42)] flex items-center justify-center">
              <MapPin className="w-[18px] h-[18px] stroke-[2.5]" />
            </span>
          </Link>
          <Link
            href="/nutrisi"
            className="flex-1 min-w-[44px] min-h-[48px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold text-neutral-300 dark:text-[#5A6068] hover:text-white dark:hover:text-[#0D0F10]"
          >
            <Utensils className="w-4 h-4 text-neutral-200 dark:text-[#0D0F10]" />
            <span>Nutrisi</span>
          </Link>
          <Link
            href="/plan"
            className="flex-1 min-w-[44px] min-h-[48px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold text-neutral-300 dark:text-[#5A6068] hover:text-white dark:hover:text-[#0D0F10]"
          >
            <CalendarRange className="w-4 h-4 text-neutral-200 dark:text-[#0D0F10]" />
            <span>Plan 7H</span>
          </Link>
        </div>
      </nav>
    </div>
  );
}
