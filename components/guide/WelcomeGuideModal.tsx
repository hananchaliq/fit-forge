'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  ChevronLeft,
  X,
  ShieldCheck,
  Box,
  MapPin,
  Utensils,
  Bell,
  UserCheck,
} from 'lucide-react';
import { useFitForgeStore } from '@/store/useFitForgeStore';

const GUIDE_STEPS = [
  {
    badge: 'Langkah 1 dari 5 · Akun & Database Cloud',
    title: 'Selamat Datang di FitForge Cloud (Tanpa Data Dummy)',
    icon: ShieldCheck,
    description:
      'Seluruh data akun Anda kini terhubung langsung ke Google Authentication dan database Cloud Firestore. Semua angka awal dimulai dari 0 (0 km lari, 0 sesi latihan, 0 kkal nutrisi, 0 ml air, 0 hari streak) agar Anda dapat menguji dan mencatat progres nyata Anda sendiri.',
    bullets: [
      'Login dengan akun Google Anda agar seluruh riwayat tersimpan permanen di akun Anda.',
      'Setiap perubahan (+250ml air, ceklis Golden Rules, simpan lari, simpan latihan 3D, log makanan) langsung tersinkronisasi ke database secara real-time.',
      'Anda dapat membuka kembali panduan ini kapan saja melalui tombol "Panduan" di bilah atas.',
    ],
    ctaLabel: 'Atur Profil & Target (Onboarding)',
    ctaHref: '/onboarding',
  },
  {
    badge: 'Langkah 2 dari 5 · Profil & Target Harian',
    title: 'Konfigurasi Berat Badan, Kota Sholat & Target Makro',
    icon: UserCheck,
    description:
      'Sesuaikan berat badan, tinggi badan, tujuan latihan, jam bangun/tidur, serta kota domisili Anda untuk perhitungan kalori lari (MET), kebutuhan protein (1.6–2.2 g/kg), dan jadwal sholat Kemenag RI.',
    bullets: [
      'Buka halaman Onboarding atau Pengaturan untuk memperbarui berat & tinggi badan Anda.',
      'Pilih kota Anda (atau gunakan deteksi GPS) agar hitung mundur Adzan akurat.',
      'Target kalori, protein, dan air putih harian akan menyesuaikan profil Anda secara otomatis.',
    ],
    ctaLabel: 'Buka Pengaturan Profil',
    ctaHref: '/pengaturan',
  },
  {
    badge: 'Langkah 3 dari 5 · Rencana 7 Hari & Studio 3D',
    title: 'Latihan Biomekanik 3D & Pencatatan Volume Beban',
    icon: Box,
    description:
      'Lihat program latihan mingguan (Senin–Minggu) dalam Mode Gym (Alat Lengkap) atau Mode Rumah (Tanpa Alat), lalu buka Studio 3D untuk melihat sorotan otot primer & sekunder secara real-time.',
    bullets: [
      'Di halaman Weekly Plan (/plan), klik kartu gerakan mana saja untuk membukanya di Studio 3D.',
      'Gunakan kontrol kamera (Depan / Samping / Belakang), pengatur tempo (0.5×–1.5×), dan tombol "Selesai Set".',
      'Klik tombol "Simpan Sesi Latihan" di kanan atas Studio 3D untuk menyimpan volume latihan ke database akun Anda.',
    ],
    ctaLabel: 'Buka Studio 3D Sekarang',
    ctaHref: '/workout',
  },
  {
    badge: 'Langkah 4 dari 5 · Lari GPS & Nutrisi AI',
    title: 'Rekam Rute Lari (Filter Kalman) & Analisis Kuliner Indonesia',
    icon: MapPin,
    description:
      'Lacak sesi lari Anda di luar ruangan menggunakan GPS perangkat atau uji di laptop dengan mode Simulasi Rute GBK, serta catat asupan kalori dan protein harian Anda.',
    bullets: [
      'Di halaman Run Tracker (/run), klik "Mulai Lari GPS" (atau "Simulasi Rute (Tes Desktop)"), lalu klik "Selesai & Simpan" agar jarak & kalori masuk ke Dashboard.',
      'Di halaman Nutrisi AI (/nutrisi), unggah foto makanan untuk dianalisis Gemini AI atau pilih preset kuliner lokal (Nasi Padang, Dada Ayam, Sate, Gado-Gado), lalu klik "Simpan ke Log Harian".',
      'Kalori yang terbakar dari sesi lari hari ini otomatis menambah batas anggaran kalori harian Anda.',
    ],
    ctaLabel: 'Coba Pelacak Lari GPS',
    ctaHref: '/run',
  },
  {
    badge: 'Langkah 5 dari 5 · Jadwal Sholat, Alarm & Golden Rules',
    title: 'Jaga Konsistensi Ibadah, Hidrasi & 5 Golden Rules',
    icon: Bell,
    description:
      'Pantau waktu sholat Kemenag RI, tambah asupan air putih +250ml sekali klik, uji Alarm Bangun Pagi (Mode A), dan lengkapi 5 Golden Rules setiap hari.',
    bullets: [
      'Klik tombol "+250ml" di Dashboard atau halaman Jadwal setiap kali Anda minum air putih.',
      'Ceklis 5 waktu sholat dan 5 Golden Rules untuk meningkatkan skor pemulihan dan streak harian Anda.',
      'Di halaman Jadwal (/jadwal), Anda dapat menguji "Alarm Bangun (Mode A)" dengan suara synth bertahap dan "Notifikasi Senyap (Mode B)".',
    ],
    ctaLabel: 'Buka Jadwal & Alarm',
    ctaHref: '/jadwal',
  },
];

export function WelcomeGuideModal() {
  const guideOpen = useFitForgeStore((s) => s.guideOpen);
  const dismissGuide = useFitForgeStore((s) => s.dismissGuide);
  const isAuthenticated = useFitForgeStore((s) => s.isAuthenticated);
  const profile = useFitForgeStore((s) => s.profile);

  const [stepIdx, setStepIdx] = useState(0);

  if (!guideOpen) return null;

  const currentStep = GUIDE_STEPS[stepIdx];
  const StepIcon = currentStep.icon;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="fitforge-guide-title"
    >
      <div className="w-full max-w-2xl rounded-3xl bg-[#141414] border border-[#262626] text-white shadow-2xl overflow-hidden">
        {/* Top Header */}
        <div className="px-6 py-4 bg-[#0E0E0E] border-b border-[#262626] flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-gradient-to-br from-[#F97316] to-[#F59E0B] text-black flex items-center justify-center font-black">
              <BookOpen className="w-4 h-4 stroke-[2.5]" />
            </div>
            <div>
              <span className="text-xs font-bold uppercase tracking-wider text-[#F59E0B] block">
                Panduan Pengguna FitForge
              </span>
              <span className="text-[11px] text-neutral-400">
                {isAuthenticated
                  ? `Terhubung sebagai ${profile.displayName} (${profile.email || 'Akun Google'})`
                  : 'Mode Pratinjau · Login dengan Google untuk menyimpan ke Cloud'}
              </span>
            </div>
          </div>

          <button
            type="button"
            onClick={dismissGuide}
            className="p-1.5 rounded-xl bg-[#1E1E1E] hover:bg-[#2A2A2A] text-neutral-400 hover:text-white transition cursor-pointer"
            aria-label="Tutup panduan"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Step Progress Dots */}
        <div className="px-6 pt-5 flex items-center gap-2">
          {GUIDE_STEPS.map((_, idx) => (
            <button
              key={idx}
              type="button"
              onClick={() => setStepIdx(idx)}
              className={`h-1.5 rounded-full transition-all cursor-pointer ${
                idx === stepIdx
                  ? 'w-10 bg-gradient-to-r from-[#EF4444] via-[#F97316] to-[#F59E0B]'
                  : idx < stepIdx
                  ? 'w-5 bg-[#F59E0B]/50'
                  : 'w-5 bg-[#262626]'
              }`}
              aria-label={`Langkah panduan ${idx + 1}`}
            />
          ))}
        </div>

        {/* Step Body */}
        <div className="p-6">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-lg bg-[#1F1F1F] border border-[#2E2E2E] text-[#F59E0B] text-xs font-semibold mb-3">
            <StepIcon className="w-3.5 h-3.5" />
            <span>{currentStep.badge}</span>
          </div>

          <h2 id="fitforge-guide-title" className="text-xl sm:text-2xl font-extrabold text-white mb-2">
            {currentStep.title}
          </h2>
          <p className="text-xs sm:text-sm text-neutral-300 leading-relaxed mb-5">
            {currentStep.description}
          </p>

          <div className="rounded-2xl bg-[#0E0E0E] border border-[#262626] p-4 space-y-2.5 mb-5">
            {currentStep.bullets.map((b, i) => (
              <div key={i} className="flex items-start gap-2.5 text-xs sm:text-sm text-neutral-200">
                <CheckCircle2 className="w-4 h-4 text-[#10B981] shrink-0 mt-0.5" />
                <span>{b}</span>
              </div>
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 pt-2 border-t border-[#262626]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={stepIdx === 0}
                onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
                className="inline-flex items-center gap-1 px-3.5 py-2 rounded-xl bg-[#1E1E1E] hover:bg-[#2A2A2A] disabled:opacity-40 text-xs font-semibold text-white transition cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>Sebelumnya</span>
              </button>

              {stepIdx < GUIDE_STEPS.length - 1 ? (
                <button
                  type="button"
                  onClick={() => setStepIdx((i) => Math.min(GUIDE_STEPS.length - 1, i + 1))}
                  className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-[#262626] hover:bg-[#333333] text-xs font-bold text-white transition cursor-pointer"
                >
                  <span>Langkah Berikutnya</span>
                  <ChevronRight className="w-4 h-4" />
                </button>
              ) : null}
            </div>

            <div className="flex items-center gap-2.5">
              <Link
                href={currentStep.ctaHref}
                onClick={dismissGuide}
                className="px-3.5 py-2 rounded-xl border border-[#333333] hover:border-[#F97316] text-xs font-semibold text-neutral-200 hover:text-white transition"
              >
                {currentStep.ctaLabel} →
              </Link>

              <button
                type="button"
                onClick={dismissGuide}
                className="px-4 py-2 rounded-xl bg-gradient-to-r from-[#EF4444] via-[#F97316] to-[#F59E0B] text-black text-xs font-extrabold hover:opacity-95 transition cursor-pointer"
              >
                Mengerti & Mulai Gunakan
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
