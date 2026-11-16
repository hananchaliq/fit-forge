'use client';

import React, { useEffect, useState } from 'react';
import { Download, Smartphone, X } from 'lucide-react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function PWAInstallButton() {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [showGuideModal, setShowGuideModal] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Register Service Worker (/sw.js)
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }

    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone === true;
    const initTimer = window.setTimeout(() => setIsInstalled(isStandalone), 0);

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
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

  return (
    <>
      <button
        type="button"
        onClick={handleInstallClick}
        className="hidden sm:inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-[#1E1E1E] hover:bg-[#262626] border border-[#333333] text-xs font-medium text-neutral-200 transition-colors whitespace-nowrap shrink-0"
        title="Pasang Aplikasi FitForge (PWA)"
      >
        <Download className="w-3.5 h-3.5 text-[#F59E0B]" />
        <span>Pasang PWA</span>
      </button>

      {showGuideModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Panduan Pasang Aplikasi PWA"
        >
          <div className="w-full max-w-md rounded-2xl bg-[#161616] border border-[#262626] p-6 text-white shadow-2xl">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2.5">
                <div className="w-9 h-9 rounded-xl bg-[#F97316]/15 border border-[#F97316]/30 flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-[#F97316]" />
                </div>
                <h3 className="text-base font-bold">Pasang FitForge di Perangkat Anda</h3>
              </div>
              <button
                type="button"
                onClick={() => setShowGuideModal(false)}
                className="p-1.5 rounded-lg text-neutral-400 hover:text-white hover:bg-[#262626]"
                aria-label="Tutup panduan instalasi"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <div className="space-y-3 text-sm text-neutral-300">
              <p>
                Pasang FitForge ke layar utama agar dapat berjalan layar penuh (standalone), menyimpan data lari GPS saat offline, dan menerima notifikasi pengingat Sholat & Hidrasi:
              </p>
              <div className="rounded-xl bg-[#0E0E0E] border border-[#262626] p-3.5 space-y-2 text-xs">
                <p>
                  <strong className="text-[#F59E0B]">Chrome / Edge (Android & Desktop):</strong> Klik ikon{' '}
                  <span className="text-white font-semibold">Install FitForge</span> di bilah alamat browser atau menu tiga titik → <em>Install app</em>.
                </p>
                <p>
                  <strong className="text-[#F59E0B]">Safari (iPhone / iPad iOS 16.4+):</strong> Ketuk tombol{' '}
                  <span className="text-white font-semibold">Bagikan (Share)</span> di bawah layar lalu pilih{' '}
                  <span className="text-white font-semibold">Tambah ke Layar Utama (Add to Home Screen)</span>.
                </p>
              </div>
            </div>
            <button
              type="button"
              onClick={() => setShowGuideModal(false)}
              className="mt-5 w-full py-2.5 rounded-xl bg-gradient-to-r from-[#F97316] to-[#F59E0B] text-sm font-semibold text-black hover:opacity-95 transition"
            >
              Mengerti
            </button>
          </div>
        </div>
      )}
    </>
  );
}
