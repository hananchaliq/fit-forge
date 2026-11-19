'use client';

import React, { useEffect, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion, useScroll, useTransform } from 'motion/react';
import { signInWithPopup } from 'firebase/auth';
import {
  ArrowRight,
  Box,
  MapPin,
  Utensils,
  BellRing,
  Play,
  Activity,
  BookOpen,
  LogIn,
  CheckCircle2,
  LayoutDashboard,
  CalendarRange,
} from 'lucide-react';
import { auth, googleProvider } from '@/lib/firebase';
import { useFitForgeStore } from '@/store/useFitForgeStore';
import { BiomechanicalLoader } from '@/components/ui/BiomechanicalLoader';
import { Canvas3DErrorBoundary } from '@/components/ui/Canvas3DErrorBoundary';
import { PWAInstallButton } from '@/components/pwa/PWAInstallButton';
import {
  ScrollProgressBar,
  MotionReveal,
  MOTION_SPRING,
} from '@/components/ui/MotionPrimitives';
import HeroRunner3D from '@/components/landing/HeroRunner3D';

const FEATURES = [
  {
    href: '/run',
    title: 'Pelacak Lari GPS',
    cta: 'Mulai Lari',
    accent: '#F97316',
    icon: MapPin,
    desc: 'Filter Kalman 1D, jarak geodesik Haversine, checkpoint IndexedDB tiap detik, Voice Coach Bahasa Indonesia, dan ekspor kartu PNG.',
  },
  {
    href: '/workout',
    title: 'Studio Latihan 3D',
    cta: 'Buka Studio 3D',
    accent: '#EF4444',
    icon: Box,
    desc: 'Rig anatomi 22-tulang dengan sorotan otot primer & sekunder real-time, kontrol tempo 0.5×–1.5×, tampilan 4-sudut, serta peta otot 2D.',
  },
  {
    href: '/nutrisi',
    title: 'Nutrisi AI Nusantara',
    cta: 'Analisis Makanan',
    accent: '#F59E0B',
    icon: Utensils,
    desc: 'Unggah foto atau ketik menu lokal—Gemini AI merinci bahan, makro, serat, dan menyesuaikan target kalori dari sesi larimu.',
  },
  {
    href: '/jadwal',
    title: 'Sholat, Alarm & Hidrasi',
    cta: 'Atur Jadwal',
    accent: '#10B981',
    icon: BellRing,
    desc: 'Jadwal sholat Kemenag RI otomatis sesuai kota, Mode A alarm bangun Web Audio bertahap, serta pengingat air +250ml berkala.',
  },
];

const emptySubscribe = () => () => {};

export default function LandingPage() {
  const router = useRouter();
  const { isAuthenticated, profile, setGuideOpen, hasCompletedOnboarding } =
    useFitForgeStore();
  const heroMounted = useSyncExternalStore(
    emptySubscribe,
    () => true,
    () => false
  );

  const { scrollY } = useScroll();
  const ambientGlowY = useTransform(scrollY, [0, 600], [0, 96]);
  const ambientGlowOpacity = useTransform(scrollY, [0, 600], [0.22, 0.08]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      if (params.get('autostart') === '1') {
        router.replace('/dashboard');
      }
    }
  }, [router]);

  const handleQuickGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      setGuideOpen(true);
      router.push(hasCompletedOnboarding ? '/dashboard' : '/onboarding');
    } catch {
      router.push('/login');
    }
  };

  return (
    <div className="min-h-dvh bg-[#09090B] text-white relative overflow-x-clip">
      <ScrollProgressBar />

      {/* Measured Warm Ember Ambient Light with Subtle Scroll Parallax */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute -top-36 left-1/2 -translate-x-1/2 w-[780px] max-w-[120vw] h-[440px] rounded-full blur-[120px] will-change-transform"
        style={{
          y: ambientGlowY,
          opacity: ambientGlowOpacity,
          background: 'radial-gradient(circle, #F97316 0%, #DC2626 42%, transparent 72%)',
        }}
      />

      {/* Sticky Top Header (Safe-Area + Zero 320px Overlap + 44px Targets) */}
      <header className="sticky top-0 z-30 pt-safe bg-[#09090B]/92 backdrop-blur-md border-b border-[#1C1C22]">
        <div className="max-w-7xl mx-auto px-3.5 sm:px-6 h-16 flex items-center justify-between gap-2 sm:gap-6">
          <Link
            href="/"
            className="flex items-center gap-2.5 min-h-[44px] min-w-0 shrink-0"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#EF4444] via-[#F97316] to-[#F59E0B] flex items-center justify-center text-black font-black text-sm shrink-0">
              F
            </div>
            <span className="text-lg sm:text-xl font-extrabold tracking-tight text-white truncate">
              FitForge
            </span>
          </Link>

          <nav
            className="hidden md:flex items-center gap-5 lg:gap-6 text-sm font-medium text-neutral-300"
            aria-label="Navigasi Utama"
          >
            <Link href="/dashboard" className="min-h-[44px] flex items-center hover:text-white transition-colors whitespace-nowrap">
              Dashboard
            </Link>
            <Link href="/plan" className="min-h-[44px] flex items-center hover:text-white transition-colors whitespace-nowrap">
              Rencana 7H
            </Link>
            <Link href="/workout" className="min-h-[44px] flex items-center hover:text-white transition-colors whitespace-nowrap">
              Studio 3D
            </Link>
            <Link href="/run" className="min-h-[44px] flex items-center hover:text-white transition-colors whitespace-nowrap">
              Lari GPS
            </Link>
            <Link href="/nutrisi" className="min-h-[44px] flex items-center hover:text-white transition-colors whitespace-nowrap">
              Nutrisi AI
            </Link>
          </nav>

          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <PWAInstallButton />

            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="inline-flex items-center justify-center gap-1.5 min-w-[44px] min-h-[44px] px-2.5 sm:px-3 rounded-xl bg-[#141418] hover:bg-[#1C1C22] border border-[#27272F] text-xs font-semibold text-[#F59E0B] transition whitespace-nowrap shrink-0 cursor-pointer"
              aria-label="Buka panduan penggunaan"
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">Panduan</span>
            </button>

            {isAuthenticated ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center justify-center min-h-[44px] px-3.5 sm:px-4 rounded-xl bg-gradient-to-r from-[#F97316] to-[#F59E0B] text-black text-xs sm:text-sm font-extrabold hover:opacity-95 active:scale-[0.98] transition whitespace-nowrap shrink-0"
              >
                <span className="max-w-[110px] sm:max-w-none truncate">
                  Dashboard ({profile.displayName.split(' ')[0]})
                </span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleQuickGoogleLogin}
                className="inline-flex items-center justify-center gap-1.5 min-h-[44px] px-3 sm:px-4 rounded-xl bg-gradient-to-r from-[#F97316] to-[#F59E0B] text-black text-xs sm:text-sm font-extrabold hover:opacity-95 active:scale-[0.98] transition whitespace-nowrap shrink-0 cursor-pointer"
              >
                <LogIn className="w-4 h-4 stroke-[2.5] shrink-0" />
                <span>Masuk</span>
                <span className="hidden sm:inline">Google</span>
              </button>
            )}
          </div>
        </div>
      </header>

      {/* HERO SECTION — Immediate SSR visibility (no opacity:0 flash) */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 pt-8 pb-12 lg:pt-14 lg:pb-18">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 lg:gap-10 items-center">
          <div className="lg:col-span-7 space-y-5 sm:space-y-6 min-w-0">
            <p className="text-[11px] sm:text-xs font-bold tracking-[0.16em] uppercase text-[#F97316]">
              SISTEM KEBUGARAN BIOMEKANIK 3D · PRESISI HARIAN
            </p>

            <h1 className="text-fluid-display font-extrabold tracking-tight text-white">
              Tubuhmu. Datamu.{' '}
              <span className="bg-gradient-to-r from-[#EF4444] via-[#F97316] to-[#F59E0B] bg-clip-text text-transparent">
                Targetmu.
              </span>
            </h1>

            <p className="text-sm sm:text-base lg:text-lg text-neutral-300 max-w-xl leading-relaxed">
              Mulai bersih dari nol tanpa data rekayasa. Pelajari aktivasi otot di Studio 3D, lacak lari GPS berfilter Kalman &amp; Haversine, hitung makro kuliner Indonesia dengan Gemini AI, serta jaga ritme sholat dan hidrasi dalam satu aplikasi.
            </p>

            <div className="flex flex-wrap items-center gap-3 pt-1">
              {isAuthenticated ? (
                <motion.div whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.97 }} transition={MOTION_SPRING}>
                  <Link
                    href="/dashboard"
                    className="inline-flex items-center justify-center gap-2.5 min-h-[48px] px-6 rounded-2xl bg-gradient-to-r from-[#EF4444] via-[#F97316] to-[#F59E0B] text-black font-extrabold text-sm shadow-lg hover:opacity-95 whitespace-nowrap"
                  >
                    <span>Buka Dashboard</span>
                    <ArrowRight className="w-4 h-4" />
                  </Link>
                </motion.div>
              ) : (
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.97 }}
                  transition={MOTION_SPRING}
                  onClick={handleQuickGoogleLogin}
                  className="inline-flex items-center justify-center gap-2.5 min-h-[48px] px-6 rounded-2xl bg-gradient-to-r from-[#EF4444] via-[#F97316] to-[#F59E0B] text-black font-extrabold text-sm shadow-lg hover:opacity-95 whitespace-nowrap cursor-pointer"
                >
                  <LogIn className="w-4 h-4 stroke-[2.5]" />
                  <span>Masuk Google &amp; Mulai</span>
                  <ArrowRight className="w-4 h-4" />
                </motion.button>
              )}

              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.97 }}
                transition={MOTION_SPRING}
                onClick={() => setGuideOpen(true)}
                className="inline-flex items-center justify-center gap-2 min-h-[48px] px-5 rounded-2xl bg-[#141418] hover:bg-[#1C1C22] border border-[#2C2C36] text-white font-semibold text-sm whitespace-nowrap cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-[#F59E0B]" />
                <span>Panduan</span>
              </motion.button>

              <Link
                href="/workout"
                className="inline-flex items-center gap-1.5 min-h-[44px] px-2 text-xs sm:text-sm font-semibold text-neutral-300 hover:text-white underline underline-offset-4 whitespace-nowrap transition-colors"
              >
                <Play className="w-3.5 h-3.5 text-[#F97316] fill-[#F97316]" />
                <span>Coba Studio 3D</span>
              </Link>
            </div>

            {/* 3 Asymmetric Hierarchy Spec Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 pt-3">
              {[
                {
                  eyebrow: 'Database Cloud',
                  value: 'Mulai dari 0',
                  color: 'text-white',
                  sub: 'Sinkron Google · Bebas data dummy',
                },
                {
                  eyebrow: 'Anatomi 3D',
                  value: '11 Grup Otot',
                  color: 'text-[#F97316]',
                  sub: 'Material PBR + Peta SVG 2D',
                },
                {
                  eyebrow: 'Rencana Split',
                  value: '7 Hari Penuh',
                  color: 'text-[#F59E0B]',
                  sub: 'Mode Gym & Mode Rumah',
                },
              ].map((spec) => (
                <motion.div
                  key={spec.eyebrow}
                  whileHover={{ y: -3, borderColor: 'rgba(249,115,22,0.45)' }}
                  transition={MOTION_SPRING}
                  className="rounded-2xl bg-[#141418] border border-[#27272F] p-4 min-w-0"
                >
                  <p className="text-[11px] text-neutral-400 font-semibold uppercase tracking-wider">
                    {spec.eyebrow}
                  </p>
                  <p className={`text-xl sm:text-2xl font-extrabold ${spec.color} mt-1 font-telemetry`}>
                    {spec.value}
                  </p>
                  <p className="text-[11px] text-neutral-400 mt-1">{spec.sub}</p>
                </motion.div>
              ))}
            </div>
          </div>

          {/* Right Column: Sculpted PBR 3D Runner Stage */}
          <div className="lg:col-span-5 min-w-0">
            <div className="relative rounded-3xl bg-[#111116] athletic-grain border border-[#27272F] p-2.5 sm:p-3 shadow-2xl overflow-hidden">
              <Canvas3DErrorBoundary
                title="Siluet Biomekanik 3D FitForge"
                description="Mode pratinjau hemat daya aktif. Buka Studio 3D untuk latihan interaktif penuh."
                heightClass="h-[340px] sm:h-[440px]"
              >
                {heroMounted ? (
                  <HeroRunner3D />
                ) : (
                  <BiomechanicalLoader
                    compact
                    label="MEMUAT VISUALISASI 3D"
                    sublabel="Menyiapkan Material PBR & Pencahayaan Studio..."
                  />
                )}
              </Canvas3DErrorBoundary>
              <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2.5 border-t border-[#22222A] text-[11px] sm:text-xs text-neutral-400">
                <span>Siluet Pelari 3D · PBR Karbon &amp; Ember</span>
                <span className="text-[#F59E0B] font-medium">Geser kursor untuk paralaks</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ONBOARDING STEPS */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-12 border-t border-[#1C1C22]">
        <div className="rounded-3xl bg-[#111116] border border-[#24242C] p-5 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#24242C]">
            <div className="min-w-0">
              <span className="text-[11px] font-bold uppercase tracking-[0.14em] text-[#F59E0B] block">
                Alur Memulai Tanpa Hambatan
              </span>
              <h2 className="text-lg sm:text-2xl font-extrabold text-white mt-1 text-balance">
                Empat Langkah Membangun Ritme Harian
              </h2>
            </div>

            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="inline-flex items-center justify-center gap-2 min-h-[44px] px-4 rounded-xl bg-[#202028] hover:bg-[#2A2A34] text-xs font-bold text-white transition self-start md:self-auto cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-[#F59E0B]" />
              <span>Buka Panduan Interaktif</span>
            </button>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            {[
              {
                step: '01',
                title: 'Masuk Akun Google',
                body: 'Profil Firestore pribadi dibuat otomatis dengan seluruh metrik dimulai bersih dari 0.',
              },
              {
                step: '02',
                title: 'Atur Profil & Kota',
                body: 'Sesuaikan berat, tinggi, target latihan, dan kota untuk jadwal sholat Kemenag RI.',
              },
              {
                step: '03',
                title: 'Rekam 3D & Lari GPS',
                body: 'Simpan sesi angkat beban dari Studio 3D atau lacak rute lari GPS secara real-time.',
              },
              {
                step: '04',
                title: 'Pindai Nutrisi & Air',
                body: 'Hitung makro masakan Indonesia, catat air +250ml, dan selesaikan 5 Golden Rules.',
              },
            ].map((item, idx) => (
              <MotionReveal key={item.step} delay={idx * 0.05}>
                <motion.div
                  whileHover={{ y: -3, borderColor: 'rgba(249,115,22,0.4)' }}
                  transition={MOTION_SPRING}
                  className="h-full rounded-2xl bg-[#0D0D11] border border-[#24242C] p-4 min-w-0"
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <span className="px-2 py-0.5 rounded-md bg-[#F97316]/15 text-[#F97316] text-xs font-telemetry font-bold">
                      {item.step}
                    </span>
                    <CheckCircle2 className="w-4 h-4 text-emerald-400" />
                  </div>
                  <h3 className="text-sm font-bold text-white">{item.title}</h3>
                  <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">{item.body}</p>
                </motion.div>
              </MotionReveal>
            ))}
          </div>
        </div>
      </section>

      {/* FEATURE GRID SECTION */}
      <section className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 py-12 border-t border-[#1C1C22]">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-8 gap-4">
          <div className="min-w-0">
            <h2 className="text-xl sm:text-3xl font-extrabold text-white tracking-tight text-balance">
              Ekosistem Performa Terintegrasi
            </h2>
            <p className="text-xs sm:text-sm text-neutral-400 mt-1">
              Dirancang untuk latihan harian, pelacakan GPS akurat, dan kebiasaan konsisten.
            </p>
          </div>
          <Link
            href="/plan"
            className="inline-flex items-center gap-2 min-h-[44px] text-sm font-semibold text-[#F97316] hover:text-[#F59E0B] self-start md:self-auto"
          >
            <span>Lihat Poster Rencana 7 Hari</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-5">
          {FEATURES.map((feat, idx) => {
            const Icon = feat.icon;
            return (
              <MotionReveal key={feat.href} delay={idx * 0.06}>
                <motion.div
                  whileHover={{ y: -4 }}
                  whileTap={{ scale: 0.99 }}
                  transition={MOTION_SPRING}
                  className="h-full"
                >
                  <Link
                    href={feat.href}
                    className="group h-full rounded-2xl bg-[#141418] hover:bg-[#1A1A21] border border-[#27272F] hover:border-[#3A3A46] p-5 transition-colors flex flex-col justify-between min-w-0"
                  >
                    <div>
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center mb-4 border"
                        style={{
                          backgroundColor: `${feat.accent}18`,
                          borderColor: `${feat.accent}40`,
                        }}
                      >
                        <Icon className="w-5 h-5" style={{ color: feat.accent }} />
                      </div>
                      <h3 className="text-base font-bold text-white group-hover:text-[#F59E0B] transition-colors">
                        {feat.title}
                      </h3>
                      <p className="text-xs text-neutral-400 mt-2 leading-relaxed">{feat.desc}</p>
                    </div>
                    <span className="inline-flex items-center gap-1.5 text-xs font-bold text-[#F59E0B] mt-5">
                      {feat.cta} <ArrowRight className="w-3.5 h-3.5 group-hover:translate-x-1 transition-transform" />
                    </span>
                  </Link>
                </motion.div>
              </MotionReveal>
            );
          })}
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-[#1C1C22] bg-[#09090B] py-8 main-mobile-safe md:pb-8 px-4 sm:px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-400">
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-center sm:text-left">
            <Activity className="w-4 h-4 text-[#F97316] shrink-0" />
            <span className="font-bold text-white">FitForge</span>
            <span>·</span>
            <span>Konsisten, Disiplin, Terukur.</span>
          </div>
          <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            <Link href="/login" className="min-h-[44px] flex items-center hover:text-white transition">
              Masuk Google
            </Link>
            <Link href="/onboarding" className="min-h-[44px] flex items-center hover:text-white transition">
              Onboarding
            </Link>
            <Link href="/plan" className="min-h-[44px] flex items-center hover:text-white transition">
              Poster Plan
            </Link>
            <Link href="/about/credits" className="min-h-[44px] flex items-center hover:text-white transition">
              Kredit Aset
            </Link>
          </div>
        </div>
      </footer>

      {/* FLOATING MOBILE BOTTOM DOCK ON LANDING PAGE (< 768px, SAFE-AREA + 44px TARGETS) */}
      <div className="md:hidden fixed bottom-dock-safe inset-x-2.5 z-40 pointer-events-none">
        <nav
          className="pointer-events-auto h-16 rounded-2xl bg-[#0D0D11]/95 backdrop-blur-xl border border-[#27272F] px-1.5 flex items-center justify-around shadow-[0_14px_36px_rgba(0,0,0,0.75)] select-none"
          aria-label="Navigasi Cepat Mobile"
        >
          <Link
            href="/dashboard"
            className="flex-1 min-w-[44px] min-h-[48px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold text-neutral-300 hover:text-white"
          >
            <LayoutDashboard className="w-4 h-4 text-[#F59E0B]" />
            <span>Home</span>
          </Link>
          <Link
            href="/workout"
            className="flex-1 min-w-[44px] min-h-[48px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold text-neutral-300 hover:text-white"
          >
            <Box className="w-4 h-4 text-[#EF4444]" />
            <span>Studio 3D</span>
          </Link>
          <Link
            href="/run"
            className="relative -mt-6 flex flex-col items-center px-1 shrink-0"
            aria-label="Mulai Lari GPS"
          >
            <motion.div
              whileTap={{ scale: 0.92 }}
              className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#F97316] to-[#F59E0B] text-black border-2 border-[#0D0D11] shadow-[0_6px_20px_rgba(249,115,22,0.5)] flex items-center justify-center"
            >
              <MapPin className="w-5 h-5 stroke-[2.5]" />
            </motion.div>
            <span className="text-[10px] font-extrabold text-[#F59E0B] mt-0.5 whitespace-nowrap">
              Lari GPS
            </span>
          </Link>
          <Link
            href="/nutrisi"
            className="flex-1 min-w-[44px] min-h-[48px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold text-neutral-300 hover:text-white"
          >
            <Utensils className="w-4 h-4 text-[#F97316]" />
            <span>Nutrisi</span>
          </Link>
          <Link
            href="/plan"
            className="flex-1 min-w-[44px] min-h-[48px] flex flex-col items-center justify-center gap-0.5 text-[10px] font-bold text-neutral-300 hover:text-white"
          >
            <CalendarRange className="w-4 h-4 text-emerald-400" />
            <span>Plan 7H</span>
          </Link>
        </nav>
      </div>
    </div>
  );
}
