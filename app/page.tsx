'use client';

import React, { useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion } from 'motion/react';
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
import { PWAInstallButton } from '@/components/pwa/PWAInstallButton';

const HeroRunner3D = dynamic(
  () => import('@/components/landing/HeroRunner3D').then((m) => m.HeroRunner3D),
  {
    ssr: false,
    loading: () => (
      <BiomechanicalLoader
        compact
        label="MEMUAT SILUET PELARI 3D"
        sublabel="Menyiapkan Pencahayaan Emissive PBR & Paralaks..."
      />
    ),
  }
);

export default function LandingPage() {
  const router = useRouter();
  const { isAuthenticated, profile, setGuideOpen, hasCompletedOnboarding } =
    useFitForgeStore();

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
    <div className="min-h-screen bg-[#0A0A0A] text-white relative overflow-hidden">
      {/* Volumetric Red & Orange Ambient Glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 w-[860px] h-[520px] rounded-full opacity-25 blur-[130px]"
        style={{
          background: 'radial-gradient(circle, #FF2D1A 0%, #F97316 45%, transparent 75%)',
        }}
      />

      {/* 3-Zone Top Navigation Bar (Strict Contract) */}
      <header className="relative z-20 max-w-7xl mx-auto px-6 py-5 flex items-center justify-between gap-6 border-b border-[#1E1E1E]">
        <Link
          href="/"
          className="text-xl font-extrabold tracking-tight text-white whitespace-nowrap shrink-0"
        >
          FitForge
        </Link>

        <nav
          className="hidden md:flex items-center gap-6 text-sm font-medium text-neutral-300"
          aria-label="Navigasi Utama"
        >
          <Link
            href="/dashboard"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Dashboard
          </Link>
          <Link
            href="/plan"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Rencana Mingguan
          </Link>
          <Link
            href="/workout"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Studio 3D
          </Link>
          <Link
            href="/run"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Lari GPS
          </Link>
          <Link
            href="/nutrisi"
            className="hover:text-white transition-colors whitespace-nowrap shrink-0"
          >
            Nutrisi AI
          </Link>
        </nav>

        <div className="flex items-center gap-2 shrink-0">
          <PWAInstallButton />

          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            className="inline-flex items-center gap-1.5 px-2.5 sm:px-3 py-2 rounded-xl bg-[#161616] hover:bg-[#262626] border border-[#2E2E2E] text-xs font-semibold text-[#F59E0B] transition whitespace-nowrap shrink-0 cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span className="hidden sm:inline">Panduan</span>
          </button>

          {isAuthenticated ? (
            <Link
              href="/dashboard"
              className="px-3.5 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-[#EF4444] via-[#F97316] to-[#F59E0B] text-black text-xs sm:text-sm font-bold hover:opacity-95 transition whitespace-nowrap shrink-0"
            >
              Dashboard ({profile.displayName.split(' ')[0]})
            </Link>
          ) : (
            <button
              type="button"
              onClick={handleQuickGoogleLogin}
              className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 rounded-xl bg-gradient-to-r from-[#EF4444] via-[#F97316] to-[#F59E0B] text-black text-xs sm:text-sm font-bold hover:opacity-95 transition whitespace-nowrap shrink-0 cursor-pointer"
            >
              <LogIn className="w-3.5 h-3.5 stroke-[2.5]" />
              <span>Masuk</span>
              <span className="hidden sm:inline">Google</span>
            </button>
          )}
        </div>
      </header>

      {/* HERO SECTION (Matches ref-2 AgentAI dark + volumetric red glow + 3D Runner) */}
      <section className="relative z-10 max-w-7xl mx-auto px-5 sm:px-6 pt-10 pb-14 lg:pt-16 lg:pb-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-10 items-center">
          {/* Left Column: Editorial Headline + CTAs + 3 Frosted Glass Stat Cards */}
          <motion.div
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-7 space-y-6"
          >
            <div className="text-xs font-semibold tracking-wider text-[#F97316]">
              SISTEM KEBUGARAN BIOMEKANIK 3D & DATABASE CLOUD REAL-TIME
            </div>

            <h1
              className="text-4xl sm:text-6xl font-extrabold tracking-tight leading-[1.06] text-white"
              style={{ textWrap: 'balance' }}
            >
              Tubuhmu. Datamu.{' '}
              <span className="bg-gradient-to-r from-[#EF4444] via-[#F97316] to-[#F59E0B] bg-clip-text text-transparent">
                Targetmu.
              </span>
            </h1>

            <p className="text-base sm:text-lg text-neutral-300 max-w-xl leading-relaxed">
              Masuk dengan akun Google Anda—semua progres dimulai bersih dari nol (`0`) tanpa data dummy. Visualisasikan aktivasi otot di Studio 3D, lacak lari GPS dengan filter Kalman & Haversine, analisis makro masakan Indonesia dengan Gemini AI, serta simpan semua catatan di akun cloud Anda.
            </p>

            {/* Primary CTA Buttons */}
            <div className="flex flex-wrap items-center gap-3.5 pt-2">
              {isAuthenticated ? (
                <Link
                  href="/dashboard"
                  className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#EF4444] via-[#F97316] to-[#F59E0B] text-black font-bold text-sm shadow-lg hover:opacity-95 transition whitespace-nowrap"
                >
                  <span>Buka Dashboard Anda</span>
                  <ArrowRight className="w-4 h-4" />
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={handleQuickGoogleLogin}
                  className="inline-flex items-center gap-2.5 px-6 py-3.5 rounded-2xl bg-gradient-to-r from-[#EF4444] via-[#F97316] to-[#F59E0B] text-black font-bold text-sm shadow-lg hover:opacity-95 transition whitespace-nowrap cursor-pointer"
                >
                  <LogIn className="w-4 h-4 stroke-[2.5]" />
                  <span>Masuk dengan Google & Mulai</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              )}

              <button
                type="button"
                onClick={() => setGuideOpen(true)}
                className="inline-flex items-center gap-2.5 px-5 py-3.5 rounded-2xl bg-[#161616] hover:bg-[#1E1E1E] border border-[#333333] text-white font-semibold text-sm transition whitespace-nowrap cursor-pointer"
              >
                <BookOpen className="w-4 h-4 text-[#F59E0B]" />
                <span>Baca Panduan Penggunaan</span>
              </button>

              <Link
                href="/workout"
                className="inline-flex items-center gap-1.5 text-xs font-semibold text-neutral-300 hover:text-white underline underline-offset-4 px-2 py-2 whitespace-nowrap"
              >
                <Play className="w-3.5 h-3.5 text-[#EF4444] fill-[#EF4444]" />
                <span>Coba Studio 3D →</span>
              </Link>
            </div>

            {/* 3 Glass Stat Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 pt-4">
              <div className="rounded-2xl bg-[#161616]/90 border border-[#262626] p-4">
                <p className="text-xs text-neutral-400 font-medium">Database Cloud</p>
                <p className="text-2xl font-extrabold text-white mt-1 tabular-nums">
                  Mulai dari 0
                </p>
                <p className="text-[11px] text-neutral-400 mt-1">
                  Tanpa data dummy · Sinkron Google
                </p>
              </div>

              <div className="rounded-2xl bg-[#161616]/90 border border-[#262626] p-4">
                <p className="text-xs text-neutral-400 font-medium">Anatomi Studio 3D</p>
                <p className="text-2xl font-extrabold text-[#F97316] mt-1 tabular-nums">
                  11 Grup Otot
                </p>
                <p className="text-[11px] text-neutral-400 mt-1">
                  Shader PBR + Peta SVG 2D
                </p>
              </div>

              <motion.div
                whileHover={{ y: -3 }}
                className="rounded-2xl bg-[#161616]/90 border border-[#262626] p-4"
              >
                <p className="text-xs text-neutral-400 font-medium">Rencana Latihan</p>
                <p className="text-2xl font-extrabold text-[#F59E0B] mt-1 tabular-nums">
                  7 Hari Penuh
                </p>
                <p className="text-[11px] text-neutral-400 mt-1">
                  Mode Gym & Mode Rumah
                </p>
              </motion.div>
            </div>
          </motion.div>

          {/* Right Column: Interactive 3D Glowing Runner / Torso Silhouette */}
          <motion.div
            initial={{ opacity: 0, scale: 0.96 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ duration: 0.45, delay: 0.1, ease: [0.22, 1, 0.36, 1] }}
            className="lg:col-span-5"
          >
            <div className="relative rounded-3xl bg-gradient-to-b from-[#161616] to-[#0E0E0E] border border-[#262626] p-3 shadow-2xl">
              <HeroRunner3D />
              <div className="flex items-center justify-between px-3 py-2 border-t border-[#262626] text-xs text-neutral-400">
                <span>Siluet Pelari 3D · Emissive PBR</span>
                <span className="text-[#F59E0B] font-medium">Gerakkan kursor untuk paralaks</span>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* PANDUAN PENGGUNAAN SETIAP KALI BUKA WEBSITE & LOGIN */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-14 border-t border-[#1E1E1E]">
        <div className="rounded-3xl bg-[#141414] border border-[#262626] p-6 sm:p-8">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-[#262626]">
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#F59E0B] block">
                Panduan Lengkap Pengguna Baru & Pengujian Database
              </span>
              <h2 className="text-xl sm:text-2xl font-extrabold text-white mt-1">
                Cara Menggunakan FitForge dari Nol (0) dengan Akun Google Anda
              </h2>
            </div>

            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-[#262626] hover:bg-[#333333] text-xs font-bold text-white transition self-start md:self-auto cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-[#F59E0B]" />
              <span>Buka Modal Panduan Interaktif</span>
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-6">
            <div className="rounded-2xl bg-[#0E0E0E] border border-[#262626] p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="px-2.5 py-0.5 rounded-md bg-[#F97316]/20 text-[#F97316] text-xs font-extrabold">
                  Langkah 1
                </span>
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
              </div>
              <h3 className="text-sm font-bold text-white">Login dengan Google</h3>
              <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
                Klik tombol <strong>Masuk Google</strong>. Akun database Firestore pribadi Anda akan dibuat otomatis dengan seluruh metrik dimulai dari <code>0</code> (tanpa data dummy).
              </p>
            </div>

            <div className="rounded-2xl bg-[#0E0E0E] border border-[#262626] p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="px-2.5 py-0.5 rounded-md bg-[#F97316]/20 text-[#F97316] text-xs font-extrabold">
                  Langkah 2
                </span>
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
              </div>
              <h3 className="text-sm font-bold text-white">Isi Profil & Onboarding</h3>
              <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
                Masukkan berat badan, tinggi badan, target kebugaran, serta kota domisili Anda untuk menghitung target kalori, protein, air, dan jadwal sholat Kemenag RI.
              </p>
            </div>

            <div className="rounded-2xl bg-[#0E0E0E] border border-[#262626] p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="px-2.5 py-0.5 rounded-md bg-[#F97316]/20 text-[#F97316] text-xs font-extrabold">
                  Langkah 3
                </span>
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
              </div>
              <h3 className="text-sm font-bold text-white">Rekam Latihan 3D & Lari GPS</h3>
              <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
                Buka <strong>Studio 3D</strong> lalu klik <em>Simpan Sesi Latihan</em>, atau buka <strong>Run Tracker</strong> (GPS Asli / Simulasi Rute) lalu klik <em>Selesai & Simpan</em>.
              </p>
            </div>

            <div className="rounded-2xl bg-[#0E0E0E] border border-[#262626] p-4">
              <div className="flex items-center justify-between mb-2">
                <span className="px-2.5 py-0.5 rounded-md bg-[#F97316]/20 text-[#F97316] text-xs font-extrabold">
                  Langkah 4
                </span>
                <CheckCircle2 className="w-4 h-4 text-[#10B981]" />
              </div>
              <h3 className="text-sm font-bold text-white">Catat Nutrisi AI & Air +250ml</h3>
              <p className="text-xs text-neutral-400 mt-1.5 leading-relaxed">
                Analisis foto makanan di <strong>Nutrisi AI</strong>, tambahkan hidrasi <strong>+250ml</strong>, dan ceklis 5 Golden Rules. Semua tersimpan permanen di akun Google Anda.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* FEATURE GRID SECTION */}
      <section className="relative z-10 max-w-7xl mx-auto px-6 py-14 border-t border-[#1E1E1E]">
        <div className="flex flex-col md:flex-row md:items-end justify-between mb-10 gap-4">
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-white tracking-tight">
              Ekosistem Performa Lengkap dalam Satu Aplikasi
            </h2>
            <p className="text-sm text-neutral-400 mt-1">
              Dirancang khusus untuk atlet dan pegiat kebugaran di Indonesia tanpa kompromi.
            </p>
          </div>
          <Link
            href="/plan"
            className="inline-flex items-center gap-2 text-sm font-semibold text-[#F97316] hover:text-[#F59E0B]"
          >
            <span>Lihat Poster Rencana 7 Hari</span>
            <ArrowRight className="w-4 h-4" />
          </Link>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">
          <Link
            href="/run"
            className="group rounded-2xl bg-[#161616] hover:bg-[#1E1E1E] border border-[#262626] p-5 transition flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#F97316]/15 border border-[#F97316]/30 flex items-center justify-center mb-4">
                <MapPin className="w-5 h-5 text-[#F97316]" />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-[#F97316] transition">
                GPS Run Tracker
              </h3>
              <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
                Pelacakan presisi tinggi dengan filter Kalman 1D, perhitungan jarak Haversine, checkpoint IndexedDB tiap detik, Voice Coach Bahasa Indonesia, dan ekspor kartu bagikan PNG.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#F59E0B] mt-5">
              Mulai Lari <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>

          <Link
            href="/workout"
            className="group rounded-2xl bg-[#161616] hover:bg-[#1E1E1E] border border-[#262626] p-5 transition flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#EF4444]/15 border border-[#EF4444]/30 flex items-center justify-center mb-4">
                <Box className="w-5 h-5 text-[#EF4444]" />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-[#EF4444] transition">
                Studio Latihan 3D
              </h3>
              <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
                Peragaan gerakan 3D dengan sorotan otot primer & sekunder yang menyala real-time, kontrol kecepatan 0.5×–1.5×, sudut kamera Depan/Samping/Belakang, serta panduan form.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#F59E0B] mt-5">
              Buka Studio 3D <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>

          <Link
            href="/nutrisi"
            className="group rounded-2xl bg-[#161616] hover:bg-[#1E1E1E] border border-[#262626] p-5 transition flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-[#F59E0B]/15 border border-[#F59E0B]/30 flex items-center justify-center mb-4">
                <Utensils className="w-5 h-5 text-[#F59E0B]" />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-[#F59E0B] transition">
                Nutrisi AI Nusantara
              </h3>
              <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
                Unggah foto makananmu—Gemini AI mengenali hidangan Indonesia (rendang, soto, tempe, sate, gado-gado), menghitung makro & serat, serta menyesuaikan budget kalori larimu.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#F59E0B] mt-5">
              Analisis Makanan <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>

          <Link
            href="/jadwal"
            className="group rounded-2xl bg-[#161616] hover:bg-[#1E1E1E] border border-[#262626] p-5 transition flex flex-col justify-between"
          >
            <div>
              <div className="w-10 h-10 rounded-xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center mb-4">
                <BellRing className="w-5 h-5 text-emerald-400" />
              </div>
              <h3 className="text-base font-bold text-white group-hover:text-emerald-400 transition">
                Sholat, Alarm & Hidrasi
              </h3>
              <p className="text-xs text-neutral-400 mt-2 leading-relaxed">
                Jadwal waktu sholat Kemenag RI otomatis sesuai kota, Mode A Alarm Bangun dengan synth Web Audio bertahap, serta Mode B notifikasi senyap pengingat air +250ml.
              </p>
            </div>
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-[#F59E0B] mt-5">
              Atur Jadwal <ArrowRight className="w-3.5 h-3.5" />
            </span>
          </Link>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="relative z-10 border-t border-[#1E1E1E] bg-[#0A0A0A] py-8 pb-24 md:pb-8 px-6">
        <div className="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4 text-xs text-neutral-400">
          <div className="flex items-center gap-2">
            <Activity className="w-4 h-4 text-[#F97316]" />
            <span className="font-semibold text-white">FitForge</span>
            <span>·</span>
            <span>Stay Consistent, Stay Disciplined, See The Results.</span>
          </div>
          <div className="flex items-center gap-5">
            <Link href="/login" className="hover:text-white transition">
              Masuk Google
            </Link>
            <Link href="/onboarding" className="hover:text-white transition">
              Onboarding
            </Link>
            <Link href="/plan" className="hover:text-white transition">
              Poster Plan
            </Link>
            <Link href="/about/credits" className="hover:text-white transition">
              Kredit & Lisensi Aset
            </Link>
          </div>
        </div>
      </footer>

      {/* FLOATING MOBILE BOTTOM DOCK ON LANDING PAGE (< 768px) */}
      <div className="md:hidden fixed bottom-2.5 inset-x-3 z-40 pointer-events-none">
        <nav
          className="pointer-events-auto h-16 rounded-2xl bg-[#0D0D0F]/95 backdrop-blur-xl border border-[#28282D] px-2 flex items-center justify-around shadow-[0_14px_36px_rgba(0,0,0,0.75)] select-none"
          aria-label="Navigasi Cepat Mobile"
        >
          <Link
            href="/dashboard"
            className="flex flex-col items-center gap-0.5 text-[10px] font-bold text-neutral-300 hover:text-white"
          >
            <LayoutDashboard className="w-4 h-4 text-[#F59E0B]" />
            <span>Dashboard</span>
          </Link>
          <Link
            href="/workout"
            className="flex flex-col items-center gap-0.5 text-[10px] font-bold text-neutral-300 hover:text-white"
          >
            <Box className="w-4 h-4 text-[#EF4444]" />
            <span>3D Studio</span>
          </Link>
          <Link
            href="/run"
            className="relative -mt-6 flex flex-col items-center"
            aria-label="Mulai Lari GPS"
          >
            <motion.div
              whileTap={{ scale: 0.9 }}
              className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-[#F97316] to-[#F59E0B] text-black border-2 border-[#0D0D0F] shadow-[0_6px_20px_rgba(249,115,22,0.5)] flex items-center justify-center"
            >
              <MapPin className="w-5 h-5 stroke-[2.5]" />
            </motion.div>
            <span className="text-[10px] font-extrabold text-[#F59E0B] mt-0.5">
              Lari GPS
            </span>
          </Link>
          <Link
            href="/nutrisi"
            className="flex flex-col items-center gap-0.5 text-[10px] font-bold text-neutral-300 hover:text-white"
          >
            <Utensils className="w-4 h-4 text-[#F97316]" />
            <span>Nutrisi</span>
          </Link>
          <Link
            href="/plan"
            className="flex flex-col items-center gap-0.5 text-[10px] font-bold text-neutral-300 hover:text-white"
          >
            <CalendarRange className="w-4 h-4 text-emerald-400" />
            <span>Plan 7H</span>
          </Link>
        </nav>
      </div>
    </div>
  );
}
