'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signOut } from 'firebase/auth';
import {
  Save,
  RotateCcw,
  Sun,
  Moon,
  Award,
  CheckCircle2,
  AlertTriangle,
  Loader2,
  LogIn,
  LogOut,
  BookOpen,
  ShieldCheck,
} from 'lucide-react';
import { auth, signInWithGoogleSafe } from '@/lib/firebase';
import { AppShell } from '@/components/layout/AppShell';
import { useFitForgeStore } from '@/store/useFitForgeStore';

export default function PengaturanPage() {
  const router = useRouter();
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
  const [authError, setAuthError] = useState('');
  const [authLoading, setAuthLoading] = useState(false);

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
    setAuthError('');
    setAuthLoading(true);
    try {
      const res = await signInWithGoogleSafe();
      if (res.ok) {
        setGuideOpen(true);
        setSavedBanner('Berhasil masuk ke akun Google Cloud!');
        setTimeout(() => setSavedBanner(''), 3000);
        return;
      }
      setAuthError(res.message || 'Gagal membuka popup Google Auth.');
      const params = new URLSearchParams();
      if (res.code) params.set('authError', res.code);
      if (res.isEmbeddedIframe) params.set('iframe', '1');
      router.push(`/login?${params.toString()}`);
    } finally {
      setAuthLoading(false);
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
        <div className="mb-5 p-3.5 rounded-xl bg-[#ECFCD8] dark:bg-[#19280B] border border-[#84E818]/40 text-[#2E6200] dark:text-[#84E818] text-xs sm:text-sm font-bold flex items-center gap-2">
          <CheckCircle2 className="w-4 h-4 shrink-0" />
          <span>{savedBanner}</span>
        </div>
      )}

      {authError && (
        <div className="mb-5 p-3.5 rounded-xl bg-[#FFF1F2] dark:bg-[#2A1216] border border-[#FECDD3] dark:border-[#6B1D29] text-[#BE123C] dark:text-[#FDA4AF] text-xs font-semibold flex items-center gap-2">
          <AlertTriangle className="w-4 h-4 shrink-0" />
          <span>{authError}</span>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <form
          onSubmit={handleSave}
          className="lg:col-span-8 rounded-xl bg-white dark:bg-[#131618] p-5 sm:p-6 border border-[#E3E6E0] dark:border-[#23282D] shadow-card space-y-4"
        >
          <h2 className="text-base font-bold text-[#0D0F10] dark:text-white">
            Data Biometrik &amp; Target Harian
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
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#F7F8F6] dark:bg-[#0B0D0E] border border-[#E3E6E0] dark:border-[#23282D] text-sm focus:outline-none focus:border-[#84E818]"
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
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#F7F8F6] dark:bg-[#0B0D0E] border border-[#E3E6E0] dark:border-[#23282D] text-sm focus:outline-none focus:border-[#84E818]"
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
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#F7F8F6] dark:bg-[#0B0D0E] border border-[#E3E6E0] dark:border-[#23282D] text-sm tabular-nums focus:outline-none focus:border-[#84E818]"
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
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#F7F8F6] dark:bg-[#0B0D0E] border border-[#E3E6E0] dark:border-[#23282D] text-sm tabular-nums focus:outline-none focus:border-[#84E818]"
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
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#F7F8F6] dark:bg-[#0B0D0E] border border-[#E3E6E0] dark:border-[#23282D] text-sm tabular-nums focus:outline-none focus:border-[#84E818]"
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
                className="w-full px-3.5 py-2.5 rounded-lg bg-[#F7F8F6] dark:bg-[#0B0D0E] border border-[#E3E6E0] dark:border-[#23282D] text-sm tabular-nums focus:outline-none focus:border-[#84E818]"
              />
            </div>
          </div>

          <button
            type="submit"
            className="min-h-[44px] px-5 py-2.5 rounded-full bg-[#0D0F10] hover:bg-[#1E2225] dark:bg-[#F7F8F6] dark:hover:bg-white text-white dark:text-[#0D0F10] font-extrabold text-xs sm:text-sm inline-flex items-center gap-2 transition cursor-pointer"
          >
            <Save className="w-4 h-4 text-[#84E818] dark:text-[#448500]" />
            <span>Simpan Perubahan ke Cloud</span>
          </button>
        </form>

        <div className="lg:col-span-4 space-y-5">
          {/* Polarity-inverted Google Account & Firestore Status Card */}
          <div className="rounded-xl bg-[#0D0F10] dark:bg-[#F7F8F6] text-white dark:text-[#0D0F10] p-5 border border-[#23282D] dark:border-[#DDE1DA] shadow-card space-y-3">
            <div className="flex items-center gap-2 text-xs font-bold text-[#84E818] dark:text-[#448500]">
              <ShieldCheck className="w-4 h-4" />
              <span>Status Akun Google &amp; Database</span>
            </div>

            {isAuthenticated ? (
              <div className="space-y-2 text-xs">
                <p className="font-bold">{profile.displayName}</p>
                <p className="text-neutral-400 dark:text-[#5A6068]">{profile.email}</p>
                <p className="text-[11px] text-[#84E818] dark:text-[#3D7A00] font-semibold">
                  {firebaseUid
                    ? `✓ Terhubung ke Cloud Firestore (UID: ${firebaseUid.slice(0, 10)}...)`
                    : isLocalVercelAuth
                      ? `✓ Aktif di Mode Perangkat (${profile.id})`
                      : '✓ Akun Aktif'}
                </p>
                <button
                  type="button"
                  onClick={handleGoogleLogout}
                  className="w-full mt-2 py-2.5 rounded-lg bg-[#1A1D20] dark:bg-[#E7EAE4] hover:opacity-90 text-white dark:text-[#0D0F10] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <LogOut className="w-4 h-4 text-[#EF4444]" />
                  <span>Keluar dari Akun</span>
                </button>
              </div>
            ) : (
              <div className="space-y-3 text-xs text-neutral-300 dark:text-[#4A5056]">
                <p>
                  Belum masuk ke akun Google. Masuk sekarang agar data tersimpan permanen di akun Anda.
                </p>
                <button
                  type="button"
                  disabled={authLoading}
                  onClick={handleGoogleLogin}
                  className="w-full py-2.5 rounded-full bg-[#84E818] hover:bg-[#76D610] disabled:opacity-60 text-[#0D0F10] text-xs font-extrabold flex items-center justify-center gap-2 cursor-pointer"
                >
                  {authLoading ? (
                    <Loader2 className="w-4 h-4 animate-spin" />
                  ) : (
                    <LogIn className="w-4 h-4" />
                  )}
                  <span>{authLoading ? 'Menghubungkan...' : 'Masuk dengan Google'}</span>
                </button>
              </div>
            )}
          </div>

          {/* Theme Switch Card */}
          <div className="rounded-xl bg-white dark:bg-[#131618] p-5 border border-[#E3E6E0] dark:border-[#23282D] shadow-card">
            <h3 className="text-sm font-bold mb-2">Tema Tampilan Kanvas</h3>
            <p className="text-xs text-[#646A6E] dark:text-neutral-400 mb-4">
              Beralih antara Gallery-White (#F7F8F6) dan Obsidian Dark (#0B0D0E) dengan inversi polaritas penuh.
            </p>
            <button
              type="button"
              onClick={toggleDarkMode}
              className="w-full min-h-[44px] py-2.5 rounded-lg bg-[#0D0F10] dark:bg-[#F7F8F6] text-white dark:text-[#0D0F10] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              {darkMode ? (
                <>
                  <Sun className="w-4 h-4 text-[#448500]" />
                  <span>Gunakan Mode Terang (Gallery-White)</span>
                </>
              ) : (
                <>
                  <Moon className="w-4 h-4 text-[#84E818]" />
                  <span>Gunakan Mode Gelap (Obsidian)</span>
                </>
              )}
            </button>
          </div>

          {/* Zero Reset, Guide & Attribution */}
          <div className="rounded-xl bg-white dark:bg-[#131618] p-5 border border-[#E3E6E0] dark:border-[#23282D] shadow-card space-y-2.5">
            <h3 className="text-sm font-bold">Panduan &amp; Reset Data</h3>
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="w-full min-h-[44px] py-2.5 rounded-lg bg-[#0D0F10] dark:bg-[#F7F8F6] text-white dark:text-[#0D0F10] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              <BookOpen className="w-4 h-4 text-[#84E818] dark:text-[#448500]" />
              <span>Buka Panduan Penggunaan (5 Langkah)</span>
            </button>

            <button
              type="button"
              onClick={() => {
                resetDemoData();
                setSavedBanner('Seluruh metrik harian telah direset kembali ke 0.');
                setTimeout(() => setSavedBanner(''), 3000);
              }}
              className="w-full min-h-[44px] py-2.5 rounded-lg bg-[#F7F8F6] dark:bg-[#0B0D0E] hover:bg-[#EEF0EC] dark:hover:bg-[#1E2225] border border-[#E3E6E0] dark:border-[#23282D] text-xs font-bold flex items-center justify-center gap-2 cursor-pointer"
            >
              <RotateCcw className="w-4 h-4 text-[#3D7A00] dark:text-[#84E818]" />
              <span>Reset Semua Metrik ke Nol (0)</span>
            </button>

            <Link
              href="/about/credits"
              className="w-full min-h-[44px] py-2.5 rounded-lg bg-[#F7F8F6] dark:bg-[#1B1F23] hover:bg-[#EAECE8] dark:hover:bg-[#23282D] border border-[#E3E6E0] dark:border-[#2C3238] text-[#0D0F10] dark:text-white text-xs font-bold flex items-center justify-center gap-2"
            >
              <Award className="w-4 h-4 text-[#448500] dark:text-[#84E818]" />
              <span>Lihat Halaman Kredit &amp; Lisensi 3D</span>
            </Link>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
