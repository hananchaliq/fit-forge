'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { signInWithPopup, signOut } from 'firebase/auth';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  LogIn,
  LogOut,
  ShieldCheck,
} from 'lucide-react';
import { auth, googleProvider } from '@/lib/firebase';
import { useFitForgeStore } from '@/store/useFitForgeStore';

export default function LoginPage() {
  const router = useRouter();
  const { isAuthenticated, profile, setGuideOpen, hasCompletedOnboarding } =
    useFitForgeStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      await signInWithPopup(auth, googleProvider);
      setGuideOpen(true);
      if (!hasCompletedOnboarding) {
        router.push('/onboarding');
      } else {
        router.push('/dashboard');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      if (msg.includes('auth/popup-closed-by-user')) {
        setError('Jendela login Google ditutup sebelum selesai. Silakan klik tombol Masuk lagi.');
      } else {
        setError(`Gagal masuk dengan Google: ${msg}`);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = async () => {
    await signOut(auth);
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white flex flex-col justify-center items-center px-4 py-10 relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 w-[560px] h-[360px] rounded-full opacity-20 blur-[110px]"
        style={{
          background: 'radial-gradient(circle, #FF2D1A 0%, #F97316 50%, transparent 75%)',
        }}
      />

      <div className="relative z-10 w-full max-w-lg rounded-3xl bg-[#161616] border border-[#262626] p-7 sm:p-8 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <Link href="/" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-[#F97316] to-[#F59E0B] text-black font-black flex items-center justify-center text-lg">
              F
            </div>
            <div>
              <span className="text-lg font-bold tracking-tight block leading-none">FitForge</span>
              <span className="text-[11px] text-neutral-400">Cloud Database & Google Auth</span>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-[#262626] hover:bg-[#333333] text-xs font-semibold text-[#F59E0B] transition cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5" />
            <span>Buka Panduan</span>
          </button>
        </div>

        <h1 className="text-2xl font-extrabold text-white">
          Masuk dengan Akun Google
        </h1>
        <p className="text-xs sm:text-sm text-neutral-400 mt-1.5 mb-6 leading-relaxed">
          Hubungkan akun Google Anda untuk menyimpan seluruh progres latihan 3D, rute lari GPS, nutrisi AI, serta jadwal sholat & hidrasi di database Cloud Firestore milik akun Anda sendiri (tanpa data dummy, dimulai dari 0).
        </p>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-[#FFE4E6] text-[#BE123C] text-xs font-semibold">
            {error}
          </div>
        )}

        {isAuthenticated ? (
          <div className="rounded-2xl bg-[#0E0E0E] border border-[#262626] p-5 mb-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#10B981] block">
                  ✓ Terautentikasi dengan Google
                </span>
                <p className="text-base font-bold text-white mt-0.5">{profile.displayName}</p>
                <p className="text-xs text-neutral-400">{profile.email}</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-[#262626] hover:bg-[#333333] text-xs font-semibold text-neutral-200 cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Link
                href="/dashboard"
                className="py-3 px-4 rounded-xl bg-gradient-to-r from-[#EF4444] via-[#F97316] to-[#F59E0B] text-black font-extrabold text-xs text-center flex items-center justify-center gap-1.5"
              >
                <span>Buka Dashboard</span>
                <ArrowRight className="w-4 h-4" />
              </Link>
              <Link
                href="/onboarding"
                className="py-3 px-4 rounded-xl bg-[#1E1E1E] hover:bg-[#2A2A2A] border border-[#333333] text-white font-semibold text-xs text-center flex items-center justify-center"
              >
                Atur Profil & Target
              </Link>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={loading}
            onClick={handleGoogleLogin}
            className="w-full py-3.5 px-5 rounded-2xl bg-gradient-to-r from-[#EF4444] via-[#F97316] to-[#F59E0B] text-black font-extrabold text-sm hover:opacity-95 disabled:opacity-50 transition flex items-center justify-center gap-2.5 shadow-lg cursor-pointer mb-6"
          >
            <LogIn className="w-4 h-4 stroke-[2.5]" />
            <span>{loading ? 'Menghubungkan ke Google...' : 'Masuk dengan Google (Simpan ke Database)'}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        )}

        {/* Built-in Step-by-Step Guide Card on Login Screen */}
        <div className="rounded-2xl bg-[#0E0E0E] border border-[#262626] p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-[#F59E0B]">
            <ShieldCheck className="w-4 h-4" />
            <span>Panduan Cepat Setelah Login:</span>
          </div>
          <div className="flex items-start gap-2 text-xs text-neutral-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] shrink-0 mt-0.5" />
            <span>
              <strong>1. Semua Mulai dari 0:</strong> Tidak ada data dummy. Jarak lari (0 km), latihan (0 sesi), kalori (0 kkal), dan air (0 ml) siap diisi dari aktivitas asli Anda.
            </span>
          </div>
          <div className="flex items-start gap-2 text-xs text-neutral-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] shrink-0 mt-0.5" />
            <span>
              <strong>2. Atur Target di Onboarding:</strong> Isi berat badan, tinggi badan, dan kota domisili agar target nutrisi & jadwal sholat Kemenag RI terhitung otomatis.
            </span>
          </div>
          <div className="flex items-start gap-2 text-xs text-neutral-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#10B981] shrink-0 mt-0.5" />
            <span>
              <strong>3. Tersimpan di Cloud Akun Anda:</strong> Setiap sesi lari, set latihan 3D, makanan, dan air putih langsung tersimpan ke koleksi Firestore milik akun Google Anda.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
