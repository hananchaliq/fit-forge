'use client';

import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Download,
  Share,
  Smartphone,
  Volume2,
  WifiOff,
  X,
  Zap,
} from 'lucide-react';
import { soundEngine } from '@/lib/audio';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function useOnlineStatus() {
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const initTimer = window.setTimeout(() => setIsOnline(navigator.onLine), 0);
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    return () => {
      window.clearTimeout(initTimer);
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return isOnline;
}

export function OfflineIndicator() {
  const isOnline = useOnlineStatus();
  if (isOnline) return null;

  return (
    <div className="fixed bottom-20 md:bottom-4 left-4 z-50 flex items-center gap-2 rounded-xl bg-[#F59E0B] px-3.5 py-2 text-xs font-extrabold text-black shadow-xl border border-black/15">
      <WifiOff className="w-4 h-4 shrink-0" />
      <span>Mode Offline — Data Lari GPS &amp; Latihan Tersimpan di Perangkat</span>
    </div>
  );
}

export function PWAInstallButton({ fullWidthMobile = false }: { fullWidthMobile?: boolean }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [swReady, setSwReady] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);
  const [audioTested, setAudioTested] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Register Service Worker (/sw.js)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(() => setSwReady(true))
        .catch(() => {});
    }

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    const ua = window.navigator.userAgent.toLowerCase();
    const iosDetected = /iphone|ipad|ipod/.test(ua);

    const initTimer = window.setTimeout(() => {
      setIsInstalled(isStandalone);
      setIsIOS(iosDetected);
    }, 0);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
      setShowGuideModal(false);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);
    return () => {
      window.clearTimeout(initTimer);
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  if (isInstalled) return null;

  const handleInstallClick = async () => {
    if (deferredPrompt) {
      await deferredPrompt.prompt();
      const { outcome } = await deferredPrompt.userChoice;
      if (outcome === 'accepted') {
        setIsInstalled(true);
        setDeferredPrompt(null);
      }
    } else {
      setShowGuideModal(true);
    }
  };

  const handleTestMobileAudio = () => {
    soundEngine.playChime('set_done');
    soundEngine.speakIndonesian(
      'Sistem audio dan panduan suara Bahasa Indonesia aktif di perangkat Anda.'
    );
    setAudioTested(true);
  };

  return (
    <>
      <button
        type="button"
        data-testid="pwa-install-btn"
        onClick={handleInstallClick}
        className={
          fullWidthMobile
            ? 'w-full py-2.5 px-3.5 rounded-xl bg-gradient-to-r from-[#F97316] to-[#F59E0B] text-black text-xs font-extrabold flex items-center justify-center gap-2 shadow-md cursor-pointer'
            : 'inline-flex items-center gap-1.5 px-2 sm:px-3 py-1.5 rounded-xl bg-[#1E1E1E] hover:bg-[#262626] border border-[#F59E0B]/40 text-xs font-bold text-[#F59E0B] transition-colors whitespace-nowrap shrink-0 cursor-pointer'
        }
        title="Install Aplikasi FitForge di HP / Perangkat Anda (PWA)"
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span className={fullWidthMobile ? 'inline' : 'hidden sm:inline'}>
          {deferredPrompt ? 'Install App' : isIOS ? 'Install iOS' : 'Install App'}
        </span>
        {!fullWidthMobile && <span className="sm:hidden text-[11px]">App</span>}
      </button>

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Panduan Install Aplikasi Mobile PWA"
        >
          <div className="w-full max-w-md rounded-3xl bg-[#161616] border border-[#262626] p-6 text-white shadow-2xl my-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-[#F97316] to-[#F59E0B] text-black flex items-center justify-center">
                  <Smartphone className="w-5 h-5 stroke-[2.5]" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold">Install FitForge di HP (PWA)</h3>
                  <p className="text-[11px] text-neutral-400">
                    Layar Penuh · Offline GPS · Studio 3D 1024-Bit
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-[#262626] cursor-pointer"
                aria-label="Tutup panduan instalasi"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {deferredPrompt && (
              <button
                type="button"
                onClick={handleInstallClick}
                className="w-full mb-4 py-3 px-4 rounded-2xl bg-gradient-to-r from-[#EF4444] via-[#F97316] to-[#F59E0B] text-black font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-lg cursor-pointer"
              >
                <Download className="w-4 h-4 stroke-[2.5]" />
                <span>Pasang Otomatis ke Layar Utama Sekarang</span>
              </button>
            )}

            <div className="space-y-3 text-xs text-neutral-300">
              <div className="rounded-2xl bg-[#0E0E0E] border border-[#262626] p-4 space-y-3">
                <div>
                  <p className="font-bold text-[#F59E0B] flex items-center gap-1.5 mb-1">
                    <Zap className="w-3.5 h-3.5" />
                    <span>Android (Chrome / Samsung Internet / Edge):</span>
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-neutral-300 leading-relaxed">
                    <li>
                      Ketuk ikon <strong>Menu (⋮)</strong> di pojok kanan atas browser HP Anda.
                    </li>
                    <li>
                      Pilih <strong>&ldquo;Install app&rdquo;</strong> atau{' '}
                      <strong>&ldquo;Tambahkan ke Layar Utama&rdquo;</strong>.
                    </li>
                    <li>
                      Aplikasi FitForge akan muncul di layar utama HP dengan ikon resmi dan berjalan layar penuh tanpa bar alamat browser.
                    </li>
                  </ol>
                </div>

                <div className="pt-2.5 border-t border-[#262626]">
                  <p className="font-bold text-[#F59E0B] flex items-center gap-1.5 mb-1">
                    <Share className="w-3.5 h-3.5" />
                    <span>iPhone &amp; iPad (Safari iOS 16.4+):</span>
                  </p>
                  <ol className="list-decimal list-inside space-y-1 text-neutral-300 leading-relaxed">
                    <li>
                      Ketuk tombol <strong>Bagikan (Share)</strong> di bilah bawah Safari.
                    </li>
                    <li>
                      Gulir ke bawah lalu pilih{' '}
                      <strong>&ldquo;Tambah ke Layar Utama&rdquo; (Add to Home Screen)</strong>.
                    </li>
                    <li>
                      Ketuk <strong>Tambah (Add)</strong> di pojok kanan atas.
                    </li>
                  </ol>
                </div>
              </div>

              {/* Mobile Functions Readiness & Audio Unlock */}
              <div className="rounded-2xl bg-[#0E0E0E] border border-[#262626] p-3.5 space-y-2">
                <p className="font-bold text-white text-xs">
                  Status Fungsi Mobile &amp; Sensor Perangkat:
                </p>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{swReady ? 'Offline Cache Siap' : 'Mode PWA Siap'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>GPS &amp; Wake Lock Aktif</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>3D 1024-Bit Touch Orbit</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-emerald-400">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Kamera Scan Nutrisi AI</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTestMobileAudio}
                  className="w-full mt-2 py-2 px-3 rounded-xl bg-[#262626] hover:bg-[#333333] text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5 text-[#F59E0B]" />
                  <span>
                    {audioTested
                      ? '✓ Audio & Voice Coach Indonesia Aktif!'
                      : 'Aktifkan & Tes Suara Pelatih di HP'}
                  </span>
                </button>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="mt-4 w-full py-2.5 rounded-xl bg-gradient-to-r from-[#F97316] to-[#F59E0B] text-xs sm:text-sm font-extrabold text-black hover:opacity-95 transition cursor-pointer"
            >
              Mengerti &amp; Lanjutkan
            </button>
          </div>
        </div>
      )}
    </>
  );
}
