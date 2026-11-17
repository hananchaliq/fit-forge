'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { signInWithPopup, signOut } from 'firebase/auth';
import {
  Save,
  RotateCcw,
  Sun,
  Moon,
  Award,
  CheckCircle2,
  LogIn,
  LogOut,
  BookOpen,
  ShieldCheck,
} from 'lucide-react';
import { auth, googleProvider } from '@/lib/firebase';
import { AppShell } from '@/components/layout/AppShell';
import { useFitForgeStore } from '@/store/useFitForgeStore';

export default function PengaturanPage() {
  const {
    profile,
    isAuthenticated,
    isLocalVercelAuth,
    firebaseUid,
    setGuideOpen,
    updateProfile,
    darkMode,
    toggleDarkMode,
    resetDemoData,
  } = useFitForgeStore();

  const [displayName, setDisplayName] = useState(profile.displayName);
  const [weightKg, setWeightKg] = useState(String(profile.weightKg));
  const [heightCm, setHeightCm] = useState(String(profile.heightCm));
  const [city, setCity] = useState(profile.city);
  const [calorieTarget, setCalorieTarget] = useState(String(profile.dailyCalorieTarget));
  const [proteinTarget, setProteinTarget] = useState(String(profile.dailyProteinTargetG));
  const [savedBanner, setSavedBanner] = useState('');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    updateProfile({
      displayName: displayName.trim() || profile.displayName,
      weightKg: Number(weightKg) || profile.weightKg,
      heightCm: Number(heightCm) || profile.heightCm,
      city: city.trim() || profile.city,
      dailyCalorieTarget: Number(calorieTarget) || profile.dailyCalorieTarget,
      dailyProteinTargetG: Number(proteinTarget) || profile.dailyProteinTargetG,
    });
    setSavedBanner('Pengaturan profil berhasil disimpan dan disinkronkan ke Cloud!');
    setTimeout(() => setSavedBanner(''), 3000);
  };

  const handleGoogleLogin = async () => {
    try {
      await signInWithPopup(auth, googleProvider);
      setGuideOpen(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('auth/unauthorized-domain')) {
        window.location.href = '/login?error=unauthorized-domain';
      } else {
        window.location.href = '/login';
      }
    }
  };

  const handleGoogleLogout = async () => {
    try {
      await signOut(auth);
    } catch {
      // ignore if local fallback session
    }
    useFitForgeStore.getState().logoutAccount();
    setSavedBanner('Anda telah keluar dari akun.');
    setTimeout(() => setSavedBanner(''), 3000);
  };

  return (
    <AppShell
      title="Pengaturan Profil & Akun Cloud"
      subtitle="Kelola koneksi Google Authentication, database Cloud Firestore, parameter biometrik, dan panduan aplikasi"
      ctaLabel="Buka Panduan Aplikasi"
      onCtaClick={() => setGuideOpen(true)}
    >
      {savedBanner && (
        <div className="mb-5 p-3.5 rounded-2xl bg-[#D1FAE5] text-[#047857] text-xs sm:text-sm font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4" />
          <span>{savedBanner}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <form
          onSubmit={handleSave}
          className="lg:col-span-8 rounded-2xl bg-white dark:bg-[#161616] p-6 border border-[#EFEFEF] dark:border-[#262626] shadow-card space-y-4"
        >
          <h2 className="text-base font-bold text-[#111111] dark:text-white">
            Data Biometrik & Target Harian
          </h2>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="set-name" className="block text-xs font-semibold mb-1.5">
                Nama Tampilan
              </label>
              <input
                id="set-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F9FA] dark:bg-[#0E0E0E] border border-[#EFEFEF] dark:border-[#262626] text-sm"
              />
            </div>

            <div>
              <label htmlFor="set-city" className="block text-xs font-semibold mb-1.5">
                Kota Jadwal Sholat
              </label>
              <input
                id="set-city"
                type="text"
                value={city}
                onChange={(e) => setCity(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F9FA] dark:bg-[#0E0E0E] border border-[#EFEFEF] dark:border-[#262626] text-sm"
              />
            </div>

            <div>
              <label htmlFor="set-weight" className="block text-xs font-semibold mb-1.5">
                Berat Badan (kg)
              </label>
              <input
                id="set-weight"
                type="number"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F9FA] dark:bg-[#0E0E0E] border border-[#EFEFEF] dark:border-[#262626] text-sm tabular-nums"
              />
            </div>

            <div>
              <label htmlFor="set-height" className="block text-xs font-semibold mb-1.5">
                Tinggi Badan (cm)
              </label>
              <input
                id="set-height"
                type="number"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F9FA] dark:bg-[#0E0E0E] border border-[#EFEFEF] dark:border-[#262626] text-sm tabular-nums"
              />
            </div>

            <div>
              <label htmlFor="set-kcal" className="block text-xs font-semibold mb-1.5">
                Target Kalori Dasar (kkal/hari)
              </label>
              <input
                id="set-kcal"
                type="number"
                value={calorieTarget}
                onChange={(e) => setCalorieTarget(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F9FA] dark:bg-[#0E0E0E] border border-[#EFEFEF] dark:border-[#262626] text-sm tabular-nums"
              />
            </div>

            <div>
              <label htmlFor="set-prot" className="block text-xs font-semibold mb-1.5">
                Target Protein Harian (gram)
              </label>
              <input
                id="set-prot"
                type="number"
                value={proteinTarget}
                onChange={(e) => setProteinTarget(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#F8F9FA] dark:bg-[#0E0E0E] border border-[#EFEFEF] dark:border-[#262626] text-sm tabular-nums"
              />
            </div>
          </div>

          <button
            type="submit"
            className="px-5 py-3 rounded-xl bg-gradient-to-r from-[#F97316] to-[#F59E0B] text-black font-extrabold text-xs sm:text-sm inline-flex items-center gap-2 hover:opacity-95 transition cursor-pointer"
          >
            <Save className="w-4 h-4" />
            <span>Simpan Perubahan ke Cloud</span>
          </button>
        </form>

        <div className="lg:col-span-4 space-y-5">
          {/* Google Account & Firestore Status Card */}
          <div className="rounded-2xl bg-[#161616] text-white p-5 border border-[#262626] shadow-card space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#F59E0B]">
              <ShieldCheck className="w-4 h-4" />
              <span>Status Akun Google & Database</span>
            </div>

            {isAuthenticated ? (
              <div className="space-y-2 text-xs">
                <p className="font-bold text-white">{profile.displayName}</p>
                <p className="text-neutral-400">{profile.email}</p>
                <p className="text-[11px] text-emerald-400 font-semibold">
                  {firebaseUid
                    ? `✓ Terhubung ke Cloud Firestore (UID: ${firebaseUid.slice(0, 10)}...)`
                    : isLocalVercelAuth
                      ? `✓ Aktif di Mode Domain Vercel (${profile.id})`
                      : '✓ Akun Aktif'}
                </p>
                <button
                  type="button"
                  onClick={handleGoogleLogout}
                  className="w-full mt-2 py-2.5 rounded-xl bg-[#262626] hover:bg-[#333333] text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-[#EF4444]" />
                  <span>Keluar dari Akun</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-neutral-300">
                <p>
                  Belum masuk ke akun Google. Masuk sekarang agar data tersimpan permanen di akun Anda.
                </p>
                <button
                  type="button"
                  onClick={handleGoogleLogin}
                  className="w-full py-2.5 rounded-xl bg-gradient-to-r from-[#EF4444] via-[#F97316] to-[#F59E0B] text-black text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogIn className="w-4 h-4" />
                  <span>Masuk dengan Google</span>
                </button>
              </div>
            )}
          </div>

          {/* Theme Switch Card */}
          <div className="rounded-2xl bg-white dark:bg-[#161616] p-5 border border-[#EFEFEF] dark:border-[#262626] shadow-card">
            <h3 className="text-sm font-bold mb-2">Tema Tampilan Kanvas</h3>
            <p className="text-xs text-[#6B7280] dark:text-neutral-400 mb-4">
              Beralih antara Alabaster Light (#F8F9FA) dan Obsidian Dark (#0E0E0E).
            </p>
            <button
              type="button"
              onClick={toggleDarkMode}
              className="w-full py-2.5 rounded-xl bg-[#161616] dark:bg-[#262626] text-white text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              {darkMode ? (
                <>
                  <Sun className="w-4 h-4 text-[#F59E0B]" />
                  <span>Gunakan Mode Terang (Alabaster)</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-[#F59E0B]" />
                  <span>Gunakan Mode Gelap (Obsidian)</span>
                </>
              )}
            </button>
          </div>

          {/* Zero Reset, Guide & Attribution */}
          <div className="rounded-2xl bg-white dark:bg-[#161616] p-5 border border-[#EFEFEF] dark:border-[#262626] shadow-card space-y-3">
            <h3 className="text-sm font-bold">Panduan & Reset Data</h3>
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="w-full py-2.5 rounded-xl bg-[#161616] text-[#F59E0B] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              <BookOpen className="w-4 h-4" />
              <span>Buka Panduan Penggunaan (5 Langkah)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                resetDemoData();
                setSavedBanner('Seluruh metrik harian telah direset kembali ke 0.');
                setTimeout(() => setSavedBanner(''), 3000);
              }}
              className="w-full py-2.5 rounded-xl bg-[#F8F9FA] dark:bg-[#0E0E0E] hover:bg-neutral-100 dark:hover:bg-[#262626] border border-[#EFEFEF] dark:border-[#262626] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-[#F97316]" />
              <span>Reset Semua Metrik ke Nol (0)</span>
            </button>

            <Link
              href="/about/credits"
              className="w-full py-2.5 rounded-xl bg-[#161616] text-white text-xs font-bold flex items-center justify-center gap-2"
            >
              <Award className="w-4 h-4 text-[#F59E0B]" />
              <span>Lihat Halaman Kredit & Lisensi 3D</span>
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
