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
  Loader2,
  LayoutGrid,
  Droplets,
} from 'lucide-react';
import { signInWithGoogleSafe } from '@/lib/firebase';
import { useFitForgeStore } from '@/store/useFitForgeStore';
import { EXERCISES } from '@/data/exercises';
import { PWAInstallButton, OfflineIndicator } from '@/components/pwa/PWAInstallButton';
import {
  ScrollProgressBar,
  MotionLine,
  MOTION_SPRING,
} from '@/components/ui/MotionPrimitives';

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
  { href: '/plan', label: 'Rencana 7 Hari', sub: 'Poster Gym & Rumah', icon: CalendarRange, accent: '#65C80B' },
  { href: '/jadwal', label: 'Sholat & Hidrasi', sub: 'Kemenag RI & Alarm', icon: BellRing, accent: '#10B981' },
  { href: '/analitik', label: 'Analitik Performa', sub: 'Volume, Protein & Lari', icon: BarChart3, accent: '#3B82F6' },
  { href: '/pengaturan', label: 'Pengaturan Akun', sub: 'Target Makro & Cloud', icon: Settings, accent: '#84E818' },
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
  const [authLoading, setAuthLoading] = useState(false);

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
    if (authLoading) return;
    setAuthLoading(true);
    try {
      const res = await signInWithGoogleSafe();
      if (res.ok) {
        setGuideOpen(true);
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
    <div className="min-h-dvh bg-[#F7F8F6] dark:bg-[#0B0D0E] text-[#0D0F10] dark:text-[#F5F7F5] flex flex-col selection:bg-[#84E818] selection:text-[#0D0F10]">
      <ScrollProgressBar />

      {/* =====================================================================
          ARCHITECTURAL TOP HEADER — TRUE LIGHT <-> DARK POLARITY INVERSION
          ===================================================================== */}
      <header
        className={`sticky top-0 z-40 pt-safe bg-white/95 dark:bg-[#0B0D0E]/95 backdrop-blur-md text-[#0D0F10] dark:text-white border-b transition-all duration-200 ${
          scrolled
            ? 'border-[#DFE2DC] dark:border-[#262B30] shadow-[0_6px_22px_rgba(13,15,16,0.06)] dark:shadow-[0_6px_22px_rgba(0,0,0,0.42)]'
            : 'border-[#E6E8E4] dark:border-[#1E2328]'
        }`}
      >
        <div
          className={`max-w-[1440px] mx-auto px-3 sm:px-6 lg:px-8 flex items-center justify-between gap-2 transition-[height] duration-200 ${
            scrolled ? 'h-13 sm:h-15' : 'h-14 sm:h-16'
          }`}
        >
          {/* Left: Clean Brand Emblem + Desktop Telemetry Actions */}
          <div className="flex items-center gap-2 sm:gap-3.5 min-w-0">
            <Link
              href="/"
              className="flex items-center gap-2.5 group min-h-[44px] min-w-0 pr-1"
              aria-label="Beranda FitForge"
            >
              <motion.div
                whileHover={{ scale: 1.06, rotate: -4 }}
                whileTap={{ scale: 0.94 }}
                transition={MOTION_SPRING}
                className="w-8 h-8 sm:w-9 sm:h-9 rounded-lg bg-[#0D0F10] dark:bg-[#F7F8F6] flex items-center justify-center text-[#84E818] dark:text-[#0D0F10] font-extrabold text-xs sm:text-sm tracking-tighter shrink-0"
              >
                FF
              </motion.div>
              <span className="text-[15px] sm:text-lg font-extrabold tracking-tight text-[#0D0F10] dark:text-white block truncate">
                FitForge
              </span>
            </Link>

            {/* Interactive Streak & Golden Rules (Desktop md+) */}
            <motion.button
              type="button"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.96 }}
              transition={MOTION_SPRING}
              onClick={handleQuickCheckIn}
              title="Klik untuk Check-in 5 Golden Rules Hari Ini"
              className="hidden md:inline-flex items-center gap-1.5 min-h-[38px] px-3 rounded-lg bg-[#F5F7F4] dark:bg-[#131618] hover:bg-[#ECFCD8] dark:hover:bg-[#1B1F23] border border-[#E3E6E0] dark:border-[#23282D] text-xs font-bold text-[#0D0F10] dark:text-white transition cursor-pointer shrink-0"
            >
              <Flame className="w-3.5 h-3.5 fill-[#65C80B] text-[#448500] dark:fill-[#84E818] dark:text-[#84E818] shrink-0" />
              <span className="font-telemetry text-[#3D7A00] dark:text-[#84E818]">{streakDays}h</span>
              <span className="text-[#C5CAC2] dark:text-neutral-600">·</span>
              <span className="text-[11px] text-[#5A6068] dark:text-neutral-300 tabular-nums">
                {checkedInFeedback ? (
                  <span className="text-[#3D7A00] dark:text-[#84E818] font-bold">Tercatat</span>
                ) : (
                  `Rules ${completedRulesCount}/5`
                )}
              </span>
            </motion.button>

            {/* Quick Hydration (Desktop lg+) */}
            <motion.button
              type="button"
              whileHover={{ y: -1 }}
              whileTap={{ scale: 0.94 }}
              transition={MOTION_SPRING}
              onClick={handleQuickWater}
              className="relative hidden lg:inline-flex items-center gap-1.5 min-h-[38px] px-3 rounded-lg bg-[#F5F7F4] dark:bg-[#131618] hover:bg-[#E0F2FE]/60 dark:hover:bg-[#1B1F23] border border-[#E3E6E0] dark:border-[#23282D] text-xs font-semibold text-[#075985] dark:text-sky-400 transition cursor-pointer shrink-0"
              title="Tambah +250ml Air Putih"
            >
              <Droplets className="w-3.5 h-3.5 shrink-0" />
              <span className="font-telemetry">{(waterMl / 1000).toFixed(2)}L</span>
              <span className="text-[10px] font-bold text-[#0369A1] dark:text-sky-300">
                +250ml
              </span>
              <AnimatePresence>
                {waterPulse && (
                  <motion.span
                    initial={{ opacity: 0, y: 4, scale: 0.85 }}
                    animate={{ opacity: 1, y: -22, scale: 1 }}
                    exit={{ opacity: 0, y: -32, scale: 0.9 }}
                    transition={MOTION_SPRING}
                    className="pointer-events-none absolute -top-1 right-2 px-1.5 py-0.5 rounded-md bg-[#0D0F10] dark:bg-[#F7F8F6] text-[#84E818] dark:text-[#0D0F10] text-[10px] font-black shadow-lg"
                  >
                    +250ml
                  </motion.span>
                )}
              </AnimatePresence>
            </motion.button>
          </div>

          {/* Right: Clean Mobile Controls (Search, Theme, Auth) + Full Desktop Controls */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">
            <motion.button
              type="button"
              whileTap={{ scale: 0.96 }}
              onClick={() => setCmdOpen(true)}
              className="flex items-center justify-center sm:justify-between gap-2 min-w-[40px] min-h-[40px] sm:px-3 rounded-lg bg-[#F5F7F4] dark:bg-[#131618] hover:bg-[#ECEFEA] dark:hover:bg-[#1B1F23] border border-[#E3E6E0] dark:border-[#23282D] text-xs text-[#5A6068] dark:text-[#9AA2AC] transition sm:w-44 lg:w-56 cursor-pointer"
              aria-label="Cari latihan, makanan, atau rute (Command K)"
            >
              <div className="flex items-center gap-2 min-w-0">
                <Search className="w-4 h-4 text-[#0D0F10] dark:text-neutral-300 shrink-0" />
                <span className="hidden sm:inline truncate">Cari latihan, rute...</span>
              </div>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-white dark:bg-[#23282D] border border-[#E3E6E0] dark:border-transparent text-[#5A6068] dark:text-neutral-300 rounded shrink-0">
                ⌘K
              </kbd>
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.95 }}
              onClick={() => setGuideOpen(true)}
              className="hidden sm:inline-flex items-center justify-center gap-1.5 min-w-[40px] min-h-[40px] px-3 rounded-lg bg-white dark:bg-[#131618] hover:bg-[#F5F7F4] dark:hover:bg-[#1B1F23] border border-[#E3E6E0] dark:border-[#23282D] text-xs font-semibold text-[#0D0F10] dark:text-white transition cursor-pointer"
              title="Buka Panduan Penggunaan"
              aria-label="Panduan"
            >
              <BookOpen className="w-3.5 h-3.5 text-[#448500] dark:text-[#84E818] shrink-0" />
              <span className="hidden xl:inline">Panduan</span>
            </motion.button>

            <div className="hidden sm:block">
              <PWAInstallButton />
            </div>

            {/* Theme Toggle with Morphing Animated Icon */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.04 }}
              whileTap={{ scale: 0.9 }}
              transition={MOTION_SPRING}
              onClick={toggleDarkMode}
              className="w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-[#131618] hover:bg-[#F5F7F4] dark:hover:bg-[#1B1F23] border border-[#E3E6E0] dark:border-[#23282D] text-[#0D0F10] dark:text-neutral-200 transition cursor-pointer overflow-hidden shrink-0"
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

            {/* Notification Bell (Desktop sm+ to keep mobile top bar crisp & uncluttered) */}
            <div className="relative hidden sm:block">
              <motion.button
                type="button"
                whileTap={{ scale: 0.92 }}
                onClick={() => setNotifOpen((prev) => !prev)}
                className="relative w-10 h-10 flex items-center justify-center rounded-full bg-white dark:bg-[#131618] hover:bg-[#F5F7F4] dark:hover:bg-[#1B1F23] border border-[#E3E6E0] dark:border-[#23282D] text-[#0D0F10] dark:text-neutral-200 transition cursor-pointer"
                aria-label="Buka notifikasi pengingat"
              >
                <Bell className="w-4 h-4" />
              </motion.button>

              <AnimatePresence>
                {notifOpen && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.97 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.97 }}
                    transition={{ duration: 0.18 }}
                    className="absolute right-0 mt-2 w-80 rounded-xl bg-white dark:bg-[#131618] border border-[#E3E6E0] dark:border-[#262B30] p-4 shadow-2xl z-50 text-[#0D0F10] dark:text-white"
                  >
                    <div className="flex items-center justify-between gap-2 mb-3">
                      <span className="text-xs font-bold truncate">Pengingat Aktif</span>
                      <span className="text-[11px] text-[#448500] dark:text-[#84E818] font-telemetry font-semibold shrink-0">
                        {waterMl} ml
                      </span>
                    </div>
                    <div className="space-y-2.5 text-xs">
                      <div className="p-3 rounded-lg bg-[#F7F8F6] dark:bg-[#0B0D0E] border border-[#E6E8E4] dark:border-[#23282D] flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold truncate">Hidrasi Jam Ini</p>
                          <p className="text-[#5A6068] dark:text-neutral-400 truncate">Tambah +250 ml air putih</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleQuickWater}
                          className="min-h-[36px] px-3 rounded-lg bg-[#0D0F10] dark:bg-[#F7F8F6] text-[#84E818] dark:text-[#0D0F10] font-bold hover:opacity-90 cursor-pointer shrink-0"
                        >
                          +250ml
                        </button>
                      </div>
                      <div className="p-3 rounded-lg bg-[#F7F8F6] dark:bg-[#0B0D0E] border border-[#E6E8E4] dark:border-[#23282D] flex items-center justify-between gap-2">
                        <div className="min-w-0">
                          <p className="font-semibold truncate">Jadwal Sholat</p>
                          <p className="text-[#5A6068] dark:text-neutral-400 truncate">Kemenag RI · {profile.city}</p>
                        </div>
                        <Link
                          href="/jadwal"
                          onClick={() => setNotifOpen(false)}
                          className="min-h-[36px] px-2.5 flex items-center text-[#3D7A00] dark:text-[#84E818] font-bold hover:underline shrink-0"
                        >
                          Buka →
                        </Link>
                      </div>
                    </div>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Profile / Google Login (Polarity Inverted Obsidian <-> Crisp White) */}
            {isAuthenticated ? (
              <Link
                href="/pengaturan"
                className="flex items-center justify-center gap-2 min-w-[40px] min-h-[40px] sm:pl-1.5 sm:pr-3 rounded-full bg-[#F5F7F4] dark:bg-[#131618] hover:bg-[#ECEFEA] dark:hover:bg-[#1B1F23] border border-[#E3E6E0] dark:border-[#23282D] transition shrink-0"
                aria-label={`Profil ${profile.displayName}`}
              >
                <div className="w-7 h-7 rounded-full bg-[#0D0F10] dark:bg-[#F7F8F6] text-[#84E818] dark:text-[#0D0F10] font-extrabold text-xs flex items-center justify-center shrink-0">
                  {profile.displayName.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:inline text-xs font-bold text-[#0D0F10] dark:text-white max-w-[96px] truncate">
                  {profile.displayName}
                </span>
              </Link>
            ) : (
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                transition={MOTION_SPRING}
                disabled={authLoading}
                onClick={handleGoogleSignIn}
                className="group inline-flex items-center justify-center gap-1.5 min-w-[40px] min-h-[40px] px-3.5 sm:px-4 rounded-full bg-[#0D0F10] dark:bg-[#F7F8F6] text-white dark:text-[#0D0F10] text-xs font-bold hover:opacity-92 disabled:opacity-60 transition whitespace-nowrap cursor-pointer shrink-0"
              >
                {authLoading ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin text-[#84E818] dark:text-[#448500] shrink-0" />
                ) : (
                  <LogIn className="w-3.5 h-3.5 text-[#84E818] dark:text-[#448500] stroke-[2.5] shrink-0" />
                )}
                <span className="hidden min-[360px]:inline">
                  {authLoading ? 'Masuk...' : 'Masuk'}
                </span>
                <span className="hidden md:inline">{authLoading ? '' : 'Google'}</span>
              </motion.button>
            )}
          </div>
        </div>

        {/* Tier 2 (Desktop >= 768px): Architectural Kinetic Navigation Bar */}
        <div className="hidden md:block border-t border-[#EFF1EE] dark:border-[#191D21] bg-[#FAFBFA]/95 dark:bg-[#0E1113]/95">
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
                    className={`relative px-3.5 min-h-[34px] rounded-lg text-xs font-semibold transition-colors whitespace-nowrap flex items-center gap-2 select-none ${
                      isActive
                        ? 'text-white dark:text-[#0D0F10]'
                        : 'text-[#5A6068] dark:text-[#9AA2AC] hover:text-[#0D0F10] dark:hover:text-white hover:bg-[#EFF1EE] dark:hover:bg-[#171B1F]'
                    }`}
                  >
                    {isActive && (
                      <motion.div
                        layoutId="desktop-kinetic-nav-pill"
                        className="absolute inset-0 rounded-lg bg-[#0D0F10] dark:bg-[#F7F8F6] shadow-xs"
                        transition={MOTION_SPRING}
                      />
                    )}
                    <Icon
                      className={`relative z-10 w-3.5 h-3.5 transition-transform duration-200 ${
                        isActive
                          ? 'text-[#84E818] dark:text-[#448500]'
                          : 'text-[#6A717A] dark:text-[#9AA2AC]'
                      }`}
                    />
                    <span className="relative z-10">{item.label}</span>
                  </Link>
                );
              })}
            </nav>

            <div className="hidden xl:flex items-center gap-3 shrink-0">
              <div className="flex items-center gap-2 text-[11px] text-[#5A6068] dark:text-[#9AA2AC]">
                <span>Golden Rules</span>
                <div className="w-20 h-1.5 bg-[#E6E8E4] dark:bg-[#1F2429] rounded-full overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-[#5BB808] to-[#84E818]"
                    initial={false}
                    animate={{ width: `${(completedRulesCount / 5) * 100}%` }}
                    transition={MOTION_SPRING}
                  />
                </div>
                <strong className="text-[#0D0F10] dark:text-white font-telemetry">
                  {completedRulesCount}/5
                </strong>
              </div>
              <motion.button
                type="button"
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.96 }}
                onClick={handleQuickCheckIn}
                className="group px-3.5 h-8 rounded-full bg-[#0D0F10] dark:bg-[#F7F8F6] text-white dark:text-[#0D0F10] text-[11px] font-bold flex items-center gap-1.5 cursor-pointer"
              >
                {checkedInFeedback ? (
                  <>
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#84E818] dark:text-[#448500]" />
                    <span>Tercatat</span>
                  </>
                ) : (
                  <>
                    <span>Check-in</span>
                    <ArrowRight className="w-3.5 h-3.5 text-[#84E818] dark:text-[#448500] group-hover:translate-x-0.5 transition-transform" />
                  </>
                )}
              </motion.button>
            </div>
          </div>
        </div>
      </header>

      {/* =====================================================================
          MAIN CONTENT CANVAS (CRISP GALLERY WHITE / OBSIDIAN DARK)
          ===================================================================== */}
      <main className="flex-1 bg-[#F7F8F6] dark:bg-[#0B0D0E] px-3 sm:px-6 lg:px-8 py-5 sm:py-7 main-mobile-safe md:pb-10 overflow-x-clip">
        <div className="max-w-[1440px] mx-auto min-w-0">
          {!isAuthenticated && (
            <div className="mb-5 p-3.5 sm:p-4 rounded-xl bg-white dark:bg-[#131618] text-[#0D0F10] dark:text-white border border-[#E3E6E0] dark:border-[#23282D] flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
              <div className="text-xs text-[#525860] dark:text-neutral-300 leading-relaxed min-w-0">
                <strong className="text-[#3D7A00] dark:text-[#84E818]">Mode Lokal Aktif:</strong> Data dimulai bersih dari{' '}
                <span className="font-telemetry font-bold text-[#0D0F10] dark:text-white">0</span>. Masuk dengan Google untuk sinkronisasi cloud lintas perangkat.
              </div>
              <div className="flex items-center gap-2 shrink-0 flex-wrap">
                <button
                  type="button"
                  onClick={() => setGuideOpen(true)}
                  className="min-h-[38px] px-3.5 rounded-lg bg-[#F5F7F4] dark:bg-[#1B1F23] hover:bg-[#EAECE8] dark:hover:bg-[#23282D] border border-[#E3E6E0] dark:border-[#2C3238] text-xs font-semibold text-[#0D0F10] dark:text-white transition cursor-pointer"
                >
                  Panduan
                </button>
                <button
                  type="button"
                  disabled={authLoading}
                  onClick={handleGoogleSignIn}
                  className="group inline-flex items-center gap-1.5 min-h-[38px] px-4 rounded-full bg-[#0D0F10] dark:bg-[#F7F8F6] text-white dark:text-[#0D0F10] text-xs font-bold hover:opacity-92 disabled:opacity-60 transition cursor-pointer"
                >
                  {authLoading ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[#84E818] dark:text-[#448500]" />
                  ) : null}
                  <span>{authLoading ? 'Menghubungkan...' : 'Masuk Google'}</span>
                  {!authLoading && (
                    <ArrowRight className="w-3.5 h-3.5 text-[#84E818] dark:text-[#448500] group-hover:translate-x-0.5 transition-transform" />
                  )}
                </button>
              </div>
            </div>
          )}

          {/* Page Header & Route Content */}
          <motion.div
            key={pathname}
            initial={false}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.24, ease: [0.22, 1, 0.36, 1] }}
            className="min-w-0"
          >
            <div className="mb-6">
              <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3.5 pb-4">
                <div className="min-w-0">
                  <h1 className="text-fluid-title font-extrabold tracking-tight text-[#0D0F10] dark:text-white break-words">
                    {title}
                  </h1>
                  <p className="text-xs sm:text-sm text-[#5A6068] dark:text-[#9AA2AC] mt-1 line-clamp-2 sm:line-clamp-1">
                    {subtitle}
                  </p>
                </div>

                {onCtaClick ? (
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.97 }}
                    transition={MOTION_SPRING}
                    onClick={onCtaClick}
                    className="group inline-flex items-center justify-center gap-2.5 min-h-[42px] px-5 py-2.5 rounded-full bg-[#0D0F10] hover:bg-[#1B1F23] dark:bg-[#F7F8F6] dark:hover:bg-white text-white dark:text-[#0D0F10] text-xs sm:text-sm font-bold shadow-xs transition self-start sm:self-auto whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Play className="w-3.5 h-3.5 text-[#84E818] fill-[#84E818] dark:text-[#448500] dark:fill-[#448500] shrink-0" />
                    <span>{ctaLabel}</span>
                  </motion.button>
                ) : (
                  <Link
                    href={ctaHref}
                    className="group inline-flex items-center justify-center gap-2.5 min-h-[42px] px-5 py-2.5 rounded-full bg-[#0D0F10] hover:bg-[#1B1F23] dark:bg-[#F7F8F6] dark:hover:bg-white text-white dark:text-[#0D0F10] text-xs sm:text-sm font-bold shadow-xs transition self-start sm:self-auto whitespace-nowrap shrink-0"
                  >
                    <Play className="w-3.5 h-3.5 text-[#84E818] fill-[#84E818] dark:text-[#448500] dark:fill-[#448500] shrink-0" />
                    <span>{ctaLabel}</span>
                  </Link>
                )}
              </div>
              <MotionLine />
            </div>

            {children}
          </motion.div>
        </div>
      </main>

      {/* =====================================================================
          MOBILE EXPANDABLE MENU SHEET (DRAG-TO-DISMISS)
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
              className="fixed inset-0 bg-black/65 backdrop-blur-xs z-40"
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
              initial={{ opacity: 0, y: 36 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 36 }}
              transition={MOTION_SPRING}
              className="fixed bottom-sheet-safe inset-x-3 z-50 rounded-xl bg-white dark:bg-[#131618] border border-[#E3E6E0] dark:border-[#262B30] p-4 text-[#0D0F10] dark:text-white shadow-[0_20px_60px_rgba(0,0,0,0.35)] max-h-[75dvh] overflow-y-auto"
              role="dialog"
              aria-label="Menu Navigasi & Telemetri Cepat"
            >
              <div className="w-9 h-1 rounded-full bg-[#D5D9D2] dark:bg-neutral-700 mx-auto mb-3" aria-hidden="true" />

              <div className="flex items-center justify-between gap-2 pb-3 mb-3 border-b border-[#EFF1EE] dark:border-[#23282D]">
                <div className="flex items-center gap-2 min-w-0">
                  <LayoutGrid className="w-4 h-4 text-[#448500] dark:text-[#84E818] shrink-0" />
                  <span className="text-xs font-bold truncate">Menu &amp; Aksi Cepat</span>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setMobileHubOpen(false);
                      setGuideOpen(true);
                    }}
                    className="min-h-[38px] px-3 rounded-lg bg-[#F5F7F4] dark:bg-[#1B1F23] text-[#3D7A00] dark:text-[#84E818] text-xs font-bold flex items-center gap-1.5 cursor-pointer"
                  >
                    <BookOpen className="w-3.5 h-3.5" />
                    <span>Panduan</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => setMobileHubOpen(false)}
                    className="w-9 h-9 flex items-center justify-center rounded-lg bg-[#F5F7F4] dark:bg-[#1B1F23] text-[#5A6068] dark:text-neutral-300 cursor-pointer"
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
                      initial={{ opacity: 0, y: 10 }}
                      animate={{ opacity: 1, y: 0 }}
                      transition={{ ...MOTION_SPRING, delay: idx * 0.03 }}
                      whileTap={{ scale: 0.97 }}
                    >
                      <Link
                        href={item.href}
                        onClick={() => setMobileHubOpen(false)}
                        className={`min-h-[78px] h-full p-3 rounded-xl border transition flex flex-col justify-between min-w-0 ${
                          active
                            ? 'bg-[#0D0F10] dark:bg-[#F7F8F6] border-[#84E818] text-white dark:text-[#0D0F10]'
                            : 'bg-[#F7F8F6] dark:bg-[#0E1113] border-[#E3E6E0] dark:border-[#23282D] text-[#0D0F10] dark:text-neutral-200'
                        }`}
                      >
                        <div className="w-8 h-8 rounded-lg bg-white dark:bg-[#181C20] border border-[#E3E6E0] dark:border-[#262B30] flex items-center justify-center mb-2 shrink-0">
                          <Icon className="w-4 h-4" style={{ color: item.accent }} />
                        </div>
                        <div className="min-w-0">
                          <p className="text-xs font-bold truncate">{item.label}</p>
                          <p className="text-[11px] opacity-70 mt-0.5 truncate">{item.sub}</p>
                        </div>
                      </Link>
                    </motion.div>
                  );
                })}
              </div>

              <div className="p-3 rounded-xl bg-[#F7F8F6] dark:bg-[#0B0D0E] border border-[#E3E6E0] dark:border-[#23282D] mb-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <span className="text-xs font-bold truncate">
                    Golden Rules ({completedRulesCount}/5)
                  </span>
                  <span className="inline-flex items-center gap-1 text-xs font-extrabold text-[#3D7A00] dark:text-[#84E818] font-telemetry shrink-0">
                    <Flame className="w-3.5 h-3.5 fill-[#84E818] text-[#448500] dark:text-[#84E818]" />
                    {streakDays} Hari
                  </span>
                </div>
                <div className="w-full h-1.5 bg-[#E6E8E4] dark:bg-[#1F2429] rounded-full overflow-hidden mb-3">
                  <div
                    className="h-full bg-gradient-to-r from-[#5BB808] to-[#84E818] transition-all duration-300"
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
                    className="min-h-[42px] px-3 rounded-lg bg-[#0D0F10] dark:bg-[#F7F8F6] text-white dark:text-[#0D0F10] text-xs font-extrabold flex items-center justify-center gap-1.5 cursor-pointer"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-[#84E818] dark:text-[#448500] shrink-0" />
                    <span className="truncate">Check-in 5</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleQuickWater}
                    className="min-h-[42px] px-3 rounded-lg bg-white dark:bg-[#131618] border border-[#E3E6E0] dark:border-[#262B30] text-[#075985] dark:text-sky-400 text-xs font-bold flex items-center justify-center gap-1.5 cursor-pointer"
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

      {/* =====================================================================
          EDGE-ANCHORED COMPACT MOBILE BOTTOM BAR (< 768px)
          True Polarity Inversion: Obsidian in Light Mode <-> Crisp White in Dark Mode
          ===================================================================== */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 z-40 pb-safe bg-[#0D0F10]/96 dark:bg-[#F7F8F6]/96 backdrop-blur-md border-t border-[#23282D] dark:border-[#DDE1DA] shadow-[0_-8px_24px_rgba(0,0,0,0.16)] select-none"
        aria-label="Navigasi Bawah Mobile"
      >
        <div className="h-[60px] max-w-lg mx-auto px-2 flex items-center justify-between gap-1">
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

          {/* Centered Flush Circular GPS Run Action (No Awkward Protruding Box) */}
          <Link
            href="/run"
            aria-label="Mulai Lari GPS"
            className="flex flex-col items-center justify-center min-w-[56px] min-h-[48px] px-1 shrink-0 active:scale-95 transition-transform"
          >
            <span
              className={`w-10 h-10 rounded-full flex items-center justify-center transition-all ${
                pathname === '/run'
                  ? 'bg-[#84E818] text-[#0D0F10] ring-2 ring-white dark:ring-[#0D0F10]'
                  : 'bg-[#84E818] text-[#0D0F10] shadow-[0_4px_14px_rgba(132,232,24,0.42)]'
              }`}
            >
              <MapPin className="w-[18px] h-[18px] stroke-[2.5]" />
            </span>
          </Link>

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
            className="relative flex-1 min-w-[44px] min-h-[48px] rounded-lg flex flex-col items-center justify-center gap-0.5 cursor-pointer active:scale-95 transition-transform"
          >
            {(mobileHubOpen || isSecondaryRouteActive) && (
              <motion.div
                layoutId="mobile-dock-active-pill"
                className="absolute inset-x-1 inset-y-1.5 rounded-lg bg-white/10 dark:bg-[#0D0F10]/8"
                transition={MOTION_SPRING}
              >
                <div className="absolute top-0 inset-x-3 h-[2px] rounded-full bg-[#84E818] dark:bg-[#448500]" />
              </motion.div>
            )}

            <div className="relative z-10">
              {mobileHubOpen ? (
                <X className="w-4 h-4 text-[#84E818] dark:text-[#448500]" />
              ) : (
                <LayoutGrid
                  className={`w-4 h-4 ${
                    isSecondaryRouteActive
                      ? 'text-[#84E818] dark:text-[#448500]'
                      : 'text-neutral-400 dark:text-[#5A6068]'
                  }`}
                />
              )}
            </div>

            <span
              className={`relative z-10 text-[10px] font-bold tracking-tight truncate max-w-[56px] ${
                mobileHubOpen || isSecondaryRouteActive
                  ? 'text-white dark:text-[#0D0F10]'
                  : 'text-neutral-400 dark:text-[#5A6068]'
              }`}
            >
              {activeSecondaryItem ? activeSecondaryItem.label.split(' ')[0] : 'Menu'}
            </span>
          </button>
        </div>
      </nav>

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
            className="fixed inset-0 z-50 flex items-start justify-center bg-black/65 backdrop-blur-xs pt-16 px-3 sm:px-4"
            role="dialog"
            aria-modal="true"
            aria-label="Pencarian Cepat FitForge"
          >
            <motion.div
              initial={{ opacity: 0, y: -12, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.97 }}
              transition={MOTION_SPRING}
              className="w-full max-w-lg rounded-xl bg-white dark:bg-[#131618] border border-[#E3E6E0] dark:border-[#262B30] text-[#0D0F10] dark:text-white shadow-2xl overflow-hidden"
            >
              <div className="flex items-center gap-2.5 px-3.5 py-2.5 border-b border-[#EFF1EE] dark:border-[#23282D]">
                <Search className="w-4 h-4 text-[#448500] dark:text-[#84E818] shrink-0" />
                <input
                  type="text"
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Cari latihan (Push-ups, Squat, Bench Press)..."
                  className="w-full min-h-[42px] bg-transparent text-sm text-[#0D0F10] dark:text-white placeholder-[#8B929B] focus:outline-none min-w-0"
                />
                <button
                  type="button"
                  onClick={() => setCmdOpen(false)}
                  className="w-9 h-9 flex items-center justify-center rounded-lg text-[#5A6068] hover:text-[#0D0F10] dark:hover:text-white cursor-pointer shrink-0"
                  aria-label="Tutup pencarian"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="p-3 max-h-[65dvh] overflow-y-auto space-y-4">
                <div>
                  <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-[#5A6068] dark:text-[#9AA2AC] mb-1.5">
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
                        className="w-full min-h-[42px] flex items-center justify-between gap-2 px-3 py-2 rounded-lg hover:bg-[#F5F7F4] dark:hover:bg-[#1B1F23] text-left transition cursor-pointer"
                      >
                        <div className="flex items-center gap-2.5 min-w-0">
                          <Dumbbell className="w-4 h-4 text-[#448500] dark:text-[#84E818] shrink-0" />
                          <span className="text-sm font-semibold truncate">{ex.name}</span>
                        </div>
                        <span className="text-xs text-[#5A6068] dark:text-[#9AA2AC] font-telemetry shrink-0">
                          {ex.sets} × {ex.reps}
                        </span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <p className="px-2 text-[11px] font-semibold uppercase tracking-wider text-[#5A6068] dark:text-[#9AA2AC] mb-1.5">
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
                          className="min-h-[42px] flex items-center gap-2 px-3 rounded-lg bg-[#F7F8F6] dark:bg-[#0E1113] hover:bg-[#ECFCD8] dark:hover:bg-[#1B1F23] border border-[#E3E6E0] dark:border-[#23282D] text-xs font-semibold transition cursor-pointer min-w-0"
                        >
                          <Icon className="w-3.5 h-3.5 text-[#448500] dark:text-[#84E818] shrink-0" />
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
      className="relative flex-1 min-w-[44px] min-h-[48px] rounded-lg flex flex-col items-center justify-center gap-0.5 select-none active:scale-95 transition-transform"
    >
      {active && (
        <motion.div
          layoutId="mobile-dock-active-pill"
          className="absolute inset-x-1 inset-y-1.5 rounded-lg bg-white/10 dark:bg-[#0D0F10]/8"
          transition={MOTION_SPRING}
        >
          <div className="absolute top-0 inset-x-3 h-[2px] rounded-full bg-[#84E818] dark:bg-[#448500]" />
        </motion.div>
      )}
      <motion.div
        animate={{ y: active ? -1 : 0, scale: active ? 1.06 : 1 }}
        transition={MOTION_SPRING}
        className="relative z-10"
      >
        <Icon
          className={`w-4 h-4 ${
            active
              ? 'text-[#84E818] dark:text-[#448500]'
              : 'text-neutral-400 dark:text-[#5A6068]'
          }`}
        />
      </motion.div>
      <span
        className={`relative z-10 text-[10px] font-bold tracking-tight truncate max-w-[56px] ${
          active
            ? 'text-white dark:text-[#0D0F10]'
            : 'text-neutral-400 dark:text-[#5A6068]'
        }`}
      >
        {label}
      </span>
    </Link>
  );
}
