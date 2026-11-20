'use client';

import React from 'react';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  LineChart,
  Line,
} from 'recharts';
import { TrendingUp, Award, Flame, Dumbbell } from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { CountUpMetric } from '@/components/ui/CountUpMetric';
import { useFitForgeStore } from '@/store/useFitForgeStore';

export default function AnalitikPage() {
  const { weeklyPerformance, runSessions, workouts, nutritionLogs, streakDays } =
    useFitForgeStore();

  const totalRunKm = weeklyPerformance.reduce((a, b) => a + b.runKm, 0);
  const totalVolumeKg = weeklyPerformance.reduce((a, b) => a + b.workoutVolumeKg, 0);
  const totalVolumeTon = totalVolumeKg / 1000;
  const totalProteinToday = nutritionLogs.reduce((a, b) => a + b.proteinG, 0);

  const dynamicWeeks = [
    { weekLabel: 'Minggu 1', runKm: 0, workouts: 0, avgProtein: 0, volumeKg: 0 },
    { weekLabel: 'Minggu 2', runKm: 0, workouts: 0, avgProtein: 0, volumeKg: 0 },
    { weekLabel: 'Minggu 3', runKm: 0, workouts: 0, avgProtein: 0, volumeKg: 0 },
    {
      weekLabel: 'Minggu Ini (Aktif)',
      runKm: totalRunKm,
      workouts: workouts.length,
      avgProtein: totalProteinToday,
      volumeKg: totalVolumeKg,
    },
  ];

  return (
    <AppShell
      title="Analitik Performa Akun Cloud"
      subtitle="Evaluasi nyata dari sesi lari GPS, latihan Studio 3D, dan log nutrisi akun Anda (tanpa data dummy)"
      ctaLabel="Mulai Sesi Baru"
      ctaHref="/workout"
    >
      {/* 4 Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="rounded-2xl bg-[#0D0F10] text-white p-5 border border-[#23272A] shadow-card">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span>Total Jarak Lari Tercatat</span>
            <TrendingUp className="w-4 h-4 text-[#84E818]" />
          </div>
          <p className="text-3xl font-extrabold text-white font-telemetry mt-2">
            <CountUpMetric value={totalRunKm} decimals={1} suffix=" km" />
          </p>
          <p className="text-xs text-[#84E818] font-semibold mt-1">
            {runSessions.length} sesi lari di database
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#131618] p-5 border border-[#E6E8E4] dark:border-[#23272A] shadow-card">
          <div className="flex items-center justify-between text-xs text-[#646A6E] dark:text-neutral-400">
            <span>Volume Beban Tercatat</span>
            <Dumbbell className="w-4 h-4 text-[#3D7A00] dark:text-[#84E818]" />
          </div>
          <p className="text-3xl font-extrabold text-[#0D0F10] dark:text-white font-telemetry mt-2">
            <CountUpMetric value={totalVolumeTon} decimals={1} suffix=" ton" />
          </p>
          <p className="text-xs text-[#3D7A00] dark:text-[#84E818] font-semibold mt-1">
            {totalVolumeKg.toLocaleString('id-ID')} kg total beban
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#131618] p-5 border border-[#E6E8E4] dark:border-[#23272A] shadow-card">
          <div className="flex items-center justify-between text-xs text-[#646A6E] dark:text-neutral-400">
            <span>Asupan Protein Hari Ini</span>
            <Flame className="w-4 h-4 text-[#3D7A00] dark:text-[#84E818]" />
          </div>
          <p className="text-3xl font-extrabold text-[#0D0F10] dark:text-white font-telemetry mt-2">
            <CountUpMetric value={totalProteinToday} suffix="g" />
          </p>
          <p className="text-xs text-[#646A6E] dark:text-neutral-400 mt-1">
            Dari {nutritionLogs.length} makanan tercatat
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#131618] p-5 border border-[#E6E8E4] dark:border-[#23272A] shadow-card">
          <div className="flex items-center justify-between text-xs text-[#646A6E] dark:text-neutral-400">
            <span>Streak Golden Rules</span>
            <Award className="w-4 h-4 text-[#3D7A00] dark:text-[#84E818]" />
          </div>
          <p className="text-3xl font-extrabold text-[#3D7A00] dark:text-[#84E818] font-telemetry mt-2">
            <CountUpMetric value={streakDays} suffix=" Hari" />
          </p>
          <p className="text-xs text-[#646A6E] dark:text-neutral-400 mt-1">
            {runSessions.length} lari · {workouts.length} sesi 3D minggu ini
          </p>
        </div>
      </div>

      {/* Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 mb-6">
        <div className="rounded-2xl bg-white dark:bg-[#161616] p-5 border border-[#EFEFEF] dark:border-[#262626] shadow-card">
          <h2 className="text-sm font-semibold text-[#111111] dark:text-white mb-1">
            Volume Latihan vs Kalori Terbakar (7 Hari Terakhir)
          </h2>
          <p className="text-xs text-[#6B7280] dark:text-neutral-400 mb-4">
            Distribusi beban kerja otot per hari (kg)
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.35} />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#6B7280' }} />
                <YAxis tick={{ fontSize: 11, fill: '#6B7280' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#161616',
                    borderColor: '#262626',
                    borderRadius: '12px',
                    color: '#FFFFFF',
                    fontSize: '12px',
                  }}
                />
                <Bar dataKey="workoutVolumeKg" name="Volume (kg)" fill="#6ED40E" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#131618] p-5 border border-[#E6E8E4] dark:border-[#23272A] shadow-card">
          <h2 className="text-sm font-semibold text-[#0D0F10] dark:text-white mb-1">
            Kepatuhan Asupan Protein & Kalori Harian
          </h2>
          <p className="text-xs text-[#646A6E] dark:text-neutral-400 mb-4">
            Gram protein harian dalam 7 hari terakhir
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyPerformance}>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.35} />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: '#646A6E' }} />
                <YAxis tick={{ fontSize: 11, fill: '#646A6E' }} />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0D0F10',
                    borderColor: '#23272A',
                    borderRadius: '12px',
                    color: '#FFFFFF',
                    fontSize: '12px',
                  }}
                />
                <Line
                  type="monotone"
                  dataKey="proteinG"
                  name="Protein (g)"
                  stroke="#65C80B"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#84E818', stroke: '#0D0F10', strokeWidth: 1.5 }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 4-Week Progressive Overload Table */}
      <div className="rounded-2xl bg-white dark:bg-[#131618] p-5 border border-[#E6E8E4] dark:border-[#23272A] shadow-card">
        <h2 className="text-sm font-semibold text-[#0D0F10] dark:text-white mb-3">
          Rekapitulasi Mingguan (Data Nyata Akun Anda)
        </h2>
        <div className="overflow-x-auto -mx-2 px-2">
          <table className="w-full min-w-[460px] text-xs">
            <thead>
              <tr className="border-b border-[#E6E8E4] dark:border-[#23272A] text-[#646A6E] dark:text-neutral-400">
                <th className="py-2.5 text-left">Periode Minggu</th>
                <th className="py-2.5 text-right">Jarak Lari (km)</th>
                <th className="py-2.5 text-right">Sesi Latihan</th>
                <th className="py-2.5 text-right">Total Volume (kg)</th>
                <th className="py-2.5 text-right">Protein Tercatat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E6E8E4] dark:divide-[#23272A] tabular-nums">
              {dynamicWeeks.map((w) => (
                <tr key={w.weekLabel}>
                  <td className="py-3 font-bold text-[#0D0F10] dark:text-white">
                    {w.weekLabel}
                  </td>
                  <td className="py-3 text-right font-semibold text-[#3D7A00] dark:text-[#84E818]">
                    {w.runKm.toFixed(1)} km
                  </td>
                  <td className="py-3 text-right">{w.workouts} sesi</td>
                  <td className="py-3 text-right font-bold">
                    {w.volumeKg.toLocaleString('id-ID')} kg
                  </td>
                  <td className="py-3 text-right text-emerald-600 dark:text-emerald-400 font-semibold">
                    {w.avgProtein}g
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </AppShell>
  );
}
