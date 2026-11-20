'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signInWithPopup, signOut } from 'firebase/auth';
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe,
  LogIn,
  LogOut,
  ShieldCheck,
  Zap,
} from 'lucide-react';
import { auth, googleProvider } from '@/lib/firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import { useFitForgeStore } from '@/store/useFitForgeStore';

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    isAuthenticated,
    isLocalVercelAuth,
    profile,
    setGuideOpen,
    hasCompletedOnboarding,
    loginWithVercelFallback,
    logoutAccount,
  } = useFitForgeStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [unauthorizedDomainError, setUnauthorizedDomainError] = useState(false);
  const [showInstantLoginForm, setShowInstantLoginForm] = useState(false);
  const [currentDomain, setCurrentDomain] = useState('nama-aplikasi.vercel.app');
  const [copiedDomain, setCopiedDomain] = useState(false);

  const isUnauthorizedDomain =
    unauthorizedDomainError || searchParams.get('error') === 'unauthorized-domain';
  const isInstantFormOpen = showInstantLoginForm || isUnauthorizedDomain;

  const [fallbackName, setFallbackName] = useState(
    profile.displayName !== 'Atlet FitForge' ? profile.displayName : 'Atlet FitForge'
  );
  const [fallbackEmail, setFallbackEmail] = useState(profile.email || '');

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (typeof window !== 'undefined' && window.location.hostname) {
        setCurrentDomain(window.location.hostname);
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, []);

  const handleGoogleLogin = async () => {
    setError('');
    setUnauthorizedDomainError(false);
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
      } else if (
        msg.includes('auth/unauthorized-domain') ||
        msg.includes('auth/operation-not-supported-in-this-environment') ||
        msg.includes('auth/popup-blocked')
      ) {
        setUnauthorizedDomainError(true);
        setShowInstantLoginForm(true);
      } else {
        setError(`Gagal masuk dengan Google: ${msg}`);
        setShowInstantLoginForm(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleInstantVercelLogin = (e: React.FormEvent) => {
    e.preventDefault();
    loginWithVercelFallback(
      fallbackName.trim() || 'Atlet FitForge',
      fallbackEmail.trim() || 'atlet@fitforge.id'
    );
    setGuideOpen(true);
    if (!hasCompletedOnboarding) {
      router.push('/onboarding');
    } else {
      router.push('/dashboard');
    }
  };

  const handleCopyDomain = async () => {
    try {
      await navigator.clipboard.writeText(currentDomain);
      setCopiedDomain(true);
      setTimeout(() => setCopiedDomain(false), 2500);
    } catch {
      // ignore clipboard error
    }
  };

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch {
      // ignore signOut error if in local fallback mode
    }
    logoutAccount();
  };

  const firebaseConsoleUrl = `https://console.firebase.google.com/project/${firebaseConfig.projectId}/authentication/settings`;

  return (
    <div className="min-h-dvh pt-safe bg-[#F7F8F6] dark:bg-[#0B0D0E] text-[#0D0F10] dark:text-white flex flex-col justify-center items-center px-4 py-10 relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 w-[560px] h-[360px] rounded-full opacity-35 dark:opacity-18 blur-[110px]"
        style={{
          background: 'radial-gradient(circle, #A6FA3C 0%, #84E818 50%, transparent 75%)',
        }}
      />

      <div className="relative z-10 w-full max-w-xl rounded-3xl bg-white dark:bg-[#131618] border border-[#E6E8E4] dark:border-[#23282D] p-5 sm:p-8 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#0D0F10] dark:bg-[#84E818] text-[#84E818] dark:text-[#0D0F10] font-extrabold flex items-center justify-center text-sm tracking-tighter shrink-0">
              FF
            </div>
            <div className="min-w-0">
              <span className="text-lg font-extrabold tracking-tight block leading-none">FitForge</span>
              <span className="text-[11px] text-[#5A6068] dark:text-neutral-400 truncate block mt-0.5">Cloud Database &amp; Google Auth</span>
            </div>
          </Link>

          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-full bg-[#F5F7F4] dark:bg-[#1B1F23] hover:bg-[#EAECE8] dark:hover:bg-[#23282D] border border-[#E3E6E0] dark:border-[#2C3238] text-xs font-semibold text-[#0D0F10] dark:text-white transition cursor-pointer"
          >
            <BookOpen className="w-3.5 h-3.5 text-[#448500] dark:text-[#84E818]" />
            <span>Buka Panduan</span>
          </button>
        </div>

        <h1 className="text-2xl font-extrabold text-[#0D0F10] dark:text-white tracking-tight">
          Masuk ke Akun FitForge Anda
        </h1>
        <p className="text-xs sm:text-sm text-[#5A6068] dark:text-neutral-400 mt-1.5 mb-6 leading-relaxed">
          Hubungkan akun Anda untuk menyimpan seluruh progres latihan 3D, rute lari GPS, nutrisi AI, serta jadwal sholat &amp; hidrasi mulai dari nol (<code>0</code>) tanpa data dummy.
        </p>

        {error && (
          <div className="mb-5 p-3.5 rounded-xl bg-[#FFE4E6] text-[#BE123C] text-xs font-semibold">
            {error}
          </div>
        )}

        {isAuthenticated ? (
          <div className="rounded-2xl bg-[#F7F8F6] dark:bg-[#0B0D0E] border border-[#E6E8E4] dark:border-[#23282D] p-5 mb-6">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#3D7A00] dark:text-[#84E818] block">
                  ✓ {isLocalVercelAuth ? 'Aktif (Mode Domain Vercel / Perangkat)' : 'Terautentikasi dengan Google Cloud'}
                </span>
                <p className="text-base font-bold mt-0.5">{profile.displayName}</p>
                <p className="text-xs text-[#5A6068] dark:text-neutral-400">{profile.email}</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-full bg-white dark:bg-[#1B1F23] border border-[#E3E6E0] dark:border-[#2C3238] text-xs font-semibold cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Link
                href="/dashboard"
                className="py-3 px-4 rounded-full bg-[#0D0F10] dark:bg-[#84E818] text-white dark:text-[#0D0F10] font-bold text-xs text-center flex items-center justify-center gap-1.5"
              >
                <span>Buka Dashboard</span>
                <ArrowRight className="w-4 h-4 text-[#84E818] dark:text-[#0D0F10]" />
              </Link>
              <Link
                href="/onboarding"
                className="py-3 px-4 rounded-full bg-white dark:bg-[#1B1F23] border border-[#DFE2DC] dark:border-[#2C3238] font-semibold text-xs text-center flex items-center justify-center"
              >
                Atur Profil &amp; Target
              </Link>
            </div>
          </div>
        ) : (
          <>
            <button
              type="button"
              disabled={loading}
              onClick={handleGoogleLogin}
              className="w-full min-h-[48px] py-3.5 px-5 rounded-full bg-[#0D0F10] dark:bg-[#84E818] text-white dark:text-[#0D0F10] font-bold text-sm hover:opacity-92 disabled:opacity-50 transition flex items-center justify-center gap-2.5 shadow-sm cursor-pointer mb-4"
            >
              <LogIn className="w-4 h-4 text-[#84E818] dark:text-[#0D0F10] stroke-[2.5] shrink-0" />
              <span>
                {loading
                  ? 'Menghubungkan ke Google...'
                  : 'Masuk dengan Popup Google (Cloud Firestore)'}
              </span>
              <ArrowRight className="w-4 h-4 text-[#84E818] dark:text-[#0D0F10] shrink-0" />
            </button>

            {!isInstantFormOpen && (
              <div className="mb-5 text-center">
                <button
                  type="button"
                  onClick={() => setShowInstantLoginForm(true)}
                  className="min-h-[44px] px-3 py-2 text-xs font-semibold text-[#3D7A00] dark:text-[#84E818] hover:underline cursor-pointer"
                >
                  Deploy di Vercel / muncul error auth/unauthorized-domain? Klik untuk Masuk Instan →
                </button>
              </div>
            )}

            {isInstantFormOpen && (
              <div className="mb-6 rounded-2xl bg-[#F7F8F6] dark:bg-[#0B0D0E] border border-[#84E818]/60 p-5 space-y-4">
                {isUnauthorizedDomain && (
                  <div className="p-3.5 rounded-xl bg-[#ECFCD8] dark:bg-[#84E818]/10 border border-[#84E818]/40 text-xs space-y-2">
                    <div className="flex items-center gap-2 font-bold text-[#2D6200] dark:text-[#84E818]">
                      <Globe className="w-4 h-4 shrink-0" />
                      <span>
                        Terdeteksi Domain Baru ({currentDomain}) — Belum Didaftarkan di Firebase
                      </span>
                    </div>
                    <p className="text-[#374151] dark:text-neutral-300 leading-relaxed">
                      Pesan <code>auth/unauthorized-domain</code> muncul karena keamanan standar Firebase memblokir popup OAuth Google pada domain baru (seperti <strong>Vercel</strong>) sebelum domain tersebut ditambahkan ke daftar <em>Authorized Domains</em>.
                    </p>
                  </div>
                )}

                <form onSubmit={handleInstantVercelLogin} className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#3D7A00] dark:text-[#84E818]">
                    <Zap className="w-4 h-4" />
                    <span>
                      Opsi 1: Masuk Instan Sekarang (Tanpa Perlu Popup OAuth)
                    </span>
                  </div>
                  <p className="text-[11px] text-[#5A6068] dark:text-neutral-400 leading-relaxed">
                    Gunakan form di bawah ini untuk langsung masuk dan menggunakan FitForge di Vercel sekarang juga. Semua data lari, latihan 3D, dan nutrisi Anda tetap mulai dari <code>0</code> (tanpa dummy) dan tersimpan otomatis.
                  </p>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    <div>
                      <label htmlFor="vercel-name" className="block text-[11px] text-[#5A6068] dark:text-neutral-400 mb-1">
                        Nama Anda
                      </label>
                      <input
                        id="vercel-name"
                        type="text"
                        required
                        value={fallbackName}
                        onChange={(e) => setFallbackName(e.target.value)}
                        placeholder="Contoh: Budi Santoso"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#131618] border border-[#DFE2DC] dark:border-[#262B30] text-xs focus:outline-none focus:border-[#84E818]"
                      />
                    </div>
                    <div>
                      <label htmlFor="vercel-email" className="block text-[11px] text-[#5A6068] dark:text-neutral-400 mb-1">
                        Email Google Anda
                      </label>
                      <input
                        id="vercel-email"
                        type="email"
                        required
                        value={fallbackEmail}
                        onChange={(e) => setFallbackEmail(e.target.value)}
                        placeholder="nama@gmail.com"
                        className="w-full px-3 py-2 rounded-xl bg-white dark:bg-[#131618] border border-[#DFE2DC] dark:border-[#262B30] text-xs focus:outline-none focus:border-[#84E818]"
                      />
                    </div>
                  </div>

                  <button
                    type="submit"
                    className="w-full py-3 px-4 rounded-full bg-[#84E818] hover:opacity-92 text-[#0D0F10] font-extrabold text-xs flex items-center justify-center gap-2 transition cursor-pointer"
                  >
                    <Zap className="w-4 h-4 fill-[#0D0F10]" />
                    <span>Masuk Instan &amp; Buka FitForge Sekarang</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>

                <div className="pt-3 border-t border-[#E6E8E4] dark:border-[#23282D] space-y-2.5 text-xs">
                  <p className="font-bold text-[#3D7A00] dark:text-[#84E818]">
                    Opsi 2: Aktifkan Popup Google Resmi di Domain Vercel (Hanya 30 Detik)
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-[11px] text-[#525860] dark:text-neutral-300 leading-relaxed">
                    <li>
                      Salin domain Vercel Anda saat ini: <code className="px-1.5 py-0.5 rounded bg-white dark:bg-[#1B1F23] text-[#3D7A00] dark:text-[#84E818]">{currentDomain}</code>
                    </li>
                    <li>
                      Buka <strong>Firebase Console → Authentication → Settings → Authorized domains</strong> (Project ID: <code>{firebaseConfig.projectId}</code>).
                    </li>
                    <li>
                      Klik tombol <strong>Add domain</strong>, tempel <code>{currentDomain}</code>, lalu simpan. Setelah itu tombol <em>Masuk dengan Popup Google</em> di atas akan langsung berfungsi di Vercel!
                    </li>
                  </ol>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleCopyDomain}
                      className="px-3 py-2 rounded-full bg-white dark:bg-[#1B1F23] border border-[#DFE2DC] dark:border-[#2C3238] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5 text-[#448500] dark:text-[#84E818]" />
                      <span>{copiedDomain ? '✓ Domain Tersalin!' : `Salin Domain (${currentDomain})`}</span>
                    </button>

                    <a
                      href={firebaseConsoleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-full bg-[#0D0F10] dark:bg-[#1B1F23] text-white dark:text-[#84E818] text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <span>Buka Firebase Console</span>
                      <ExternalLink className="w-3.5 h-3.5 text-[#84E818]" />
                    </a>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <div className="rounded-2xl bg-[#F7F8F6] dark:bg-[#0B0D0E] border border-[#E6E8E4] dark:border-[#23282D] p-4 space-y-2.5">
          <div className="flex items-center gap-2 text-xs font-bold text-[#3D7A00] dark:text-[#84E818]">
            <ShieldCheck className="w-4 h-4" />
            <span>Panduan Cepat Setelah Login:</span>
          </div>
          <div className="flex items-start gap-2 text-xs text-[#434950] dark:text-neutral-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#448500] dark:text-[#84E818] shrink-0 mt-0.5" />
            <span>
              <strong>1. Semua Mulai dari 0:</strong> Tidak ada data dummy. Jarak lari (0 km), latihan (0 sesi), kalori (0 kkal), dan air (0 ml) siap diisi dari aktivitas asli Anda.
            </span>
          </div>
          <div className="flex items-start gap-2 text-xs text-[#434950] dark:text-neutral-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#448500] dark:text-[#84E818] shrink-0 mt-0.5" />
            <span>
              <strong>2. Atur Target di Onboarding:</strong> Isi berat badan, tinggi badan, dan kota domisili agar target nutrisi &amp; jadwal sholat Kemenag RI terhitung otomatis.
            </span>
          </div>
          <div className="flex items-start gap-2 text-xs text-[#434950] dark:text-neutral-300">
            <CheckCircle2 className="w-3.5 h-3.5 text-[#448500] dark:text-[#84E818] shrink-0 mt-0.5" />
            <span>
              <strong>3. Tersimpan di Akun Anda:</strong> Setiap sesi lari, set latihan 3D, makanan, dan air putih langsung tersimpan dan dapat dihapus kapan saja per item.
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-dvh bg-[#F7F8F6] dark:bg-[#0B0D0E] text-[#0D0F10] dark:text-white flex items-center justify-center text-sm">
          Memuat Halaman Login FitForge...
        </div>
      }
    >
      <LoginContent />
    </Suspense>
  );
}
