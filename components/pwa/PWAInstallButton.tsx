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
    <div className="fixed bottom-[calc(4.5rem+env(safe-area-inset-bottom,0px))] md:bottom-4 left-3 right-3 sm:right-auto z-50 flex items-center gap-2 rounded-lg bg-[#0D0F10] dark:bg-[#F7F8F6] px-3.5 py-2.5 text-xs font-bold text-white dark:text-[#0D0F10] shadow-xl border border-[#84E818]/40">
      <WifiOff className="w-4 h-4 text-[#84E818] dark:text-[#448500] shrink-0" />
      <span className="min-w-0 truncate">Mode Offline — Data Lari GPS &amp; Latihan Tersimpan Lokal</span>
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
            ? 'w-full min-h-[44px] py-2.5 px-4 rounded-lg bg-[#0D0F10] dark:bg-[#F7F8F6] text-white dark:text-[#0D0F10] text-xs font-extrabold flex items-center justify-center gap-2 shadow-sm active:scale-[0.98] transition-transform cursor-pointer'
            : 'hidden sm:inline-flex items-center justify-center gap-1.5 min-h-[40px] px-3 rounded-lg bg-white dark:bg-[#131618] hover:bg-[#F1F3EF] dark:hover:bg-[#1B1F23] border border-[#E3E6E0] dark:border-[#262B30] text-xs font-semibold text-[#0D0F10] dark:text-[#F5F7F5] active:scale-[0.97] transition whitespace-nowrap shrink-0 cursor-pointer'
        }
        title="Install Aplikasi FitForge di HP / Perangkat Anda (PWA)"
      >
        <Download className="w-3.5 h-3.5 text-[#84E818] dark:text-[#448500] shrink-0" />
        <span>{deferredPrompt ? 'Install App' : isIOS ? 'Install iOS' : 'Install App'}</span>
      </button>

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-xs p-4 overflow-y-auto"
          role="dialog"
          aria-modal="true"
          aria-label="Panduan Install Aplikasi Mobile PWA"
        >
          <div className="w-full max-w-md rounded-xl bg-white dark:bg-[#131618] border border-[#E3E6E0] dark:border-[#262B30] p-6 text-[#0D0F10] dark:text-white shadow-2xl my-auto">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-lg bg-[#0D0F10] dark:bg-[#F7F8F6] text-[#84E818] dark:text-[#0D0F10] flex items-center justify-center">
                  <Smartphone className="w-5 h-5 stroke-[2.2]" />
                </div>
                <div>
                  <h3 className="text-base font-extrabold">Install FitForge di HP (PWA)</h3>
                  <p className="text-[11px] text-[#5A6068] dark:text-[#9AA2AC]">
                    Layar Penuh · Offline GPS · Studio 3D IK
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 rounded-lg text-[#5A6068] hover:text-[#0D0F10] dark:hover:text-white hover:bg-[#EFF1EE] dark:hover:bg-[#1B1F23] cursor-pointer"
                aria-label="Tutup panduan instalasi"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {deferredPrompt && (
              <button
                type="button"
                onClick={handleInstallClick}
                className="w-full mb-4 py-3 px-4 rounded-lg bg-[#0D0F10] dark:bg-[#F7F8F6] text-white dark:text-[#0D0F10] font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 shadow-sm cursor-pointer"
              >
                <Download className="w-4 h-4 text-[#84E818] dark:text-[#448500] stroke-[2.5]" />
                <span>Pasang Otomatis ke Layar Utama Sekarang</span>
              </button>
            )}

            <div className="space-y-3 text-xs text-[#434950] dark:text-neutral-300">
              <div className="rounded-lg bg-[#F7F8F6] dark:bg-[#0B0D0E] border border-[#E6E8E4] dark:border-[#23282D] p-4 space-y-3">
                <div>
                  <p className="font-bold text-[#3D7A00] dark:text-[#84E818] flex items-center gap-1.5 mb-1">
                    <Zap className="w-3.5 h-3.5" />
                    <span>Android (Chrome / Samsung Internet / Edge):</span>
                  </p>
                  <ol className="list-decimal list-inside space-y-1 leading-relaxed">
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

                <div className="pt-2.5 border-t border-[#E6E8E4] dark:border-[#23282D]">
                  <p className="font-bold text-[#3D7A00] dark:text-[#84E818] flex items-center gap-1.5 mb-1">
                    <Share className="w-3.5 h-3.5" />
                    <span>iPhone &amp; iPad (Safari iOS 16.4+):</span>
                  </p>
                  <ol className="list-decimal list-inside space-y-1 leading-relaxed">
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

              <div className="rounded-lg bg-[#F7F8F6] dark:bg-[#0B0D0E] border border-[#E6E8E4] dark:border-[#23282D] p-3.5 space-y-2">
                <p className="font-bold text-[#0D0F10] dark:text-white text-xs">
                  Status Fungsi Mobile &amp; Sensor Perangkat:
                </p>
                <div className="grid grid-cols-2 gap-2 text-[11px]">
                  <div className="flex items-center gap-1.5 text-[#3D7A00] dark:text-[#84E818]">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>{swReady ? 'Offline Cache Siap' : 'Mode PWA Siap'}</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[#3D7A00] dark:text-[#84E818]">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>GPS &amp; Wake Lock Aktif</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[#3D7A00] dark:text-[#84E818]">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>3D IK Touch Orbit</span>
                  </div>
                  <div className="flex items-center gap-1.5 text-[#3D7A00] dark:text-[#84E818]">
                    <CheckCircle2 className="w-3.5 h-3.5 shrink-0" />
                    <span>Kamera Scan Nutrisi AI</span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={handleTestMobileAudio}
                  className="w-full mt-2 py-2 px-3 rounded-lg bg-white dark:bg-[#1B1F23] hover:bg-[#EFF1EE] dark:hover:bg-[#23282D] border border-[#E3E6E0] dark:border-[#2C3238] text-[#0D0F10] dark:text-white text-xs font-semibold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <Volume2 className="w-3.5 h-3.5 text-[#448500] dark:text-[#84E818]" />
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
              className="mt-4 w-full py-2.5 rounded-lg bg-[#0D0F10] dark:bg-[#F7F8F6] text-xs sm:text-sm font-extrabold text-white dark:text-[#0D0F10] hover:opacity-92 transition cursor-pointer"
            >
              Mengerti &amp; Lanjutkan
            </button>
          </div>
        </div>
      )}
    </>
  );
}
