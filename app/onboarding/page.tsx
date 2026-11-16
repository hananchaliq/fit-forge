'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { MapPin, CheckCircle2, ArrowRight } from 'lucide-react';
import { useFitForgeStore } from '@/store/useFitForgeStore';
import type { UserProfile } from '@/data/demoData';

const INDONESIAN_CITIES = [
  { name: 'Jakarta Selatan', lat: -6.2183, lng: 106.8025 },
  { name: 'Bandung', lat: -6.9175, lng: 107.6191 },
  { name: 'Surabaya', lat: -7.2575, lng: 112.7521 },
  { name: 'Yogyakarta', lat: -7.7956, lng: 110.3695 },
  { name: 'Medan', lat: 3.5952, lng: 98.6722 },
  { name: 'Makassar', lat: -5.1477, lng: 119.4327 },
  { name: 'Denpasar', lat: -8.6705, lng: 115.2126 },
];

export default function OnboardingPage() {
  const router = useRouter();
  const { profile, completeOnboarding } = useFitForgeStore();

  const [displayName, setDisplayName] = useState(profile.displayName);
  const [weightKg, setWeightKg] = useState(String(profile.weightKg));
  const [heightCm, setHeightCm] = useState(String(profile.heightCm));
  const [goal, setGoal] = useState<UserProfile['goal']>(profile.goal);
  const [wakeTime, setWakeTime] = useState(profile.wakeTime);
  const [sleepTime, setSleepTime] = useState(profile.sleepTime);
  const [city, setCity] = useState(profile.city);
  const [lat, setLat] = useState(profile.lat);
  const [lng, setLng] = useState(profile.lng);
  const [prayerMethod, setPrayerMethod] = useState(profile.prayerMethod);
  const [gpsStatus, setGpsStatus] = useState('');
  const [error, setError] = useState('');

  const handleDetectGps = () => {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setGpsStatus('GPS tidak tersedia, menggunakan koordinat kota pilihan.');
      return;
    }
    setGpsStatus('Mendeteksi koordinat GPS...');
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLat(Number(pos.coords.latitude.toFixed(4)));
        setLng(Number(pos.coords.longitude.toFixed(4)));
        setGpsStatus(`Koordinat terkunci (${pos.coords.latitude.toFixed(3)}, ${pos.coords.longitude.toFixed(3)})`);
      },
      () => {
        setGpsStatus('Izin lokasi ditolak, menggunakan preset kota.');
      },
      { timeout: 6000 }
    );
  };

  const handleCitySelect = (cityName: string) => {
    setCity(cityName);
    const found = INDONESIAN_CITIES.find((c) => c.name === cityName);
    if (found) {
      setLat(found.lat);
      setLng(found.lng);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const w = Number(weightKg);
    const h = Number(heightCm);
    if (!displayName.trim()) {
      setError('Nama lengkap wajib diisi.');
      return;
    }
    if (!Number.isFinite(w) || w < 30 || w > 250) {
      setError('Masukkan berat badan yang valid (30–250 kg).');
      return;
    }
    if (!Number.isFinite(h) || h < 120 || h > 230) {
      setError('Masukkan tinggi badan yang valid (120–230 cm).');
      return;
    }

    // Calculate daily targets based on weight & goal
    const proteinTarget = Math.round(w * 2.0); // 2.0g/kg Golden Rule
    const calorieTarget =
      goal === 'Membakar Lemak & Definisi'
        ? Math.round(w * 29)
        : goal === 'Membangun Otot & Rekomposisi'
          ? Math.round(w * 34)
          : Math.round(w * 36);

    completeOnboarding({
      displayName: displayName.trim(),
      weightKg: w,
      heightCm: h,
      goal,
      wakeTime,
      sleepTime,
      city,
      lat,
      lng,
      prayerMethod,
      dailyProteinTargetG: proteinTarget,
      dailyCalorieTarget: calorieTarget,
    });
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-[#0A0A0A] text-white py-10 px-4 flex items-center justify-center relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24 left-1/2 -translate-x-1/2 w-[680px] h-[400px] rounded-full opacity-20 blur-[120px]"
        style={{
          background: 'radial-gradient(circle, #FF2D1A 0%, #F97316 55%, transparent 75%)',
        }}
      />

      <div className="relative z-10 w-full max-w-2xl rounded-2xl bg-[#161616] border border-[#262626] p-6 sm:p-8 shadow-2xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <span className="text-xs font-bold text-[#F97316]">KALIBRASI PERSONAL FITFORGE</span>
            <h1 className="text-2xl font-bold text-white mt-0.5">
               Konfigurasi Tubuh, Target & Jadwal Ibadah
            </h1>
          </div>
          <Link href="/dashboard" className="text-xs text-neutral-400 hover:text-white">
            Lewati ke Dashboard →
          </Link>
        </div>

        {error && (
          <div className="mb-4 p-3 rounded-xl bg-[#FFE4E6] text-[#BE123C] text-xs font-semibold">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-5">
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div className="sm:col-span-1">
              <label htmlFor="onb-name" className="block text-xs font-medium text-neutral-300 mb-1.5">
                Nama Panggilan
              </label>
              <input
                id="onb-name"
                type="text"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0E0E0E] border border-[#262626] text-sm text-white"
              />
            </div>

            <div>
              <label htmlFor="onb-weight" className="block text-xs font-medium text-neutral-300 mb-1.5">
                Berat Badan (kg)
              </label>
              <input
                id="onb-weight"
                type="number"
                value={weightKg}
                onChange={(e) => setWeightKg(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0E0E0E] border border-[#262626] text-sm text-white tabular-nums"
              />
            </div>

            <div>
              <label htmlFor="onb-height" className="block text-xs font-medium text-neutral-300 mb-1.5">
                Tinggi Badan (cm)
              </label>
              <input
                id="onb-height"
                type="number"
                value={heightCm}
                onChange={(e) => setHeightCm(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0E0E0E] border border-[#262626] text-sm text-white tabular-nums"
              />
            </div>
          </div>

          {/* Goal Selection */}
          <div>
            <label className="block text-xs font-medium text-neutral-300 mb-2">
              Tujuan Utama Latihan
            </label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
              {(
                [
                  'Membangun Otot & Rekomposisi',
                  'Membakar Lemak & Definisi',
                  'Performa Lari & Daya Tahan',
                ] as const
              ).map((item) => (
                <button
                  key={item}
                  type="button"
                  onClick={() => setGoal(item)}
                  className={`p-3 rounded-xl border text-left text-xs font-semibold transition cursor-pointer ${
                    goal === item
                      ? 'bg-[#262626] border-[#F97316] text-white'
                      : 'bg-[#0E0E0E] border-[#262626] text-neutral-400 hover:text-white'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[#F59E0B]">Target</span>
                    {goal === item && <CheckCircle2 className="w-4 h-4 text-[#F97316]" />}
                  </div>
                  <p>{item}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Wake Time & Sleep Time */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="onb-wake" className="block text-xs font-medium text-neutral-300 mb-1.5">
                Jam Bangun Target (Alarm & Hidrasi Mulai)
              </label>
              <input
                id="onb-wake"
                type="time"
                value={wakeTime}
                onChange={(e) => setWakeTime(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0E0E0E] border border-[#262626] text-sm text-white tabular-nums"
              />
            </div>

            <div>
              <label htmlFor="onb-sleep" className="block text-xs font-medium text-neutral-300 mb-1.5">
                Jam Tidur Target (Golden Rule 7–9 Jam)
              </label>
              <input
                id="onb-sleep"
                type="time"
                value={sleepTime}
                onChange={(e) => setSleepTime(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl bg-[#0E0E0E] border border-[#262626] text-sm text-white tabular-nums"
              />
            </div>
          </div>

          {/* City & Prayer Calculation Method */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="onb-city" className="block text-xs font-medium text-neutral-300 mb-1.5">
                Kota & Koordinat Sholat
              </label>
              <div className="flex gap-2">
                <select
                  id="onb-city"
                  value={city}
                  onChange={(e) => handleCitySelect(e.target.value)}
                  className="flex-1 px-3 py-2.5 rounded-xl bg-[#0E0E0E] border border-[#262626] text-sm text-white"
                >
                  {INDONESIAN_CITIES.map((c) => (
                    <option key={c.name} value={c.name}>
                      {c.name}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleDetectGps}
                  className="px-3 py-2.5 rounded-xl bg-[#1E1E1E] hover:bg-[#262626] border border-[#333333] text-xs font-semibold text-[#F59E0B] flex items-center gap-1 shrink-0 cursor-pointer"
                >
                  <MapPin className="w-3.5 h-3.5" />
                  <span>GPS</span>
                </button>
              </div>
              {gpsStatus && <p className="text-[11px] text-neutral-400 mt-1">{gpsStatus}</p>}
            </div>

            <div>
              <label htmlFor="onb-method" className="block text-xs font-medium text-neutral-300 mb-1.5">
                Metode Hitung Waktu Sholat
              </label>
              <select
                id="onb-method"
                value={prayerMethod}
                onChange={(e) => setPrayerMethod(Number(e.target.value))}
                className="w-full px-3 py-2.5 rounded-xl bg-[#0E0E0E] border border-[#262626] text-sm text-white"
              >
                <option value={20}>Kemenag RI (Method 20 — Standar Indonesia)</option>
                <option value={3}>Muslim World League (MWL)</option>
                <option value={4}>Umm Al-Qura University, Makkah</option>
                <option value={11}>Majlis Ugama Islam Singapura (MUIS)</option>
              </select>
            </div>
          </div>

          <button
            type="submit"
            className="w-full py-3.5 rounded-xl bg-gradient-to-r from-[#EF4444] via-[#F97316] to-[#F59E0B] text-black font-bold text-sm hover:opacity-95 transition flex items-center justify-center gap-2 cursor-pointer"
          >
            <span>Simpan Profil & Buka FitForge</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
}
