'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'motion/react';
import {
  LayoutDashboard,
  MapPin,
  Box,
  CalendarRange,
  Utensils,
  BellRing,
  BarChart3,
  Settings,
  Search,
  Flame,
  Sun,
  Moon,
  X,
  ArrowRight,
  Bell,
  Play,
  CheckCircle2,
  Dumbbell,
  BookOpen,
  LogIn,
  LayoutGrid,
  Droplets,
  Sparkles,
} from 'lucide-react';
import { signInWithPopup } from 'firebase/auth';
import { auth, googleProvider } from '@/lib/firebase';
import { useFitForgeStore } from '@/store/useFitForgeStore';
import { EXERCISES } from '@/data/exercises';
import { PWAInstallButton, OfflineIndicator } from '@/components/pwa/PWAInstallButton';
import { ScrollProgressBar, MOTION_SPRING } from '@/components/ui/MotionPrimitives';

interface AppShellProps {
  title: string;
  subtitle: string;
  ctaLabel?: string;
  ctaHref?: string;
  onCtaClick?: () => void;
  children: React.ReactNode;
}

const NAV_ITEMS = [
  { href: '/dashboard', label: 'Dashboard', shortLabel: 'Home', icon: LayoutDashboard, desc: 'Ringkasan & KPI' },
  { href: '/run', label: 'Lari GPS', shortLabel: 'Lari GPS', icon: MapPin, desc: 'Kalman & Haversine' },
  { href: '/workout', label: 'Studio 3D', shortLabel: 'Studio 3D', icon: Box, desc: 'Anatomi Otot PBR' },
  { href: '/plan', label: 'Rencana 7H', shortLabel: 'Plan 7H', icon: CalendarRange, desc: 'Poster Mingguan' },
  { href: '/nutrisi', label: 'Nutrisi AI', shortLabel: 'Nutrisi', icon: Utensils, desc: 'Kuliner & Makro' },
  { href: '/jadwal', label: 'Sholat & Air', shortLabel: 'Jadwal', icon: BellRing, desc: 'Adzan & Alarm' },
  { href: '/analitik', label: 'Analitik', shortLabel: 'Analitik', icon: BarChart3, desc: 'Grafik Progres' },
  { href: '/pengaturan', label: 'Pengaturan', shortLabel: 'Akun', icon: Settings, desc: 'Profil & Cloud' },
];

const MOBILE_TRAY_ITEMS = [
  { href: '/plan', label: 'Rencana 7 Hari', sub: 'Poster Gym & Rumah', icon: CalendarRange, accent: '#F97316' },
  { href: '/jadwal', label: 'Sholat & Hidrasi', sub: 'Kemenag RI & Alarm', icon: BellRing, accent: '#10B981' },
  { href: '/analitik', label: 'Analitik Performa', sub: 'Volume, Protein & Lari', icon: BarChart3, accent: '#3B82F6' },
  { href: '/pengaturan', label: 'Pengaturan Akun', sub: 'Target Makro & Cloud', icon: Settings, accent: '#F59E0B' },
];

export function AppShell({
  title,
  subtitle,
  ctaLabel = 'Mulai Latihan 3D',
  ctaHref = '/workout',
  onCtaClick,
  children,
}: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    profile,
    isAuthenticated,
    setGuideOpen,
    darkMode,
    toggleDarkMode,
    streakDays,
    goldenRules,
    checkInAllGoldenRules,
    setSelectedExerciseId,
    waterMl,
    addWaterMl,
  } = useFitForgeStore();

  const [cmdOpen, setCmdOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileHubOpen, setMobileHubOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [checkedInFeedback, setCheckedInFeedback] = useState(false);
  const [waterPulse, setWaterPulse] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  const completedRulesCount = Object.values(goldenRules).filter(Boolean).length;

  const isSecondaryRouteActive = MOBILE_TRAY_ITEMS.some(
    (item) => pathname === item.href || pathname?.startsWith(item.href)
  );
  const activeSecondaryItem = MOBILE_TRAY_ITEMS.find(
    (item) => pathname === item.href || pathname?.startsWith(item.href)
  );

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', darkMode);
    }
  }, [darkMode]);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  useEffect(() => {
    const t = window.setTimeout(() => {
      setMobileHubOpen(false);
      setNotifOpen(false);
    }, 0);
    return () => window.clearTimeout(t);
  }, [pathname]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setCmdOpen(false);
        setNotifOpen(false);
        setMobileHubOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      setGuideOpen(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('auth/unauthorized-domain')) {
        router.push('/login?error=unauthorized-domain');
      } else {
        router.push('/login');
      }
    }
  };

  const allExercises = Object.values(EXERCISES);
  const filteredExercises = searchQuery.trim()
    ? allExercises
        .filter((ex) => ex.name.toLowerCase().includes(searchQuery.toLowerCase()))
        .slice(0, 6)
    : allExercises.slice(0, 5);

  const handleQuickCheckIn = () => {
    checkInAllGoldenRules();
    setCheckedInFeedback(true);
    setTimeout(() => setCheckedInFeedback(false), 2200);
  };

  const handleQuickWater = () => {
    addWaterMl(250);
    setWaterPulse(true);
    setTimeout(() => setWaterPulse(false), 900);
  };

  return (
    <div className="min-h-dvh bg-[#09090B] text-[#111114] dark:text-[#FAFAFA] flex flex-col selection:bg-[#F97316] selection:text-black">
      <ScrollProgressBar />
      {/* =====================================================================
          EDITORIAL-ATHLETIC STICKY TOP HEADER (SAFE-AREA + ZERO 320px OVERLAP)
          ===================================================================== */}
      <header
        className={`sticky top-0 z-40 pt-safe bg-[#09090B]/95 backdrop-blur-md text-white border-b transition-colors duration-200 ${
          scrolled ? 'border-[#27272F] shadow-[0_8px_24px_rgba(0,0,0,0.4)]' : 'border-[#1C1C22]'
        }`}
      >
        <div
          className={`max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-2 transition-all duration-200 ${
            scrolled ? 'h-14 sm:h-15' : 'h-16'
          }`}
        >
          {/* Left: Brand Emblem + Compact Telemetry */}
          <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
            <Link
              href="/"
              className="flex items-center gap-2.5 group min-h-[44px] min-w-0 pr-1"
              aria-label="Beranda FitForge"
            >
              <motion.div
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.94 }}
                className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#EF4444] via-[#F97316] to-[#F59E0B] flex items-center justify-center text-black font-black text-base shrink-0 shadow-[0_0_16px_rgba(249,115,22,0.28)]"
              >
                F
              </motion.div>
              <div className="leading-none min-w-0">
                <span className="text-[15px] sm:text-lg font-extrabold tracking-tight text-white block truncate">
                  FitForge
                </span>
                <span className="hidden sm:block text-[10px] text-neutral-400 font-semibold tracking-[0.14em] uppercase mt-0.5 truncate">
                  Performance OS
                </span>
              </div>
            </Link>

            {/* Interactive Streak & Golden Rules (Desktop md+) */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={handleQuickCheckIn}
              title="Klik untuk Check-in 5 Golden Rules Hari Ini"
              className="hidden md:inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-xl bg-[#141418] hover:bg-[#1C1C22] border border-[#27272F] text-xs font-bold text-white transition cursor-pointer shrink-0"
            >
              <Flame className="w-3.5 h-3.5 fill-[#F59E0B] text-[#F59E0B] shrink-0" />
              <span className="font-telemetry text-[#F59E0B]">{streakDays}h</span>
              <span className="text-neutral-600">·</span>
              <span className="text-[11px] text-neutral-300 tabular-nums">
                {checkedInFeedback ? (
                  <span className="text-emerald-400 font-bold">Tercatat</span>
                ) : (
                  `Rules ${completedRulesCount}/5`
                )}
              </span>
            </motion.button>

            {/* Quick Hydration (Desktop lg+) with spring floating feedback */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.94 }}
              transition={MOTION_SPRING}
              onClick={handleQuickWater}
              className="relative hidden lg:inline-flex items-center gap-1.5 min-h-[44px] px-3 rounded-xl bg-[#141418] hover:bg-[#1C1C22] border border-[#27272F] text-xs font-semibold text-sky-400 transition cursor-pointer shrink-0"
              title="Tambah +250ml Air Putih"
            >
              <Droplets className="w-3.5 h-3.5 shrink-0" />
              <span className="font-telemetry">{(waterMl / 1000).toFixed(2)}L</span>
              <span className="px-1.5 py-0.5 rounded bg-sky-500/15 text-[10px] font-bold text-sky-300">
                +250ml
              </span>
              <AnimatePresence>
                {waterPulse && (
                  <motion.span
                    initial={{ opacity: 0, y: 4, scale: 0.85 }}
                    animate={{ opacity: 1, y: -22, scale: 1 }}
                    exit={{ opacity: 0, y: -32, scale: 0.9 }}
                    transition={MOTION_SPRING}
                    className="pointer-events-none absolute -top-1 right-2 px-1.5 py-0.5 rounded-md bg-sky-400 text-black text-[10px] font-black shadow-lg"
                  >
                    +250ml
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>

          {/* Right: 44x44px Touch-Compliant Controls (Zero Collision on 320px!) */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => setCmdOpen(true)}
              className="flex items-center justify-center sm:justify-between gap-2 min-w-[44px] min-h-[44px] sm:px-3 rounded-xl bg-[#141418] hover:bg-[#1C1C22] border border-[#27272F] text-xs text-neutral-400 transition sm:w-48 lg:w-60 cursor-pointer"
              aria-label="Cari latihan, makanan, atau rute (Command K)"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Search className="w-4 h-4 text-neutral-300 shrink-0" />
                <span className="hidden sm:inline truncate">Cari latihan, rute...</span>
              </div>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-[#27272F] text-neutral-300 rounded shrink-0">
                ⌘K
              </kbd>
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => setGuideOpen(true)}
              className="hidden sm:inline-flex items-center justify-center gap-1.5 min-w-[44px] min-h-[44px] px-3 rounded-xl bg-[#141418] hover:bg-[#1C1C22] border border-[#27272F] text-xs font-semibold text-[#F59E0B] transition cursor-pointer"
              title="Buka Panduan Penggunaan"
              aria-label="Panduan"
            >
              <BookOpen className="w-4 h-4 shrink-0" />
              <span className="hidden xl:inline">Panduan</span>
            </motion.button>

            <PWAInstallButton />

            {/* Theme Toggle (44x44px) with animated icon morph */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.9 }}
              transition={MOTION_SPRING}
              onClick={toggleDarkMode}
              className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-[#141418] hover:bg-[#1C1C22] border border-[#27272F] text-neutral-300 transition cursor-pointer overflow-hidden"
              aria-label={darkMode ? 'Aktifkan Mode Terang' : 'Aktifkan Mode Gelap'}
              title={darkMode ? 'Mode Terang' : 'Mode Gelap'}
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
                    <Sun className="w-4 h-4 text-[#F59E0B]" />
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
                    <Moon className="w-4 h-4 text-neutral-300" />
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>

            {/* Notification Bell (hidden on <360px, accessible inside Menu Hub) */}
            <div className="relative hidden min-[360px]:block">
              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={() => setNotifOpen((prev) => !prev)}
                className="relative min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-[#141418] hover:bg-[#1C1C22] border border-[#27272F] text-neutral-300 transition cursor-pointer"
                aria-label="Buka notifikasi pengingat"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-2.5 right-2.5 w-2 h-2 rounded-full bg-[#F97316]" />
              </motion.button>

              <AnimatePresence>
                {notifOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    transition={{ duration: 0.18 }}
                    className="fixed sm:absolute right-3 sm:right-0 top-16 sm:top-auto sm:mt-2 w-[calc(100vw-24px)] max-w-xs rounded-2xl bg-[#141418] border border-[#2C2C35] p-4 shadow-2xl z-50 text-white"
                  >
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-xs font-bold text-white truncate">
                        Pengingat Aktif
                      </span>
                      <span className="text-[11px] text-[#F59E0B] font-telemetry font-semibold shrink-0">
                        {waterMl} ml
                      </span>
                    </div>
                    <div className="space-y-2.5 text-xs">
                      <div className="p-3 rounded-xl bg-[#0E0E11] border border-[#27272F] flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-white truncate">Hidrasi Jam Ini</p>
                          <p className="text-neutral-400 truncate">Tambah +250 ml air putih</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleQuickWater}
                          className="min-h-[44px] px-3 rounded-lg bg-[#F59E0B] text-black font-bold hover:opacity-90 cursor-pointer shrink-0"
                        >
                          +250ml
                        </button>
                      </div>
                      <div className="p-3 rounded-xl bg-[#0E0E11] border border-[#27272F] flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold text-white truncate">Jadwal Sholat</p>
                          <p className="text-neutral-400 truncate">Kemenag RI · {profile.city}</p>
                        </div>
                        <Link
                          href="/jadwal"
                          onClick={() => setNotifOpen(false)}
                          className="min-h-[44px] px-2.5 flex items-center text-[#F97316] font-bold hover:underline shrink-0"
                        >
                          Buka →
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Profile / Google Login (44x44px touch target) */}
            {isAuthenticated ? (
              <Link
                href="/pengaturan"
                className="flex items-center justify-center gap-2 min-w-[44px] min-h-[44px] sm:pl-2 sm:pr-3 rounded-xl bg-[#141418] hover:bg-[#1C1C22] border border-[#27272F] transition shrink-0"
                aria-label={`Profil ${profile.displayName}`}
              >
                <div className="w-7 h-7 rounded-lg bg-gradient-to-tr from-[#F97316] to-[#F59E0B] text-black font-extrabold text-xs flex items-center justify-center shrink-0">
                  {profile.displayName.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:inline text-xs font-semibold text-white max-w-[96px] truncate">
                  {profile.displayName}
                </span>
              </Link>
            ) : (
              <motion.button
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={handleGoogleSignIn}
                className="inline-flex items-center justify-center gap-1.5 min-w-[44px] min-h-[44px] px-3 rounded-xl bg-gradient-to-r from-[#F97316] to-[#F59E0B] text-black text-xs font-extrabold hover:opacity-95 transition whitespace-nowrap cursor-pointer shrink-0"
              >
                <LogIn className="w-4 h-4 stroke-[2.5] shrink-0" />
                <span className="hidden min-[380px]:inline">Masuk</span>
                <span className="hidden md:inline">Google</span>
              </motion.button>
            )}
          </div>
        </div>

        {/* Tier 2 (Desktop >= 768px): Horizontal Kinetic Navigation */}
        <div className="hidden md:block border-t border-[#18181D] bg-[#0E0E11]/95">
          <div className="max-w-[1440px] mx-auto px-6 lg:px-8 h-12 flex items-center justify-between gap-4">
            <nav
              className="flex items-center gap-1 overflow-x-auto no-scrollbar py-1"
              aria-label="Menu Utama"
            >
              {NAV_ITEMS.map((item) => {
                const Icon = item.icon;
                const isActive =
                  pathname === item.href ||
                  (item.href !== '/dashboard' && pathname?.startsWith(item.href));

                return (
                  <Link
                    key={item.href}
                    href={item.href}
                    className={`relative px-3.5 min-h-[38px] rounded-xl text-xs font-semibold transition-colors whitespace-nowrap flex items-center gap-2 select-none ${
                      isActive
                        ? 'text-white'
                        : 'text-neutral-400 hover:text-white hover:bg-[#16161B]'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="desktop-kinetic-nav-pill"
                        className="absolute inset-0 rounded-xl bg-[#1C1C22] border border-[#32323D]"
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      >
                        <div className="absolute bottom-0 inset-x-3 h-[2px] rounded-full bg-gradient-to-r from-[#F97316] to-[#F59E0B]" />
                      </motion.div>
                    )}
                    <Icon
                      className={`relative z-10 w-3.5 h-3.5 transition-transform duration-200 ${
                        isActive ? 'text-[#F97316]' : 'text-neutral-400'
                      }`}
                    />
                    <span className="relative z-10">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="hidden xl:flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                <span>Golden Rules</span>
                <div className="w-20 h-1.5 bg-[#1C1C22] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-[#F97316] to-[#F59E0B]"
                    initial={false}
                    animate={{ width: `${(completedRulesCount / 5) * 100}%` }}
                    transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                  />
                </div>
                <strong className="text-white font-telemetry">{completedRulesCount}/5</strong>
              </div>
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                onClick={handleQuickCheckIn}
                className="px-3.5 h-8 rounded-lg bg-gradient-to-r from-[#F97316] to-[#F59E0B] text-black text-[11px] font-extrabold flex items-center gap-1 cursor-pointer"
              >
                {checkedInFeedback ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Tercatat</span>
                  </>
                ) : (
                  <>
                    <span>Check-in</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </div>
      </header>

      {/* =====================================================================
          MAIN CONTENT CANVAS (INSTANT SSR VISIBILITY, ZERO BLANK OPACITY FLASH)
          ===================================================================== */}
      <main className="flex-1 bg-[#F7F7F5] dark:bg-[#0E0E11] px-3 sm:px-6 lg:px-8 py-5 sm:py-7 main-mobile-safe md:pb-10 overflow-x-clip">
        <div className="max-w-[1440px] mx-auto min-w-0">
          {!isAuthenticated && (
            <div className="mb-5 p-3.5 sm:p-4 rounded-2xl bg-[#141418] text-white border border-[#27272F] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-neutral-300 leading-relaxed min-w-0">
                <strong className="text-[#F59E0B]">Mode Lokal Aktif:</strong> Data dimulai bersih dari{' '}
                <span className="font-telemetry px-1.5 py-0.5 rounded bg-[#27272F] text-white">0</span>. Masuk dengan Google untuk sinkronisasi cloud lintas perangkat.
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={() => setGuideOpen(true)}
                  className="min-h-[44px] px-3.5 rounded-xl bg-[#27272F] hover:bg-[#32323D] text-xs font-semibold text-white transition cursor-pointer"
                >
                  Panduan
                </button>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="min-h-[44px] px-4 rounded-xl bg-gradient-to-r from-[#F97316] to-[#F59E0B] text-black text-xs font-extrabold hover:opacity-95 transition cursor-pointer"
                >
                  Masuk Google →
                </button>
              </div>
            </div>
          )}

          {/* Page Header & Route Content — initial={false} guarantees instant LCP on SSR */}
          <motion.div
            key={pathname}
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
            className="min-w-0"
          >
            <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3.5 mb-6 pb-4 border-b border-[#E6E6E2] dark:border-[#1E1E24]">
              <div className="min-w-0">
                <h1 className="text-fluid-title font-extrabold tracking-tight text-[#111114] dark:text-white break-words">
                  {title}
                </h1>
                <p className="text-xs sm:text-sm text-[#52525B] dark:text-neutral-400 mt-1 line-clamp-2 sm:line-clamp-1">
                  {subtitle}
                </p>
              </div>

              {onCtaClick ? (
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.015 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={onCtaClick}
                  className="inline-flex items-center justify-center gap-2.5 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#141418] hover:bg-[#222228] dark:bg-gradient-to-r dark:from-[#F97316] dark:to-[#F59E0B] text-white dark:text-black text-xs sm:text-sm font-extrabold shadow-sm transition self-start sm:self-auto whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 text-[#F59E0B] fill-[#F59E0B] dark:text-black dark:fill-black shrink-0" />
                  <span>{ctaLabel}</span>
                </motion.button>
              ) : (
                <Link
                  href={ctaHref}
                  className="inline-flex items-center justify-center gap-2.5 min-h-[44px] px-4 py-2.5 rounded-xl bg-[#141418] hover:bg-[#222228] dark:bg-gradient-to-r dark:from-[#F97316] dark:to-[#F59E0B] text-white dark:text-black text-xs sm:text-sm font-extrabold shadow-sm transition self-start sm:self-auto whitespace-nowrap shrink-0"
                >
                  <Play className="w-3.5 h-3.5 text-[#F59E0B] fill-[#F59E0B] dark:text-black dark:fill-black shrink-0" />
                  <span>{ctaLabel}</span>
                </Link>
              )}
            </div>

            {children}
          </motion.div>
        </div>
      </main>

      {/* =====================================================================
          MOBILE EXPANDABLE BENTO HUB SHEET (DRAG-TO-DISMISS + SAFE-AREA)
          ===================================================================== */}
      <AnimatePresence>
        {mobileHubOpen && (
          <div key="mobile-bento-hub-container" className="md:hidden">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileHubOpen(false)}
              className="fixed inset-0 bg-black/75 backdrop-blur-xs z-40"
            />

            <motion.div
              drag="y"
              dragConstraints={{ top: 0, bottom: 160 }}
              dragElastic={0.18}
              onDragEnd={(_e, info) => {
                if (info.offset.y > 70 || info.velocity.y > 350) {
                  setMobileHubOpen(false);
                }
              }}
              initial={{ opacity: 0, y: 36, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 36, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="fixed bottom-sheet-safe inset-x-3 z-50 rounded-3xl bg-[#121216] border border-[#2A2A32] p-4 text-white shadow-[0_20px_60px_rgba(0,0,0,0.85)] max-h-[75dvh] overflow-y-auto"
              role="dialog"
              aria-label="Menu Navigasi & Telemetri Cepat"
            >
              {/* Drag handle bar */}
              <div className="w-10 h-1 rounded-full bg-neutral-700 mx-auto mb-3" aria-hidden="true" />

              <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-[#24242C]">
                <div className="flex items-center gap-2 min-w-0">
                  <Sparkles className="w-4 h-4 text-[#F59E0B] shrink-0" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-white truncate">
                    Menu &amp; Aksi Cepat
                  </span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileHubOpen(false);
                      setGuideOpen(true);
                    }}
                    className="min-h-[44px] px-3 rounded-xl bg-[#1C1C22] text-[#F59E0B] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Panduan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileHubOpen(false)}
                    className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-[#1C1C22] text-neutral-400 hover:text-white cursor-pointer"
                    aria-label="Tutup menu hub"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2.5 mb-3.5">
                {MOBILE_TRAY_ITEMS.map((item, idx) => {
                  const Icon = item.icon;
                  const active = pathname === item.href || pathname?.startsWith(item.href);
                  return (
                    <motion.div
                      key={item.href}
                      initial={{ opacity: 0, y: 12, scale: 0.96 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      transition={{ ...MOTION_SPRING, delay: idx * 0.04 }}
                      whileTap={{ scale: 0.96 }}
                    >
                      <Link
                        href={item.href}
                        onClick={() => setMobileHubOpen(false)}
                        className={`min-h-[82px] h-full p-3 rounded-2xl border transition flex flex-col justify-between min-w-0 ${
                          active
                            ? 'bg-[#202028] border-[#F97316] text-white'
                            : 'bg-[#18181D] hover:bg-[#202028] border-[#27272F] text-neutral-200'
                        }`}
                      >
                        <div className="flex items-center justify-between mb-2">
                          <div
                            className="w-8 h-8 rounded-xl flex items-center justify-center shrink-0"
                            style={{ backgroundColor: `${item.accent}20` }}
                          >
                            <Icon className="w-4 h-4" style={{ color: item.accent }} />
                          </div>
                          {active && (
                            <span className="px-2 py-0.5 rounded-full bg-[#F97316]/20 text-[#F97316] text-[10px] font-bold">
                              Aktif
                            </span>
                          )}
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold text-white truncate">{item.label}</p>
                          <p className="text-[11px] text-neutral-400 mt-0.5 truncate">{item.sub}</p>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>

              <div className="p-3 rounded-2xl bg-[#0B0B0E] border border-[#24242C] mb-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-bold text-neutral-300 truncate">
                    Golden Rules ({completedRulesCount}/5)
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[#F59E0B] font-telemetry shrink-0">
                    <Flame className="w-3.5 h-3.5 fill-[#F59E0B]" />
                    {streakDays} Hari
                  </span>
                </div>
                <div className="w-full h-1.5 bg-[#1C1C22] rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full bg-gradient-to-r from-[#F97316] to-[#F59E0B] transition-all duration-300"
                    style={{ width: `${(completedRulesCount / 5) * 100}%` }}
                  />
                </div>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      handleQuickCheckIn();
                      setMobileHubOpen(false);
                    }}
                    className="min-h-[44px] px-3 rounded-xl bg-gradient-to-r from-[#F97316] to-[#F59E0B] text-black text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate">Check-in 5</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleQuickWater}
                    className="min-h-[44px] px-3 rounded-xl bg-[#18181D] border border-[#2C2C36] text-sky-400 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Droplets className="w-3.5 h-3.5 shrink-0" />
                    <span className="truncate font-telemetry">+250ml ({(waterMl / 1000).toFixed(1)}L)</span>
                  </button>
                </div>
              </div>

              <PWAInstallButton fullWidthMobile />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FLOATING KINETIC BOTTOM DOCK (< 768px, SAFE-AREA + 44px TARGETS) */}
      <div className="md:hidden fixed bottom-dock-safe inset-x-2.5 sm:inset-x-3 z-40 pointer-events-none">
        <nav
          className="pointer-events-auto h-16 rounded-2xl bg-[#0D0D11]/95 backdrop-blur-xl border border-[#27272F] px-1.5 flex items-center justify-between shadow-[0_14px_36px_rgba(0,0,0,0.75)] select-none"
          aria-label="Navigasi Bawah Mobile"
        >
          <MobileDockTab
            href="/dashboard"
            label="Home"
            icon={LayoutDashboard}
            active={!mobileHubOpen && pathname === '/dashboard'}
          />

          <MobileDockTab
            href="/workout"
            label="Studio 3D"
            icon={Box}
            active={!mobileHubOpen && (pathname === '/workout' || Boolean(pathname?.startsWith('/workout')))}
          />

          {/* Center Kinetic GPS Run Action Orb */}
          <div className="relative -mt-6 flex flex-col items-center px-1 shrink-0">
            <Link
              href="/run"
              aria-label="Mulai Lari GPS"
              className="group relative flex items-center justify-center min-w-[48px] min-h-[48px]"
            >
              <motion.div
                whileHover={{ scale: 1.07, y: -2 }}
                whileTap={{ scale: 0.9 }}
                transition={MOTION_SPRING}
                className={`relative w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-shadow ${
                  pathname === '/run'
                    ? 'bg-gradient-to-tr from-[#EF4444] via-[#F97316] to-[#F59E0B] text-black border-white shadow-[0_0_20px_rgba(249,115,22,0.6)]'
                    : 'bg-gradient-to-tr from-[#F97316] to-[#F59E0B] text-black border-[#0D0D11] shadow-[0_6px_18px_rgba(249,115,22,0.4)]'
                }`}
              >
                <MapPin className="w-5 h-5 stroke-[2.5]" />
              </motion.div>
            </Link>
            <span
              className={`text-[10px] font-extrabold mt-0.5 tracking-tight whitespace-nowrap ${
                pathname === '/run' ? 'text-[#F59E0B]' : 'text-neutral-300'
              }`}
            >
              Lari GPS
            </span>
          </div>

          <MobileDockTab
            href="/nutrisi"
            label="Nutrisi"
            icon={Utensils}
            active={!mobileHubOpen && (pathname === '/nutrisi' || Boolean(pathname?.startsWith('/nutrisi')))}
          />

          <button
            type="button"
            onClick={() => setMobileHubOpen((prev) => !prev)}
            data-testid="mobile-dock-hub-btn"
            aria-label="Buka menu lengkap Rencana, Jadwal, Analitik dan Pengaturan"
            aria-expanded={mobileHubOpen}
            className="relative flex-1 min-w-[44px] min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 cursor-pointer active:scale-95 transition-transform"
          >
            {(mobileHubOpen || isSecondaryRouteActive) && (
              <motion.div
                layoutId="mobile-dock-active-pill"
                className="absolute inset-x-1 inset-y-1 rounded-xl bg-[#1C1C22] border border-[#32323D]"
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              >
                <div className="absolute top-0 inset-x-3 h-[2px] rounded-full bg-gradient-to-r from-[#F97316] to-[#F59E0B]" />
              </motion.div>
            )}

            <div className="relative z-10">
              {mobileHubOpen ? (
                <X className="w-4 h-4 text-[#F59E0B]" />
              ) : (
                <LayoutGrid
                  className={`w-4 h-4 ${
                    isSecondaryRouteActive ? 'text-[#F59E0B]' : 'text-neutral-400'
                  }`}
                />
              )}
            </div>

            <span
              className={`relative z-10 text-[10px] font-bold tracking-tight truncate max-w-[54px] ${
                mobileHubOpen || isSecondaryRouteActive ? 'text-white' : 'text-neutral-400'
              }`}
            >
              {activeSecondaryItem ? activeSecondaryItem.label.split(' ')[0] : 'Menu'}
            </span>
          </button>
        </nav>
      </div>

      <OfflineIndicator />

      {/* ⌘K GLOBAL COMMAND PALETTE MODAL */}
      <AnimatePresence>
        {cmdOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.16 }}
            onClick={(e) => {
              if (e.target === e.currentTarget) setCmdOpen(false);
            }}
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 backdrop-blur-xs pt-16 px-3 sm:px-4"
            role="dialog"
            aria-modal="true"
            aria-label="Pencarian Cepat FitForge"
          >
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="w-full max-w-lg rounded-2xl bg-[#141418] border border-[#27272F] text-white shadow-2xl overflow-hidden"
            >
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-[#27272F]">
                <Search className="w-4 h-4 text-[#F97316] shrink-0" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari latihan (Push-ups, Squat, Bench Press)..."
                  className="w-full min-h-[44px] bg-transparent text-sm text-white placeholder-neutral-500 focus:outline-none min-w-0"
                />
                <button
                  type="button"
                  onClick={() => setCmdOpen(false)}
                  className="min-w-[44px] min-h-[44px] flex items-center justify-center text-neutral-400 hover:text-white cursor-pointer shrink-0"
                  aria-label="Tutup pencarian"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 max-h-[65dvh] overflow-y-auto space-y-4">
                <div>
                  <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                    Studio Latihan 3D
                  </p>
                  <div className="space-y-1">
                    {filteredExercises.map((ex) => (
                      <button
                        key={ex.id}
                        type="button"
                        onClick={() => {
                          setSelectedExerciseId(ex.id);
                          setCmdOpen(false);
                          router.push(`/workout?exercise=${ex.id}`);
                        }}
                        className="w-full min-h-[44px] flex items-center justify-between gap-2 px-3 py-2 rounded-xl hover:bg-[#202028] text-left transition cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Dumbbell className="w-4 h-4 text-[#F59E0B] shrink-0" />
                          <span className="text-sm font-medium text-white truncate">{ex.name}</span>
                        </div>
                        <span className="text-xs text-neutral-400 font-telemetry shrink-0">
                          {ex.sets} × {ex.reps}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-neutral-400 mb-1.5">
                    Navigasi Cepat
                  </p>
                  <div className="grid grid-cols-2 gap-1.5">
                    {NAV_ITEMS.map((item) => {
                      const Icon = item.icon;
                      return (
                        <button
                          key={item.href}
                          type="button"
                          onClick={() => {
                            setCmdOpen(false);
                            router.push(item.href);
                          }}
                          className="min-h-[44px] flex items-center gap-2 px-3 rounded-xl bg-[#0E0E11] hover:bg-[#202028] border border-[#27272F] text-xs font-medium text-neutral-200 transition cursor-pointer min-w-0"
                        >
                          <Icon className="w-3.5 h-3.5 text-[#F97316] shrink-0" />
                          <span className="truncate">{item.label}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function MobileDockTab({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className="relative flex-1 min-w-[44px] min-h-[48px] rounded-xl flex flex-col items-center justify-center gap-0.5 select-none active:scale-95 transition-transform"
    >
      {active && (
        <motion.div
          layoutId="mobile-dock-active-pill"
          className="absolute inset-x-1 inset-y-1 rounded-xl bg-[#1C1C22] border border-[#32323D]"
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        >
          <div className="absolute top-0 inset-x-3 h-[2px] rounded-full bg-gradient-to-r from-[#F97316] to-[#F59E0B]" />
        </motion.div>
      )}
      <div className="relative z-10">
        <Icon className={`w-4 h-4 ${active ? 'text-[#F59E0B]' : 'text-neutral-400'}`} />
      </div>
      <span
        className={`relative z-10 text-[10px] font-bold tracking-tight truncate max-w-[56px] ${
          active ? 'text-white' : 'text-neutral-400'
        }`}
      >
        {label}
      </span>
    </Link>
  );
}
