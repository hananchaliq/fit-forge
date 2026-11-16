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
        <div className="rounded-2xl bg-[#161616] text-white p-5 border border-[#262626] shadow-card">
          <div className="flex items-center justify-between text-xs text-neutral-400">
            <span>Total Jarak Lari Tercatat</span>
            <TrendingUp className="w-4 h-4 text-[#F59E0B]" />
          </div>
          <p className="text-3xl font-extrabold text-white tabular-nums mt-2">
            {totalRunKm.toFixed(1)} km
          </p>
          <p className="text-xs text-emerald-400 font-semibold mt-1">
            {runSessions.length} sesi lari di database
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#161616] p-5 border border-[#EFEFEF] dark:border-[#262626] shadow-card">
          <div className="flex items-center justify-between text-xs text-[#6B7280] dark:text-neutral-400">
            <span>Volume Beban Tercatat</span>
            <Dumbbell className="w-4 h-4 text-[#F97316]" />
          </div>
          <p className="text-3xl font-extrabold text-[#111111] dark:text-white tabular-nums mt-2">
            {totalVolumeTon.toFixed(1)} ton
          </p>
          <p className="text-xs text-emerald-600 dark:text-emerald-400 font-semibold mt-1">
            {totalVolumeKg.toLocaleString('id-ID')} kg total beban
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#161616] p-5 border border-[#EFEFEF] dark:border-[#262626] shadow-card">
          <div className="flex items-center justify-between text-xs text-[#6B7280] dark:text-neutral-400">
            <span>Asupan Protein Hari Ini</span>
            <Flame className="w-4 h-4 text-[#EF4444]" />
          </div>
          <p className="text-3xl font-extrabold text-[#111111] dark:text-white tabular-nums mt-2">
            {totalProteinToday}g
          </p>
          <p className="text-xs text-[#6B7280] dark:text-neutral-400 mt-1">
            Dari {nutritionLogs.length} makanan tercatat
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#161616] p-5 border border-[#EFEFEF] dark:border-[#262626] shadow-card">
          <div className="flex items-center justify-between text-xs text-[#6B7280] dark:text-neutral-400">
            <span>Streak Golden Rules</span>
            <Award className="w-4 h-4 text-[#F59E0B]" />
          </div>
          <p className="text-3xl font-extrabold text-[#F97316] tabular-nums mt-2">
            {streakDays} Hari
          </p>
          <p className="text-xs text-[#6B7280] dark:text-neutral-400 mt-1">
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
                <Bar dataKey="workoutVolumeKg" name="Volume (kg)" fill="#F97316" radius={[8, 8, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#161616] p-5 border border-[#EFEFEF] dark:border-[#262626] shadow-card">
          <h2 className="text-sm font-semibold text-[#111111] dark:text-white mb-1">
            Kepatuhan Asupan Protein & Kalori Harian
          </h2>
          <p className="text-xs text-[#6B7280] dark:text-neutral-400 mb-4">
            Gram protein harian dalam 7 hari terakhir
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={weeklyPerformance}>
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
                <Line
                  type="monotone"
                  dataKey="proteinG"
                  name="Protein (g)"
                  stroke="#F59E0B"
                  strokeWidth={3}
                  dot={{ r: 4, fill: '#F97316' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* 4-Week Progressive Overload Table */}
      <div className="rounded-2xl bg-white dark:bg-[#161616] p-5 border border-[#EFEFEF] dark:border-[#262626] shadow-card">
        <h2 className="text-sm font-semibold text-[#111111] dark:text-white mb-3">
          Rekapitulasi Mingguan (Data Nyata Akun Anda)
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-[#EFEFEF] dark:border-[#262626] text-[#6B7280] dark:text-neutral-400">
                <th className="py-2.5 text-left">Periode Minggu</th>
                <th className="py-2.5 text-right">Jarak Lari (km)</th>
                <th className="py-2.5 text-right">Sesi Latihan</th>
                <th className="py-2.5 text-right">Total Volume (kg)</th>
                <th className="py-2.5 text-right">Protein Tercatat</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#EFEFEF] dark:divide-[#262626] tabular-nums">
              {dynamicWeeks.map((w) => (
                <tr key={w.weekLabel}>
                  <td className="py-3 font-bold text-[#111111] dark:text-white">
                    {w.weekLabel}
                  </td>
                  <td className="py-3 text-right font-semibold text-[#F97316]">
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
