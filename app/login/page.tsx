'use client';

import React, { Suspense, useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';
import { signOut } from 'firebase/auth';
import {
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Copy,
  ExternalLink,
  Globe,
  Loader2,
  LogIn,
  LogOut,
  Moon,
  ShieldCheck,
  Sun,
  Zap,
} from 'lucide-react';
import { auth, isRunningInIframe, signInWithGoogleSafe } from '@/lib/firebase';
import firebaseConfig from '../../firebase-applet-config.json';
import { useFitForgeStore } from '@/store/useFitForgeStore';

function formatQueryAuthError(code: string, inIframe: boolean, host: string): string {
  if (code === 'auth/unauthorized-domain' || code === 'unauthorized-domain') {
    return `Domain "${host}" belum terdaftar di Authorized Domains Firebase (${firebaseConfig.projectId}). Tambahkan domain di Firebase Console atau gunakan Masuk Instan di bawah.`;
  }
  if (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment') {
    return inIframe
      ? `Popup Google diblokir di dalam pratinjau iframe (${code}). Klik "Buka di Tab Baru" agar popup Google berjalan penuh, atau gunakan Masuk Instan.`
      : `Popup login Google diblokir oleh browser (${code}). Izinkan pop-up untuk situs ini lalu coba lagi.`;
  }
  if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') {
    return inIframe
      ? `Popup Google langsung tertutup di dalam pratinjau iframe (${code}). Klik "Buka di Tab Baru" untuk login Google penuh, atau gunakan Masuk Instan.`
      : `Jendela login Google ditutup sebelum selesai (${code}). Silakan klik tombol Masuk Google lagi.`;
  }
  return `Login Google gagal (${code}). Coba buka di tab baru atau gunakan Masuk Instan.`;
}

function LoginContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const {
    isAuthenticated,
    isLocalVercelAuth,
    profile,
    darkMode,
    toggleDarkMode,
    setGuideOpen,
    hasCompletedOnboarding,
    loginWithVercelFallback,
    logoutAccount,
  } = useFitForgeStore();

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [errorCode, setErrorCode] = useState('');
  const [unauthorizedDomainError, setUnauthorizedDomainError] = useState(false);
  const [showInstantLoginForm, setShowInstantLoginForm] = useState(false);
  const [currentDomain, setCurrentDomain] = useState('fitforge.app');
  const [embeddedInIframe, setEmbeddedInIframe] = useState(false);
  const [copiedDomain, setCopiedDomain] = useState(false);

  const queryAuthError = searchParams.get('authError') || searchParams.get('error') || '';
  const queryIframe = searchParams.get('iframe') === '1';

  const isUnauthorizedDomain =
    unauthorizedDomainError ||
    queryAuthError === 'unauthorized-domain' ||
    queryAuthError === 'auth/unauthorized-domain';
  const isInstantFormOpen = showInstantLoginForm || isUnauthorizedDomain || Boolean(queryAuthError);

  const [fallbackName, setFallbackName] = useState(
    profile.displayName !== 'Atlet FitForge' ? profile.displayName : 'Atlet FitForge'
  );
  const [fallbackEmail, setFallbackEmail] = useState(profile.email || '');

  useEffect(() => {
    if (typeof document !== 'undefined') {
      document.documentElement.classList.toggle('dark', darkMode);
    }
  }, [darkMode]);

  useEffect(() => {
    const t = window.setTimeout(() => {
      if (typeof window !== 'undefined') {
        const host = window.location.hostname || 'fitforge.app';
        const inFrame = isRunningInIframe() || queryIframe;
        setCurrentDomain(host);
        setEmbeddedInIframe(inFrame);
        if (queryAuthError) {
          setErrorCode(queryAuthError);
          setError(formatQueryAuthError(queryAuthError, inFrame, host));
          setShowInstantLoginForm(true);
        }
      }
    }, 0);
    return () => window.clearTimeout(t);
  }, [queryAuthError, queryIframe]);

  const handleGoogleLogin = async () => {
    setError('');
    setErrorCode('');
    setUnauthorizedDomainError(false);
    setLoading(true);
    try {
      const res = await signInWithGoogleSafe();
      if (res.ok) {
        setGuideOpen(true);
        router.push(hasCompletedOnboarding ? '/dashboard' : '/onboarding');
        return;
      }
      setErrorCode(res.code || 'auth/unknown');
      setError(res.message || 'Gagal masuk dengan Google.');
      if (res.isEmbeddedIframe) setEmbeddedInIframe(true);
      if (res.isUnauthorizedDomain) setUnauthorizedDomainError(true);
      setShowInstantLoginForm(true);
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
    router.push(hasCompletedOnboarding ? '/dashboard' : '/onboarding');
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
    <div className="min-h-dvh pt-safe bg-[#F7F8F6] dark:bg-[#0B0D0E] text-[#0D0F10] dark:text-white flex flex-col justify-center items-center px-4 py-8 sm:py-10 relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-1/4 left-1/2 -translate-x-1/2 w-[540px] h-[340px] rounded-full opacity-30 dark:opacity-15 blur-[110px]"
        style={{
          background: 'radial-gradient(circle, #A6FA3C 0%, #84E818 50%, transparent 75%)',
        }}
      />

      <div className="relative z-10 w-full max-w-xl rounded-xl bg-white dark:bg-[#131618] border border-[#E3E6E0] dark:border-[#23282D] p-5 sm:p-7 shadow-xl">
        <div className="flex flex-wrap items-center justify-between gap-2.5 mb-6">
          <Link href="/" className="flex items-center gap-2.5 min-w-0">
            <div className="w-10 h-10 rounded-lg bg-[#0D0F10] dark:bg-[#F7F8F6] text-[#84E818] dark:text-[#0D0F10] font-extrabold flex items-center justify-center text-sm tracking-tighter shrink-0">
              FF
            </div>
            <div className="min-w-0">
              <span className="text-lg font-extrabold tracking-tight block leading-none">FitForge</span>
              <span className="text-[11px] text-[#5A6068] dark:text-neutral-400 truncate block mt-0.5">
                Cloud Database &amp; Google Auth
              </span>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleDarkMode}
              aria-label={darkMode ? 'Beralih ke Mode Terang' : 'Beralih ke Mode Gelap'}
              className="w-10 h-10 rounded-full bg-[#F5F7F4] dark:bg-[#1B1F23] hover:bg-[#EAECE8] dark:hover:bg-[#23282D] border border-[#E3E6E0] dark:border-[#2C3238] flex items-center justify-center transition cursor-pointer"
            >
              {darkMode ? (
                <Sun className="w-4 h-4 text-[#84E818]" />
              ) : (
                <Moon className="w-4 h-4 text-[#0D0F10]" />
              )}
            </button>
            <button
              type="button"
              onClick={() => setGuideOpen(true)}
              className="inline-flex items-center gap-1.5 min-h-[40px] px-3.5 py-2 rounded-lg bg-[#F5F7F4] dark:bg-[#1B1F23] hover:bg-[#EAECE8] dark:hover:bg-[#23282D] border border-[#E3E6E0] dark:border-[#2C3238] text-xs font-semibold text-[#0D0F10] dark:text-white transition cursor-pointer"
            >
              <BookOpen className="w-3.5 h-3.5 text-[#448500] dark:text-[#84E818]" />
              <span>Panduan</span>
            </button>
          </div>
        </div>

        <h1 className="text-2xl font-extrabold text-[#0D0F10] dark:text-white tracking-tight">
          Masuk ke Akun FitForge Anda
        </h1>
        <p className="text-xs sm:text-sm text-[#5A6068] dark:text-neutral-400 mt-1.5 mb-5 leading-relaxed">
          Hubungkan akun Anda untuk menyimpan seluruh progres latihan 3D, rute lari GPS, nutrisi AI, serta jadwal sholat &amp; hidrasi mulai dari nol (<code>0</code>) tanpa data dummy.
        </p>

        {error && (
          <div
            role="alert"
            className="mb-5 p-3.5 rounded-lg bg-[#FFF1F2] dark:bg-[#2A1216] border border-[#FECDD3] dark:border-[#6B1D29] text-[#BE123C] dark:text-[#FDA4AF] text-xs space-y-2.5"
          >
            <div className="flex items-start gap-2 font-semibold leading-relaxed">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <div>
                <p>{error}</p>
                {errorCode && (
                  <p className="mt-1 font-mono text-[10px] opacity-80">
                    Kode diagnostik: {errorCode}
                  </p>
                )}
              </div>
            </div>
            {(embeddedInIframe ||
              errorCode === 'auth/popup-blocked' ||
              errorCode === 'auth/popup-closed-by-user') && (
              <div className="flex flex-wrap items-center gap-2 pt-0.5">
                <a
                  href="/login"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#0D0F10] dark:bg-[#F7F8F6] text-white dark:text-[#0D0F10] text-[11px] font-bold"
                >
                  <ExternalLink className="w-3.5 h-3.5 text-[#84E818] dark:text-[#448500]" />
                  <span>Buka di Tab Baru (Popup Google Penuh)</span>
                </a>
              </div>
            )}
          </div>
        )}

        {isAuthenticated ? (
          <div className="rounded-xl bg-[#F7F8F6] dark:bg-[#0B0D0E] border border-[#E3E6E0] dark:border-[#23282D] p-5 mb-5">
            <div className="flex items-center justify-between gap-3 mb-4">
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-[#3D7A00] dark:text-[#84E818] block">
                  ✓ {isLocalVercelAuth ? 'Aktif (Mode Perangkat / Vercel)' : 'Terautentikasi dengan Google Cloud'}
                </span>
                <p className="text-base font-bold mt-0.5">{profile.displayName}</p>
                <p className="text-xs text-[#5A6068] dark:text-neutral-400">{profile.email}</p>
              </div>
              <button
                type="button"
                onClick={handleLogout}
                className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-white dark:bg-[#1B1F23] border border-[#E3E6E0] dark:border-[#2C3238] text-xs font-semibold cursor-pointer"
              >
                <LogOut className="w-3.5 h-3.5" />
                <span>Keluar</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <Link
                href="/dashboard"
                className="py-3 px-4 rounded-full bg-[#0D0F10] dark:bg-[#F7F8F6] text-white dark:text-[#0D0F10] font-bold text-xs text-center flex items-center justify-center gap-1.5"
              >
                <span>Buka Dashboard</span>
                <ArrowRight className="w-4 h-4 text-[#84E818] dark:text-[#448500]" />
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
              className="w-full min-h-[48px] py-3.5 px-5 rounded-full bg-[#0D0F10] dark:bg-[#F7F8F6] text-white dark:text-[#0D0F10] font-bold text-sm hover:opacity-92 disabled:opacity-55 transition flex items-center justify-center gap-2.5 shadow-sm cursor-pointer mb-3.5"
            >
              {loading ? (
                <Loader2 className="w-4 h-4 animate-spin text-[#84E818] dark:text-[#448500] shrink-0" />
              ) : (
                <LogIn className="w-4 h-4 text-[#84E818] dark:text-[#448500] stroke-[2.5] shrink-0" />
              )}
              <span>
                {loading
                  ? 'Membuka Jendela Google...'
                  : 'Masuk dengan Popup Google (Cloud Firestore)'}
              </span>
              {!loading && (
                <ArrowRight className="w-4 h-4 text-[#84E818] dark:text-[#448500] shrink-0" />
              )}
            </button>

            {embeddedInIframe && !error && (
              <div className="mb-4 px-3.5 py-2.5 rounded-lg bg-[#F5F7F4] dark:bg-[#1B1F23] border border-[#E3E6E0] dark:border-[#2C3238] flex flex-wrap items-center justify-between gap-2 text-[11px] text-[#525860] dark:text-neutral-300">
                <span>Sedang berjalan di jendela pratinjau? Popup Google paling stabil di tab penuh.</span>
                <a
                  href="/login"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 font-bold text-[#3D7A00] dark:text-[#84E818] hover:underline shrink-0"
                >
                  <span>Buka Tab Baru</span>
                  <ExternalLink className="w-3 h-3" />
                </a>
              </div>
            )}

            {!isInstantFormOpen && (
              <div className="mb-5 text-center">
                <button
                  type="button"
                  onClick={() => setShowInstantLoginForm(true)}
                  className="min-h-[40px] px-3 py-2 text-xs font-semibold text-[#3D7A00] dark:text-[#84E818] hover:underline cursor-pointer"
                >
                  Popup terblokir atau deploy di Vercel? Klik untuk Masuk Instan →
                </button>
              </div>
            )}

            {isInstantFormOpen && (
              <div className="mb-5 rounded-xl bg-[#F7F8F6] dark:bg-[#0B0D0E] border border-[#84E818]/55 p-4 sm:p-5 space-y-4">
                {isUnauthorizedDomain && (
                  <div className="p-3.5 rounded-lg bg-[#ECFCD8] dark:bg-[#84E818]/10 border border-[#84E818]/40 text-xs space-y-2">
                    <div className="flex items-center gap-2 font-bold text-[#2D6200] dark:text-[#84E818]">
                      <Globe className="w-4 h-4 shrink-0" />
                      <span>
                        Terdeteksi Domain Baru ({currentDomain}) — Belum Didaftarkan di Firebase
                      </span>
                    </div>
                    <p className="text-[#374151] dark:text-neutral-300 leading-relaxed">
                      Pesan <code>auth/unauthorized-domain</code> muncul karena keamanan Firebase memblokir popup OAuth Google sebelum domain ditambahkan ke daftar <em>Authorized Domains</em>.
                    </p>
                  </div>
                )}

                <form onSubmit={handleInstantVercelLogin} className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-bold text-[#3D7A00] dark:text-[#84E818]">
                    <Zap className="w-4 h-4" />
                    <span>Opsi 1: Masuk Instan Sekarang (Tanpa Popup OAuth)</span>
                  </div>
                  <p className="text-[11px] text-[#5A6068] dark:text-neutral-400 leading-relaxed">
                    Langsung masuk dan gunakan FitForge sekarang juga. Semua data lari, latihan 3D, dan nutrisi tetap mulai dari <code>0</code> (tanpa dummy) dan tersimpan otomatis.
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
                        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#131618] border border-[#DFE2DC] dark:border-[#262B30] text-xs focus:outline-none focus:border-[#84E818]"
                      />
                    </div>
                    <div>
                      <label htmlFor="vercel-email" className="block text-[11px] text-[#5A6068] dark:text-neutral-400 mb-1">
                        Email Anda
                      </label>
                      <input
                        id="vercel-email"
                        type="email"
                        required
                        value={fallbackEmail}
                        onChange={(e) => setFallbackEmail(e.target.value)}
                        placeholder="nama@gmail.com"
                        className="w-full px-3 py-2 rounded-lg bg-white dark:bg-[#131618] border border-[#DFE2DC] dark:border-[#262B30] text-xs focus:outline-none focus:border-[#84E818]"
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

                <div className="pt-3 border-t border-[#E3E6E0] dark:border-[#23282D] space-y-2.5 text-xs">
                  <p className="font-bold text-[#3D7A00] dark:text-[#84E818]">
                    Opsi 2: Aktifkan Popup Google Resmi di Domain Ini
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-[11px] text-[#525860] dark:text-neutral-300 leading-relaxed">
                    <li>
                      Salin domain saat ini:{' '}
                      <code className="px-1.5 py-0.5 rounded bg-white dark:bg-[#1B1F23] text-[#3D7A00] dark:text-[#84E818]">
                        {currentDomain}
                      </code>
                    </li>
                    <li>
                      Buka <strong>Firebase Console → Authentication → Settings → Authorized domains</strong> (Project ID: <code>{firebaseConfig.projectId}</code>).
                    </li>
                    <li>
                      Klik <strong>Add domain</strong>, tempel <code>{currentDomain}</code>, lalu simpan.
                    </li>
                  </ol>

                  <div className="flex flex-wrap items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={handleCopyDomain}
                      className="px-3 py-2 rounded-lg bg-white dark:bg-[#1B1F23] border border-[#DFE2DC] dark:border-[#2C3238] text-xs font-semibold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Copy className="w-3.5 h-3.5 text-[#448500] dark:text-[#84E818]" />
                      <span>{copiedDomain ? '✓ Domain Tersalin!' : `Salin Domain (${currentDomain})`}</span>
                    </button>

                    <a
                      href={firebaseConsoleUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="px-3 py-2 rounded-lg bg-[#0D0F10] dark:bg-[#F7F8F6] text-white dark:text-[#0D0F10] text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <span>Buka Firebase Console</span>
                      <ExternalLink className="w-3.5 h-3.5 text-[#84E818] dark:text-[#448500]" />
                    </a>
                  </div>
                </div>
              </div>
            )}
          </>
        )}

        <div className="rounded-xl bg-[#F7F8F6] dark:bg-[#0B0D0E] border border-[#E3E6E0] dark:border-[#23282D] p-4 space-y-2.5">
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
