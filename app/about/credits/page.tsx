'use client';

import React from 'react';
import Link from 'next/link';
import { Award, Box, ShieldCheck, ArrowLeft } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';

const CREDITS_LIST = [
  {
    name: 'Adobe Mixamo',
    role: 'Standar Skeleton Rig & Klip Animasi Latihan 3D',
    license: 'Royalty-Free (Tanpa Redistribusi File Mentah)',
    notes:
      'Kompatibel dengan struktur tulang karakter di /public/models/trainer.glb dan manifest.json.',
  },
  {
    name: 'Quaternius Universal Animation Library',
    role: 'Animasi Dasar Lokomosi (Idle, Jogging & Transisi)',
    license: 'CC0 1.0 Universal (Public Domain)',
    notes:
      'Digunakan sebagai referensi gerakan dasar dan transisi karakter humanoid.',
  },
  {
    name: 'Three.js (WebGL PBR Engine)',
    role: 'Render Studio 3D, RoomEnvironment PMREM & Custom Shader onBeforeCompile',
    license: 'MIT License',
    notes:
      'Menyediakan pencahayaan ACESFilmicToneMapping, sorotan otot real-time, dan manekin biomekanik 12-bagian.',
  },
  {
    name: 'anatomi 2D & react-body-highlighter Pattern',
    role: 'Peta Otot SVG Anterior (Depan) & Posterior (Belakang)',
    license: 'MIT License',
    notes:
      'Digunakan pada Poster Rencana Latihan Mingguan (/plan) dan Panel Sinkronisasi Studio 3D (/workout).',
  },
  {
    name: 'Aladhan API (Metode Kemenag RI #20)',
    role: 'Perhitungan Waktu Sholat Harian & Kalender Hijriah',
    license: 'Public REST API',
    notes:
      'Menyediakan jadwal Subuh, Dzuhur, Ashar, Maghrib, dan Isya sesuai koordinat kota di Indonesia.',
  },
  {
    name: 'Google Gemini API (@google/genai)',
    role: 'Analisis Nutrisi & Masakan Nusantara (/api/analyze-food)',
    license: 'Apache 2.0 SDK',
    notes:
      'Menghitung estimasi kalori, protein, karbohidrat, lemak, serat, dan tips kesehatan kuliner Indonesia.',
  },
];

export default function CreditsPage() {
  return (
    <AppShell
      title="Kredit & Lisensi Aset 3D / Library"
      subtitle="Dokumentasi atribusi terbuka sesuai spesifikasi arsitektur FitForge Bagian 10.4"
      ctaLabel="Kembali ke Dashboard"
      ctaHref="/dashboard"
    >
      <div className="rounded-2xl bg-white dark:bg-[#131618] p-6 border border-[#E6E8E4] dark:border-[#23272A] shadow-card mb-6">
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-[#EEFCD8] dark:bg-[#19240E] flex items-center justify-center">
            <Award className="w-5 h-5 text-[#3D7A00] dark:text-[#84E818]" />
          </div>
          <div>
            <h2 className="text-base font-bold text-[#0D0F10] dark:text-white">
              Atribusi Pustaka Terbuka & Pipeline Aset 3D
            </h2>
            <p className="text-xs text-[#646A6E] dark:text-neutral-400">
              Seluruh komponen mematuhi lisensi masing-masing tanpa menggunakan aset copyleft yang membatasi distribusi.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {CREDITS_LIST.map((item) => (
            <div
              key={item.name}
              className="p-4 rounded-2xl bg-[#F7F8F6] dark:bg-[#0B0D0E] border border-[#E6E8E4] dark:border-[#23272A] space-y-1.5"
            >
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold text-[#0D0F10] dark:text-white flex items-center gap-2">
                  <Box className="w-4 h-4 text-[#3D7A00] dark:text-[#84E818]" />
                  <span>{item.name}</span>
                </h3>
                <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 flex items-center gap-1">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>{item.license}</span>
                </span>
              </div>
              <p className="text-xs font-semibold text-[#3D7A00] dark:text-[#84E818]">{item.role}</p>
              <p className="text-xs text-[#646A6E] dark:text-neutral-400 leading-relaxed">
                {item.notes}
              </p>
            </div>
          ))}
        </div>

        <div className="mt-6 pt-4 border-t border-[#EFEFEF] dark:border-[#262626] flex items-center justify-between text-xs">
          <Link
            href="/pengaturan"
            className="inline-flex items-center gap-1.5 font-semibold text-[#6B7280] hover:text-[#111111] dark:hover:text-white"
          >
            <ArrowLeft className="w-4 h-4" />
            <span>Kembali ke Pengaturan</span>
          </Link>
          <span className="text-neutral-400">FitForge v1.0 · Nov 2026</span>
        </div>
      </div>
    </AppShell>
  );
}
