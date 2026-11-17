'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
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
  Menu,
  X,
  ArrowRight,
  Bell,
  Play,
  CheckCircle2,
  Dumbbell,
  BookOpen,
  LogIn,
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
  { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
  { href: '/run', label: 'Run Tracker', icon: MapPin },
  { href: '/workout', label: 'Workout 3D', icon: Box },
  { href: '/plan', label: 'Weekly Plan', icon: CalendarRange },
  { href: '/nutrisi', label: 'Nutrisi AI', icon: Utensils },
  { href: '/jadwal', label: 'Jadwal & Sholat', icon: BellRing },
  { href: '/analitik', label: 'Analitik', icon: BarChart3 },
  { href: '/pengaturan', label: 'Pengaturan', icon: Settings },
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

  const [cmdOpen, setCmdOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
  const [notifOpen, setNotifOpen] = useState(false);
  const [checkedInFeedback, setCheckedInFeedback] = useState(false);

  const completedRulesCount = Object.values(goldenRules).filter(Boolean).length;

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', darkMode);
    }
  }, [darkMode]);

  // ⌘K / Ctrl+K Global Command Palette shortcut
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCmdOpen((prev) => !prev);
      } else if (e.key === 'Escape') {
        setCmdOpen(false);
        setNotifOpen(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const allExercises = Object.values(EXERCISES);
  const filteredExercises = searchQuery.trim()
    ? allExercises.filter((ex) =>
        ex.name.toLowerCase().includes(searchQuery.toLowerCase())
      ).slice(0, 6)
    : allExercises.slice(0, 5);

  const handleQuickCheckIn = () => {
    checkInAllGoldenRules();
    setCheckedInFeedback(true);
    setTimeout(() => setCheckedInFeedback(false), 2200);
  };

  return (
    <div className="min-h-screen bg-[#0E0E0E] text-[#111111] dark:text-[#F8F9FA] flex flex-col md:flex-row">
      {/* LEFT SIDEBAR 240px (OBSIDIAN - Matches ref-1 Quantro) */}
      <aside className="hidden md:flex md:w-[240px] md:shrink-0 md:sticky md:top-0 md:h-screen md:overflow-y-auto md:flex-col md:justify-between bg-[#0E0E0E] text-white px-4 py-5 select-none border-r border-[#1E1E1E]">
        <div>
          {/* Brand Logo */}
          <div className="flex items-center justify-between px-2 mb-7">
            <Link href="/" className="flex items-center gap-2.5 group">
              <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#F97316] to-[#F59E0B] flex items-center justify-center text-black font-black text-lg shadow-md">
                F
              </div>
              <div>
                <span className="text-lg font-bold tracking-tight text-white block leading-none">
                  FitForge
                </span>
                <span className="text-[11px] text-neutral-400 font-medium">
                  Performance OS
                </span>
              </div>
            </Link>
          </div>

          {/* Vertical Navigation */}
          <nav className="space-y-1" aria-label="Menu Utama">
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const isActive =
                pathname === item.href ||
                (item.href !== '/dashboard' && pathname?.startsWith(item.href));
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors whitespace-nowrap ${
                    isActive
                      ? 'bg-[#262626] text-white font-semibold'
                      : 'text-neutral-400 hover:text-white hover:bg-[#161616]'
                  }`}
                >
                  <Icon
                    className={`w-4 h-4 shrink-0 ${
                      isActive ? 'text-[#F97316]' : 'text-neutral-400'
                    }`}
                  />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Bottom Card: Daily Golden Rules · Streak */}
        <div className="mt-6 rounded-2xl bg-[#161616] border border-[#262626] p-4">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-xs font-semibold text-neutral-300">
              Daily Golden Rules
            </span>
            <span className="inline-flex items-center gap-1 text-xs font-bold text-[#F59E0B] tabular-nums">
              <Flame className="w-3.5 h-3.5 fill-[#F59E0B] text-[#F59E0B]" />
              {streakDays} hari
            </span>
          </div>
          <p className="text-xs text-neutral-400 mb-3 tabular-nums">
            Progres hari ini: <strong className="text-white">{completedRulesCount}/5</strong> target terpenuhi
          </p>
          <div className="w-full h-1.5 bg-[#262626] rounded-full overflow-hidden mb-3.5">
            <div
              className="h-full bg-gradient-to-r from-[#F97316] to-[#F59E0B] transition-all duration-300"
              style={{ width: `${(completedRulesCount / 5) * 100}%` }}
            />
          </div>
          <button
            type="button"
            onClick={handleQuickCheckIn}
            className="w-full py-2 px-3 rounded-xl bg-gradient-to-r from-[#F97316] to-[#F59E0B] text-xs font-bold text-black hover:opacity-95 transition flex items-center justify-center gap-1.5 cursor-pointer"
          >
            {checkedInFeedback ? (
              <>
                <CheckCircle2 className="w-3.5 h-3.5" />
                <span>Check-in Tercatat!</span>
              </>
            ) : (
              <>
                <span>Check-in</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </>
            )}
          </button>
        </div>
      </aside>

      {/* RIGHT COLUMN: TOPBAR (OBSIDIAN) + MAIN CANVAS (ALABASTER / DARK) */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Top Bar (Obsidian) */}
        <header className="h-16 bg-[#0E0E0E] text-white px-4 md:px-7 flex items-center justify-between gap-4 shrink-0">
          {/* Mobile menu button + brand */}
          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={() => setMobileDrawerOpen(true)}
              className="md:hidden p-2 rounded-xl bg-[#161616] border border-[#262626] text-neutral-200"
              aria-label="Buka menu navigasi"
            >
              <Menu className="w-5 h-5" />
            </button>
            <Link href="/" className="md:hidden font-bold text-base tracking-tight text-white">
              FitForge
            </Link>

            {/* Global Search (⌘K Command Palette Trigger) */}
            <button
              type="button"
              onClick={() => setCmdOpen(true)}
              className="flex items-center gap-3 px-3.5 py-2 rounded-xl bg-[#161616] hover:bg-[#1E1E1E] border border-[#262626] text-xs text-neutral-400 transition w-48 sm:w-72"
              aria-label="Cari latihan, makanan, atau rute (Command K)"
            >
              <Search className="w-4 h-4 text-neutral-400 shrink-0" />
              <span className="truncate text-left flex-1">
                Cari latihan, makanan, rute...
              </span>
              <kbd className="hidden sm:inline-block px-1.5 py-0.5 text-[10px] font-mono bg-[#262626] text-neutral-300 rounded">
                ⌘K
              </kbd>
            </button>
          </div>

          {/* Right Top Bar Controls */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#161616] hover:bg-[#262626] border border-[#262626] text-xs font-semibold text-[#F59E0B] transition cursor-pointer"
              title="Buka Panduan Penggunaan"
            >
              <BookOpen className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Panduan</span>
            </button>

            <PWAInstallButton />

            {/* Theme toggle */}
            <button
              type="button"
              onClick={toggleDarkMode}
              className="p-2 rounded-xl bg-[#161616] hover:bg-[#262626] border border-[#262626] text-neutral-300 transition"
              aria-label={darkMode ? 'Aktifkan Mode Terang' : 'Aktifkan Mode Gelap'}
              title={darkMode ? 'Mode Terang' : 'Mode Gelap'}
            >
              {darkMode ? (
                <Sun className="w-4 h-4 text-[#F59E0B]" />
              ) : (
                <Moon className="w-4 h-4 text-neutral-300" />
              )}
            </button>

            {/* Notification Bell + Popover */}
            <div className="relative">
              <button
                type="button"
                onClick={() => setNotifOpen((prev) => !prev)}
                className="relative p-2 rounded-xl bg-[#161616] hover:bg-[#262626] border border-[#262626] text-neutral-300 transition"
                aria-label="Buka notifikasi pengingat"
              >
                <Bell className="w-4 h-4" />
                <span className="absolute top-1.5 right-1.5 w-2 h-2 rounded-full bg-[#EF4444]" />
              </button>

              {notifOpen && (
                <div className="absolute right-0 mt-2 w-80 rounded-2xl bg-[#161616] border border-[#262626] p-4 shadow-2xl z-50 text-white">
                  <div className="flex items-center justify-between mb-3">
                    <span className="text-xs font-bold text-white">
                      Pengingat Aktif Hari Ini
                    </span>
                    <span className="text-[11px] text-[#F59E0B] tabular-nums">
                      Hidrasi: {waterMl} ml
                    </span>
                  </div>
                  <div className="space-y-2.5 text-xs">
                    <div className="p-2.5 rounded-xl bg-[#0E0E0E] border border-[#262626] flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-white">Target Hidrasi Jam Ini</p>
                        <p className="text-neutral-400">Tambahkan +250 ml air putih</p>
                      </div>
                      <button
                        type="button"
                        onClick={() => addWaterMl(250)}
                        className="px-2.5 py-1 rounded-lg bg-[#F59E0B] text-black font-bold hover:opacity-90"
                      >
                        +250ml
                      </button>
                    </div>
                    <div className="p-2.5 rounded-xl bg-[#0E0E0E] border border-[#262626] flex items-center justify-between">
                      <div>
                        <p className="font-semibold text-white">Jadwal Sholat & Alarm</p>
                        <p className="text-neutral-400">Metode Kemenag RI · {profile.city}</p>
                      </div>
                      <Link
                        href="/jadwal"
                        onClick={() => setNotifOpen(false)}
                        className="text-[#F97316] font-semibold hover:underline"
                      >
                        Buka →
                      </Link>
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Profile / Google Login Link */}
            {isAuthenticated ? (
              <Link
                href="/pengaturan"
                className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl bg-[#161616] hover:bg-[#262626] border border-[#262626] transition"
              >
                <div className="w-6 h-6 rounded-full bg-gradient-to-tr from-[#F97316] to-[#F59E0B] text-black font-bold text-xs flex items-center justify-center">
                  {profile.displayName.charAt(0).toUpperCase()}
                </div>
                <span className="hidden sm:inline text-xs font-semibold text-white whitespace-nowrap">
                  {profile.displayName}
                </span>
              </Link>
            ) : (
              <button
                type="button"
                onClick={handleGoogleSignIn}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-gradient-to-r from-[#EF4444] via-[#F97316] to-[#F59E0B] text-black text-xs font-extrabold hover:opacity-95 transition whitespace-nowrap cursor-pointer"
              >
                <LogIn className="w-3.5 h-3.5 stroke-[2.5]" />
                <span>Masuk Google</span>
              </button>
            )}
          </div>
        </header>

        {/* MAIN CONTENT CANVAS (#F8F9FA in light, #0E0E0E in dark, rounded-tl-3xl) */}
        <main className="flex-1 bg-[#F8F9FA] dark:bg-[#0E0E0E] md:rounded-tl-3xl border-t border-l border-[#EFEFEF] dark:border-[#262626] px-4 sm:px-6 lg:px-8 py-6 pb-24 md:pb-8 overflow-x-hidden">
          {!isAuthenticated && (
            <div className="mb-5 p-3.5 rounded-2xl bg-[#161616] text-white border border-[#262626] flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="text-xs text-neutral-300">
                <strong className="text-[#F59E0B]">Mode Pratinjau (Belum Login):</strong> Semua angka saat ini bernilai <code>0</code> (tanpa data dummy). Masuk dengan akun Google agar data latihan, lari GPS, dan nutrisi tersimpan permanen di database akun Anda.
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
            </div>
          )}
          {/* Page Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 mb-6">
            <div>
              <h1 className="text-2xl sm:text-[28px] sm:leading-[36px] font-bold tracking-tight text-[#111111] dark:text-white">
                {title}
              </h1>
              <p className="text-xs sm:text-sm text-[#6B7280] dark:text-neutral-400 mt-0.5">
                {subtitle}
              </p>
            </div>

            {onCtaClick ? (
              <button
                type="button"
                onClick={onCtaClick}
                className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-[#161616] hover:bg-[#262626] dark:bg-[#262626] dark:hover:bg-[#333333] text-white text-xs sm:text-sm font-semibold shadow-sm transition self-start sm:self-auto whitespace-nowrap shrink-0 cursor-pointer"
              >
                <Play className="w-4 h-4 text-[#F59E0B] fill-[#F59E0B]" />
                <span>{ctaLabel}</span>
              </button>
            ) : (
              <Link
                href={ctaHref}
                className="inline-flex items-center gap-2.5 px-4 py-2.5 rounded-full bg-[#161616] hover:bg-[#262626] dark:bg-[#262626] dark:hover:bg-[#333333] text-white text-xs sm:text-sm font-semibold shadow-sm transition self-start sm:self-auto whitespace-nowrap shrink-0"
              >
                <Play className="w-4 h-4 text-[#F59E0B] fill-[#F59E0B]" />
                <span>{ctaLabel}</span>
              </Link>
            )}
          </div>

          {children}
        </main>
      </div>

      {/* MOBILE BOTTOM TAB BAR (<768px) with center Amber FAB "Mulai Lari" */}
      <nav
        className="md:hidden fixed bottom-0 inset-x-0 h-16 bg-[#0E0E0E] border-t border-[#262626] px-2 flex items-center justify-around z-40"
        aria-label="Navigasi Bawah Mobile"
      >
        <Link
          href="/dashboard"
          className={`flex flex-col items-center gap-1 text-[11px] font-medium ${
            pathname === '/dashboard' ? 'text-[#F59E0B]' : 'text-neutral-400'
          }`}
        >
          <LayoutDashboard className="w-4 h-4" />
          <span>Dashboard</span>
        </Link>
        <Link
          href="/plan"
          className={`flex flex-col items-center gap-1 text-[11px] font-medium ${
            pathname === '/plan' ? 'text-[#F59E0B]' : 'text-neutral-400'
          }`}
        >
          <CalendarRange className="w-4 h-4" />
          <span>Plan</span>
        </Link>

        {/* Center Amber FAB: Mulai Lari */}
        <Link
          href="/run"
          className="flex items-center justify-center -mt-5 w-12 h-12 rounded-full bg-gradient-to-tr from-[#F97316] to-[#F59E0B] text-black shadow-lg border-4 border-[#0E0E0E]"
          aria-label="Mulai Lari GPS"
        >
          <MapPin className="w-5 h-5 stroke-[2.5]" />
        </Link>

        <Link
          href="/workout"
          className={`flex flex-col items-center gap-1 text-[11px] font-medium ${
            pathname === '/workout' ? 'text-[#F59E0B]' : 'text-neutral-400'
          }`}
        >
          <Box className="w-4 h-4" />
          <span>3D Studio</span>
        </Link>
        <Link
          href="/nutrisi"
          className={`flex flex-col items-center gap-1 text-[11px] font-medium ${
            pathname === '/nutrisi' ? 'text-[#F59E0B]' : 'text-neutral-400'
          }`}
        >
          <Utensils className="w-4 h-4" />
          <span>Nutrisi</span>
        </Link>
      </nav>

      {/* MOBILE SLIDE-OVER DRAWER */}
      {mobileDrawerOpen && (
        <div className="md:hidden fixed inset-0 z-50 flex">
          <div
            className="fixed inset-0 bg-black/70"
            onClick={() => setMobileDrawerOpen(false)}
          />
          <div className="relative w-72 max-w-[82vw] bg-[#0E0E0E] text-white h-full p-5 flex flex-col justify-between z-10 border-r border-[#262626]">
            <div>
              <div className="flex items-center justify-between mb-6">
                <span className="text-lg font-bold text-white">FitForge</span>
                <button
                  type="button"
                  onClick={() => setMobileDrawerOpen(false)}
                  className="p-1.5 rounded-lg text-neutral-400 hover:text-white"
                  aria-label="Tutup menu"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="space-y-1">
                {NAV_ITEMS.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileDrawerOpen(false)}
                      className={`flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium ${
                        isActive
                          ? 'bg-[#262626] text-white'
                          : 'text-neutral-400 hover:text-white'
                      }`}
                    >
                      <Icon className={`w-4 h-4 ${isActive ? 'text-[#F97316]' : ''}`} />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>
            <div className="space-y-2.5">
              <PWAInstallButton fullWidthMobile />
              <div className="p-4 rounded-2xl bg-[#161616] border border-[#262626]">
                <p className="text-xs text-neutral-300 font-semibold mb-2">
                  Daily Golden Rules · {streakDays} Hari
                </p>
                <button
                  type="button"
                  onClick={() => {
                    handleQuickCheckIn();
                    setMobileDrawerOpen(false);
                  }}
                  className="w-full py-2 rounded-xl bg-[#F59E0B] text-black text-xs font-bold"
                >
                  Check-in Hari Ini →
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <OfflineIndicator />

      {/* ⌘K GLOBAL COMMAND PALETTE MODAL */}
      {cmdOpen && (
        <div
          className="fixed inset-0 z-50 flex items-start justify-center bg-black/75 pt-16 px-4"
          role="dialog"
          aria-modal="true"
          aria-label="Pencarian Cepat FitForge"
        >
          <div className="w-full max-w-lg rounded-2xl bg-[#161616] border border-[#262626] text-white shadow-2xl overflow-hidden">
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
                className="p-1 text-neutral-400 hover:text-white"
                aria-label="Tutup pencarian"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="p-3 max-h-80 overflow-y-auto space-y-4">
              <div>
                <p className="px-2 text-[11px] font-semibold text-neutral-400 mb-1.5">
                  Latihan Studio 3D
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
                      className="w-full flex items-center justify-between px-3 py-2 rounded-xl hover:bg-[#262626] text-left transition"
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
                        className="flex items-center gap-2 px-3 py-2 rounded-xl bg-[#0E0E0E] hover:bg-[#262626] border border-[#262626] text-xs font-medium text-neutral-200 transition"
                      >
                        <Icon className="w-3.5 h-3.5 text-[#F97316]" />
                        <span>{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
