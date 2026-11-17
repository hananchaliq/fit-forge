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
  { href: '/run', label: 'Run Tracker', shortLabel: 'Lari GPS', icon: MapPin, desc: 'Kalman & Haversine' },
  { href: '/workout', label: 'Workout 3D', shortLabel: '3D Studio', icon: Box, desc: 'Anatomi 1024-Bit' },
  { href: '/plan', label: 'Weekly Plan', shortLabel: 'Plan 7H', icon: CalendarRange, desc: 'Poster Mingguan' },
  { href: '/nutrisi', label: 'Nutrisi AI', shortLabel: 'Nutrisi', icon: Utensils, desc: 'Kuliner & Makro' },
  { href: '/jadwal', label: 'Jadwal & Sholat', shortLabel: 'Jadwal', icon: BellRing, desc: 'Adzan & Alarm' },
  { href: '/analitik', label: 'Analitik', shortLabel: 'Analitik', icon: BarChart3, desc: 'Grafik Progres' },
  { href: '/pengaturan', label: 'Pengaturan', shortLabel: 'Akun', icon: Settings, desc: 'Profil & Cloud' },
];

const MOBILE_TRAY_ITEMS = [
  { href: '/plan', label: 'Weekly Plan', sub: 'Poster 7 Hari Gym & Rumah', icon: CalendarRange, accent: '#F97316' },
  { href: '/jadwal', label: 'Jadwal & Sholat', sub: 'Adzan Kemenag & Alarm', icon: BellRing, accent: '#10B981' },
  { href: '/analitik', label: 'Analitik Performa', sub: 'Tren Lari, Beban & Kalori', icon: BarChart3, accent: '#3B82F6' },
  { href: '/pengaturan', label: 'Pengaturan Akun', sub: 'Target Makro & Cloud Sync', icon: Settings, accent: '#F59E0B' },
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

  // Close mobile hub when route changes
  useEffect(() => {
    const t = window.setTimeout(() => {
      setMobileHubOpen(false);
      setNotifOpen(false);
    }, 0);
    return () => window.clearTimeout(t);
  }, [pathname]);

  // ⌘K / Ctrl+K Global Command Palette shortcut
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
    <div className="min-h-screen bg-[#0A0A0A] text-[#111111] dark:text-[#F8F9FA] flex flex-col selection:bg-[#F97316] selection:text-black">
      {/* =====================================================================
          UNIFIED KINETIC TOP HEADER (NO SIDEBAR — FULL-WIDTH NAVBAR ARCHITECTURE)
          ===================================================================== */}
      <header className="sticky top-0 z-40 bg-[#0A0A0A]/95 backdrop-blur-xl text-white border-b border-[#1E1E1E]">
        {/* Tier 1: Brand + Live Telemetry Pills + Command & Auth Controls */}
        <div className="max-w-[1440px] mx-auto h-16 px-3.5 sm:px-6 lg:px-8 flex items-center justify-between gap-2 sm:gap-4">
          {/* Left: Brand Emblem + Quick Streak Pill */}
          <div className="flex items-center gap-2.5 sm:gap-4 min-w-0">
            <Link href="/" className="flex items-center gap-2.5 group shrink-0">
              <motion.div
                whileHover={{ scale: 1.06, rotate: -3 }}
                whileTap={{ scale: 0.94 }}
                className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#EF4444] via-[#F97316] to-[#F59E0B] flex items-center justify-center text-black font-black text-base shadow-[0_0_20px_rgba(249,115,22,0.35)]"
              >
                F
              </motion.div>
              <div className="leading-none">
                <span className="text-base sm:text-lg font-extrabold tracking-tight text-white block">
                  FitForge
                </span>
                <span className="hidden sm:block text-[10px] text-neutral-400 font-semibold tracking-wider uppercase mt-0.5">
                  Performance OS
                </span>
              </div>
            </Link>

            {/* Interactive Streak & Golden Rules Pill (Desktop/Tablet md+) */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={handleQuickCheckIn}
              title="Klik untuk Check-in 5 Golden Rules Hari Ini"
              className="hidden md:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#161616] hover:bg-[#1E1E1E] border border-[#262626] text-xs font-bold text-white transition cursor-pointer shrink-0"
            >
              <Flame className="w-3.5 h-3.5 fill-[#F59E0B] text-[#F59E0B] shrink-0" />
              <span className="tabular-nums text-[#F59E0B]">{streakDays}h</span>
              <span className="text-neutral-500">·</span>
              <span className="text-[11px] text-neutral-300 tabular-nums">
                {checkedInFeedback ? (
                  <span className="text-emerald-400 font-bold">✓ Tercatat!</span>
                ) : (
                  `Rules ${completedRulesCount}/5`
                )}
              </span>
            </motion.button>

            {/* Quick Hydration Pill (Desktop/Tablet) */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={handleQuickWater}
              className="hidden lg:inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl bg-[#161616] hover:bg-[#1E1E1E] border border-[#262626] text-xs font-semibold text-sky-400 transition cursor-pointer shrink-0"
              title="Tambah +250ml Air Putih"
            >
              <Droplets className="w-3.5 h-3.5" />
              <span className="tabular-nums">{(waterMl / 1000).toFixed(2)}L</span>
              <span className="px-1.5 py-0.2 rounded bg-sky-500/20 text-[10px] font-extrabold text-sky-300">
                {waterPulse ? '+250ml!' : '+250ml'}
              </span>
            </motion.button>
          </div>

          {/* Center/Right: Search Command Bar + Action Icons */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            {/* Search Trigger: Compact icon on mobile, full bar on sm+ */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => setCmdOpen(true)}
              className="flex items-center justify-center sm:justify-between gap-2.5 p-2 sm:px-3 sm:py-1.5 rounded-xl bg-[#161616] hover:bg-[#1E1E1E] border border-[#262626] text-xs text-neutral-400 transition sm:w-52 lg:w-64 cursor-pointer"
              aria-label="Cari latihan, makanan, atau rute (Command K)"
            >
              <div className="flex items-center gap-2 truncate">
                <Search className="w-4 h-4 text-neutral-300 shrink-0" />
                <span className="hidden sm:inline truncate">Cari latihan, rute...</span>
              </div>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-[#262626] text-neutral-300 rounded">
                ⌘K
              </kbd>
            </motion.button>

            {/* Guide Button (sm+ in header; accessible in Bento Hub & Banner on mobile) */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => setGuideOpen(true)}
              className="hidden sm:inline-flex items-center gap-1.5 p-2 sm:px-2.5 sm:py-1.5 rounded-xl bg-[#161616] hover:bg-[#262626] border border-[#262626] text-xs font-semibold text-[#F59E0B] transition cursor-pointer"
              title="Buka Panduan Penggunaan"
              aria-label="Panduan"
            >
              <BookOpen className="w-4 h-4 sm:w-3.5 sm:h-3.5" />
              <span className="hidden xl:inline">Panduan</span>
            </motion.button>

            {/* PWA Install Button */}
            <PWAInstallButton />

            {/* Theme Toggle */}
            <motion.button
              type="button"
              whileTap={{ scale: 0.9, rotate: 15 }}
              onClick={toggleDarkMode}
              className="p-2 rounded-xl bg-[#161616] hover:bg-[#262626] border border-[#262626] text-neutral-300 transition cursor-pointer"
              aria-label={darkMode ? 'Aktifkan Mode Terang' : 'Aktifkan Mode Gelap'}
              title={darkMode ? 'Mode Terang' : 'Mode Gelap'}
            >
              {darkMode ? (
                <Sun className="w-4 h-4 text-[#F59E0B]" />
              ) : (
                <Moon className="w-4 h-4 text-neutral-300" />
              )}
            </motion.button>

            {/* Notification Bell + Animated Popover */}
            <div className="relative">
              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={() => setNotifOpen((prev) => !prev)}
                className="relative p-2 rounded-xl bg-[#161616] hover:bg-[#262626] border border-[#262626] text-neutral-300 transition cursor-pointer"
                aria-label="Buka notifikasi pengingat"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#EF4444]" />
              </motion.button>

              <AnimatePresence>
                {notifOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    transition={{ duration: 0.18 }}
                    className="fixed sm:absolute right-3 sm:right-0 top-16 sm:top-auto sm:mt-2 w-[calc(100vw-24px)] max-w-xs rounded-2xl bg-[#161616] border border-[#2E2E2E] p-4 shadow-2xl z-50 text-white"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-white">
                        Telemetri & Pengingat Aktif
                      </span>
                      <span className="text-[11px] text-[#F59E0B] tabular-nums font-semibold">
                        Hidrasi: {waterMl} ml
                      </span>
                    </div>
                    <div className="space-y-2.5 text-xs">
                      <div className="p-2.5 rounded-xl bg-[#0E0E0E] border border-[#262626] flex items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-white">Target Hidrasi Jam Ini</p>
                          <p className="text-neutral-400">Tambahkan +250 ml air putih</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleQuickWater}
                          className="px-2.5 py-1.5 rounded-lg bg-[#F59E0B] text-black font-bold hover:opacity-90 cursor-pointer shrink-0"
                        >
                          +250ml
                        </button>
                      </div>
                      <div className="p-2.5 rounded-xl bg-[#0E0E0E] border border-[#262626] flex items-center justify-between gap-2">
                        <div>
                          <p className="font-semibold text-white">Jadwal Sholat & Alarm</p>
                          <p className="text-neutral-400">Metode Kemenag RI · {profile.city}</p>
                        </div>
                        <Link
                          href="/jadwal"
                          onClick={() => setNotifOpen(false)}
                          className="text-[#F97316] font-bold hover:underline shrink-0"
                        >
                          Buka →
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Profile / Google Login Button */}
            {isAuthenticated ? (
              <Link
                href="/pengaturan"
                className="flex items-center gap-2 pl-1.5 pr-2.5 py-1.5 rounded-xl bg-[#161616] hover:bg-[#262626] border border-[#262626] transition shrink-0"
              >
                <div className="w-6 h-6 rounded-lg bg-gradient-to-tr from-[#F97316] to-[#F59E0B] text-black font-extrabold text-xs flex items-center justify-center">
                  {profile.displayName.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:inline text-xs font-semibold text-white max-w-[100px] truncate">
                  {profile.displayName}
                </span>
              </Link>
            ) : (
              <motion.button
                type="button"
                whileTap={{ scale: 0.95 }}
                onClick={handleGoogleSignIn}
                className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#EF4444] via-[#F97316] to-[#F59E0B] text-black text-xs font-extrabold hover:opacity-95 transition whitespace-nowrap cursor-pointer shrink-0"
              >
                <LogIn className="w-3.5 h-3.5 stroke-[2.5]" />
                <span className="hidden xs:inline sm:inline">Masuk</span>
                <span className="hidden md:inline">Google</span>
              </motion.button>
            )}
          </div>
        </div>

        {/* Tier 2 (Desktop >= 768px): Animated Horizontal Kinetic Pill Navbar (Replaces Redundant Sidebar) */}
        <div className="hidden md:block border-t border-[#161616] bg-[#0E0E0E]/90">
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
                    className={`relative px-3.5 py-1.5 rounded-xl text-xs font-semibold transition-colors whitespace-nowrap flex items-center gap-2 select-none ${
                      isActive
                        ? 'text-white'
                        : 'text-neutral-400 hover:text-white hover:bg-[#161616]/60'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="desktop-kinetic-nav-pill"
                        className="absolute inset-0 rounded-xl bg-[#1E1E1E] border border-[#333333] shadow-sm"
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      >
                        <div className="absolute bottom-0 inset-x-3 h-[2px] rounded-full bg-gradient-to-r from-[#EF4444] via-[#F97316] to-[#F59E0B]" />
                      </motion.div>
                    )}
                    <Icon
                      className={`relative z-10 w-3.5 h-3.5 transition-transform duration-200 ${
                        isActive ? 'text-[#F97316] scale-110' : 'text-neutral-400'
                      }`}
                    />
                    <span className="relative z-10">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            {/* Right Desktop Quick Check-in CTA */}
            <div className="hidden xl:flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2 text-[11px] text-neutral-400">
                <span>Golden Rules:</span>
                <div className="w-20 h-1.5 bg-[#1E1E1E] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-[#F97316] to-[#F59E0B]"
                    initial={false}
                    animate={{ width: `${(completedRulesCount / 5) * 100}%` }}
                    transition={{ type: 'spring', stiffness: 300, damping: 28 }}
                  />
                </div>
                <strong className="text-white tabular-nums">{completedRulesCount}/5</strong>
              </div>
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                onClick={handleQuickCheckIn}
                className="px-3 py-1 rounded-lg bg-gradient-to-r from-[#F97316] to-[#F59E0B] text-black text-[11px] font-extrabold flex items-center gap-1 cursor-pointer"
              >
                {checkedInFeedback ? (
                  <>
                    <CheckCircle2 className="w-3 h-3" />
                    <span>Check-in Tercatat!</span>
                  </>
                ) : (
                  <>
                    <span>Check-in</span>
                    <ArrowRight className="w-3 h-3" />
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </div>
      </header>

      {/* =====================================================================
          MAIN CONTENT CANVAS WITH KINETIC ROUTE ENTRANCE
          ===================================================================== */}
      <main className="flex-1 bg-[#F8F9FA] dark:bg-[#0E0E0E] px-3.5 sm:px-6 lg:px-8 py-5 sm:py-7 pb-28 md:pb-10 overflow-x-hidden">
        <div className="max-w-[1440px] mx-auto">
          {!isAuthenticated && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="mb-5 p-3.5 rounded-2xl bg-[#141414] text-white border border-[#262626] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm"
            >
              <div className="text-xs text-neutral-300 leading-relaxed">
                <strong className="text-[#F59E0B]">Mode Pratinjau (Belum Login):</strong> Semua angka saat ini bernilai{' '}
                <code className="px-1 py-0.5 rounded bg-[#262626] text-white">0</code> (tanpa data dummy). Masuk dengan akun Google agar data latihan, lari GPS, dan nutrisi tersimpan permanen di database akun Anda.
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setGuideOpen(true)}
                  className="px-3 py-1.5 rounded-xl bg-[#262626] hover:bg-[#333333] text-xs font-semibold text-white transition cursor-pointer"
                >
                  Panduan
                </button>
                <button
                  type="button"
                  onClick={handleGoogleSignIn}
                  className="px-3.5 py-1.5 rounded-xl bg-gradient-to-r from-[#F97316] to-[#F59E0B] text-black text-xs font-extrabold hover:opacity-95 transition cursor-pointer"
                >
                  Masuk dengan Google →
                </button>
              </div>
            </motion.div>
          )}

          {/* Animated Page Header + Dynamic Route Content */}
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.26, ease: [0.22, 1, 0.36, 1] }}
          >
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3.5 mb-6">
              <div className="min-w-0">
                <h1 className="text-xl sm:text-[28px] sm:leading-[34px] font-extrabold tracking-tight text-[#111111] dark:text-white truncate">
                  {title}
                </h1>
                <p className="text-xs sm:text-sm text-[#6B7280] dark:text-neutral-400 mt-0.5 line-clamp-2 sm:line-clamp-1">
                  {subtitle}
                </p>
              </div>

              {onCtaClick ? (
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={onCtaClick}
                  className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#161616] hover:bg-[#262626] dark:bg-gradient-to-r dark:from-[#F97316] dark:to-[#F59E0B] text-white dark:text-black text-xs sm:text-sm font-extrabold shadow-sm transition self-start sm:self-auto whitespace-nowrap shrink-0 cursor-pointer"
                >
                  <Play className="w-3.5 h-3.5 text-[#F59E0B] fill-[#F59E0B] dark:text-black dark:fill-black" />
                  <span>{ctaLabel}</span>
                </motion.button>
              ) : (
                <Link
                  href={ctaHref}
                  className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-[#161616] hover:bg-[#262626] dark:bg-gradient-to-r dark:from-[#F97316] dark:to-[#F59E0B] text-white dark:text-black text-xs sm:text-sm font-extrabold shadow-sm transition self-start sm:self-auto whitespace-nowrap shrink-0"
                >
                  <Play className="w-3.5 h-3.5 text-[#F59E0B] fill-[#F59E0B] dark:text-black dark:fill-black" />
                  <span>{ctaLabel}</span>
                </Link>
              )}
            </div>

            {children}
          </motion.div>
        </div>
      </main>

      {/* =====================================================================
          MOBILE FLOATING KINETIC BOTTOM DOCK NAVBAR (< 768px) — NO SIDEBAR!
          ===================================================================== */}
      <AnimatePresence>
        {mobileHubOpen && (
          <div key="mobile-bento-hub-container" className="md:hidden">
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={() => setMobileHubOpen(false)}
              className="fixed inset-0 bg-black/75 backdrop-blur-xs z-40"
            />

            {/* Floating Expandable Bento Hub Sheet right above Bottom Dock */}
            <motion.div
              initial={{ opacity: 0, y: 40, scale: 0.95 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 36, scale: 0.95 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="fixed bottom-20 inset-x-3 z-50 rounded-3xl bg-[#121214]/98 border border-[#2A2A2E] p-4 text-white shadow-[0_20px_60px_rgba(0,0,0,0.85)]"
              role="dialog"
              aria-label="Menu Navigasi & Telemetri Cepat"
            >
              {/* Header inside Bento Hub */}
              <div className="flex items-center justify-between pb-3 mb-3 border-b border-[#242428]">
                <div className="flex items-center gap-2">
                  <Sparkles className="w-4 h-4 text-[#F59E0B]" />
                  <span className="text-xs font-extrabold uppercase tracking-wider text-white">
                    Menu Lengkap & Telemetri Cepat
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileHubOpen(false);
                      setGuideOpen(true);
                    }}
                    className="px-2.5 py-1 rounded-lg bg-[#1E1E22] text-[#F59E0B] text-[11px] font-bold flex items-center gap-1 cursor-pointer"
                  >
                    <BookOpen className="w-3 h-3" />
                    <span>Panduan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileHubOpen(false)}
                    className="p-1 rounded-lg bg-[#1E1E22] text-neutral-400 hover:text-white cursor-pointer"
                    aria-label="Tutup menu hub"
                  >
                    <X className="w-4 h-4" />
                  </button>
                </div>
              </div>

              {/* 2x2 Bento Grid for Plan, Jadwal, Analitik, Pengaturan */}
              <div className="grid grid-cols-2 gap-2.5 mb-3.5">
                {MOBILE_TRAY_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const active = pathname === item.href || pathname?.startsWith(item.href);
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileHubOpen(false)}
                      className={`p-3 rounded-2xl border transition flex flex-col justify-between ${
                        active
                          ? 'bg-[#222226] border-[#F97316] text-white'
                          : 'bg-[#18181B] hover:bg-[#202024] border-[#26262A] text-neutral-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-2">
                        <div
                          className="w-8 h-8 rounded-xl flex items-center justify-center"
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
                      <div>
                        <p className="text-xs font-bold text-white">{item.label}</p>
                        <p className="text-[10px] text-neutral-400 mt-0.5 line-clamp-1">
                          {item.sub}
                        </p>
                      </div>
                    </Link>
                  );
                })}
              </div>

              {/* Quick Daily Golden Rules & Hydration Action Row */}
              <div className="p-3 rounded-2xl bg-[#0B0B0D] border border-[#242428] mb-3">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-bold text-neutral-300">
                    Daily Golden Rules ({completedRulesCount}/5)
                  </span>
                  <span className="inline-flex items-center gap-1 text-[11px] font-extrabold text-[#F59E0B] tabular-nums">
                    <Flame className="w-3.5 h-3.5 fill-[#F59E0B]" />
                    {streakDays} Hari Streak
                  </span>
                </div>
                <div className="w-full h-1.5 bg-[#1E1E22] rounded-full overflow-hidden mb-3">
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
                    className="py-2 px-3 rounded-xl bg-gradient-to-r from-[#F97316] to-[#F59E0B] text-black text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5" />
                    <span>Check-in 5 Rules</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleQuickWater}
                    className="py-2 px-3 rounded-xl bg-[#1A1A1E] border border-[#2E2E34] text-sky-400 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <Droplets className="w-3.5 h-3.5" />
                    <span>+250ml ({(waterMl / 1000).toFixed(1)}L)</span>
                  </button>
                </div>
              </div>

              {/* Mobile PWA Install Action */}
              <PWAInstallButton fullWidthMobile />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* FLOATING KINETIC BOTTOM DOCK (< 768px) */}
      <div className="md:hidden fixed bottom-2.5 inset-x-3 z-40 pointer-events-none">
        <nav
          className="pointer-events-auto h-16 rounded-2xl bg-[#0D0D0F]/95 backdrop-blur-xl border border-[#28282D] px-2 flex items-center justify-between shadow-[0_14px_36px_rgba(0,0,0,0.75)] select-none"
          aria-label="Navigasi Bawah Mobile Interaktif"
        >
          {/* Tab 1: Dashboard */}
          <MobileDockTab
            href="/dashboard"
            label="Home"
            icon={LayoutDashboard}
            active={!mobileHubOpen && pathname === '/dashboard'}
          />

          {/* Tab 2: 3D Studio */}
          <MobileDockTab
            href="/workout"
            label="3D Studio"
            icon={Box}
            active={!mobileHubOpen && (pathname === '/workout' || Boolean(pathname?.startsWith('/workout')))}
          />

          {/* Center Slot 3: Kinetic GPS Run Action Orb */}
          <div className="relative -mt-6 flex flex-col items-center">
            <Link
              href="/run"
              aria-label="Mulai Lari GPS"
              className="group relative flex items-center justify-center"
            >
              {/* Subtle pulsing telemetry halo */}
              <motion.span
                aria-hidden="true"
                animate={{
                  scale: pathname === '/run' ? [1, 1.24, 1] : [1, 1.14, 1],
                  opacity: pathname === '/run' ? [0.55, 0, 0.55] : [0.3, 0, 0.3],
                }}
                transition={{ duration: 2.2, repeat: Infinity, ease: 'easeInOut' }}
                className="absolute inset-0 rounded-2xl bg-gradient-to-tr from-[#EF4444] via-[#F97316] to-[#F59E0B]"
              />
              <motion.div
                whileHover={{ scale: 1.06 }}
                whileTap={{ scale: 0.9 }}
                className={`relative w-12 h-12 rounded-2xl flex items-center justify-center border-2 transition-shadow ${
                  pathname === '/run'
                    ? 'bg-gradient-to-tr from-[#EF4444] via-[#F97316] to-[#F59E0B] text-black border-white shadow-[0_0_24px_rgba(249,115,22,0.7)]'
                    : 'bg-gradient-to-tr from-[#F97316] to-[#F59E0B] text-black border-[#0D0D0F] shadow-[0_6px_20px_rgba(249,115,22,0.45)]'
                }`}
              >
                <MapPin className="w-5 h-5 stroke-[2.5]" />
              </motion.div>
            </Link>
            <span
              className={`text-[10px] font-extrabold mt-0.5 tracking-tight ${
                pathname === '/run' ? 'text-[#F59E0B]' : 'text-neutral-300'
              }`}
            >
              Lari GPS
            </span>
          </div>

          {/* Tab 4: Nutrisi AI */}
          <MobileDockTab
            href="/nutrisi"
            label="Nutrisi"
            icon={Utensils}
            active={!mobileHubOpen && (pathname === '/nutrisi' || Boolean(pathname?.startsWith('/nutrisi')))}
          />

          {/* Tab 5: Interactive Expandable Hub (Plan, Jadwal, Analitik, Pengaturan) */}
          <button
            type="button"
            onClick={() => setMobileHubOpen((prev) => !prev)}
            data-testid="mobile-dock-hub-btn"
            aria-label="Buka menu lengkap Plan, Jadwal, Analitik dan Pengaturan"
            aria-expanded={mobileHubOpen}
            className="relative flex-1 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 cursor-pointer active:scale-95 transition-transform"
          >
            {(mobileHubOpen || isSecondaryRouteActive) && (
              <motion.div
                layoutId="mobile-dock-active-pill"
                className="absolute inset-x-1.5 inset-y-1 rounded-xl bg-[#1F1F24] border border-[#34343C]"
                transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              >
                <div className="absolute top-0 inset-x-3 h-[2px] rounded-full bg-gradient-to-r from-[#F97316] to-[#F59E0B]" />
              </motion.div>
            )}

            <motion.div
              animate={{
                rotate: mobileHubOpen ? 90 : 0,
                y: mobileHubOpen || isSecondaryRouteActive ? -1 : 0,
              }}
              transition={{ type: 'spring', stiffness: 400, damping: 26 }}
              className="relative z-10"
            >
              {mobileHubOpen ? (
                <X className="w-4 h-4 text-[#F59E0B]" />
              ) : (
                <LayoutGrid
                  className={`w-4 h-4 ${
                    isSecondaryRouteActive ? 'text-[#F59E0B]' : 'text-neutral-400'
                  }`}
                />
              )}
            </motion.div>

            <span
              className={`relative z-10 text-[10px] font-bold tracking-tight truncate max-w-[60px] ${
                mobileHubOpen || isSecondaryRouteActive
                  ? 'text-white'
                  : 'text-neutral-400'
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
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 backdrop-blur-xs pt-16 px-4"
            role="dialog"
            aria-modal="true"
            aria-label="Pencarian Cepat FitForge"
          >
            <motion.div
              initial={{ opacity: 0, y: -14, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -10, scale: 0.96 }}
              transition={{ type: 'spring', stiffness: 420, damping: 32 }}
              className="w-full max-w-lg rounded-2xl bg-[#161616] border border-[#262626] text-white shadow-2xl overflow-hidden"
            >
              <div className="flex items-center gap-3 px-4 py-3.5 border-b border-[#262626]">
                <Search className="w-4 h-4 text-[#F97316]" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Ketik nama latihan (Push-ups, Squat, Bench Press) atau halaman..."
                  className="w-full bg-transparent text-sm text-white placeholder-neutral-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={() => setCmdOpen(false)}
                  className="p-1 text-neutral-400 hover:text-white cursor-pointer"
                  aria-label="Tutup pencarian"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 max-h-80 overflow-y-auto space-y-4">
                <div>
                  <p className="px-2 text-[11px] font-semibold text-neutral-400 mb-1.5">
                    Latihan Studio 3D (1024-Bit HD)
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
                        className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[#262626] text-left transition cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5">
                          <Dumbbell className="w-4 h-4 text-[#F59E0B]" />
                          <span className="text-sm font-medium text-white">{ex.name}</span>
                        </div>
                        <span className="text-xs text-neutral-400 tabular-nums">
                          {ex.sets} × {ex.reps}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="px-2 text-[11px] font-semibold text-neutral-400 mb-1.5">
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
                          className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0E0E0E] hover:bg-[#262626] border border-[#262626] text-xs font-medium text-neutral-200 transition cursor-pointer"
                        >
                          <Icon className="w-3.5 h-3.5 text-[#F97316]" />
                          <span>{item.label}</span>
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
      className="relative flex-1 h-12 rounded-xl flex flex-col items-center justify-center gap-0.5 select-none"
    >
      {active && (
        <motion.div
          layoutId="mobile-dock-active-pill"
          className="absolute inset-x-1.5 inset-y-1 rounded-xl bg-[#1F1F24] border border-[#34343C]"
          transition={{ type: 'spring', stiffness: 420, damping: 32 }}
        >
          <div className="absolute top-0 inset-x-3 h-[2px] rounded-full bg-gradient-to-r from-[#EF4444] via-[#F97316] to-[#F59E0B]" />
        </motion.div>
      )}
      <motion.div
        animate={{ y: active ? -1.5 : 0, scale: active ? 1.1 : 1 }}
        transition={{ type: 'spring', stiffness: 420, damping: 28 }}
        className="relative z-10"
      >
        <Icon className={`w-4 h-4 ${active ? 'text-[#F59E0B]' : 'text-neutral-400'}`} />
      </motion.div>
      <span
        className={`relative z-10 text-[10px] font-bold tracking-tight ${
          active ? 'text-white' : 'text-neutral-400'
        }`}
      >
        {label}
      </span>
    </Link>
  );
}
