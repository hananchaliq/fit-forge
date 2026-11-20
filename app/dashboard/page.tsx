'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import {
  MapPin,
  Dumbbell,
  Flame,
  Droplets,
  TrendingUp,
  Play,
  CheckCircle2,
  Clock,
  Plus,
  Utensils,
  ArrowUpRight,
  Trash2,
} from 'lucide-react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  PieChart,
  Pie,
  Cell,
} from 'recharts';
import { AppShell } from '@/components/layout/AppShell';
import { CountUpMetric, ProgressRing } from '@/components/ui/CountUpMetric';
import { useFitForgeStore } from '@/store/useFitForgeStore';
import { getExercisesForDay, GOLDEN_RULES, WEEKLY_PLAN } from '@/data/weeklyPlan';
import { MUSCLE_LABELS_ID } from '@/data/exerciseClipMap';
import {
  DEFAULT_PRAYER_SCHEDULE,
  fetchPrayerTimes,
  getNextPrayerCountdown,
  type PrayerSchedule,
} from '@/lib/prayer';

type ChartMetric = 'runKm' | 'caloriesBurned' | 'workoutVolumeKg';

export default function DashboardPage() {
  const router = useRouter();
  const {
    profile,
    planMode,
    selectedDayKey,
    setSelectedDayKey,
    setSelectedExerciseId,
    waterMl,
    addWaterMl,
    goldenRules,
    toggleGoldenRule,
    runSessions,
    deleteRunSession,
    workouts,
    deleteWorkoutRecord,
    nutritionLogs,
    deleteNutritionLog,
    weeklyPerformance,
  } = useFitForgeStore();

  const [chartMetric, setChartMetric] = useState<ChartMetric>('runKm');
  const [periodRange, setPeriodRange] = useState<'week' | 'month'>('week');
  const [prayerSchedule, setPrayerSchedule] = useState<PrayerSchedule>(DEFAULT_PRAYER_SCHEDULE);
  const [nowDate, setNowDate] = useState<Date | null>(null);

  useEffect(() => {
    fetchPrayerTimes(profile.lat, profile.lng, profile.prayerMethod, profile.city).then(
      setPrayerSchedule
    );
    const initTimer = window.setTimeout(() => setNowDate(new Date()), 0);
    const timer = window.setInterval(() => setNowDate(new Date()), 1000);
    return () => {
      window.clearTimeout(initTimer);
      window.clearInterval(timer);
    };
  }, [profile.lat, profile.lng, profile.prayerMethod, profile.city]);

  const nextPrayer = getNextPrayerCountdown(prayerSchedule, nowDate || new Date(0));

  // KPI calculations
  const totalRunKmWeek = weeklyPerformance.reduce((acc, item) => acc + item.runKm, 0);
  const totalVolumeWeek = weeklyPerformance.reduce((acc, item) => acc + item.workoutVolumeKg, 0);
  const totalCaloriesToday = nutritionLogs.reduce((acc, item) => acc + item.caloriesKcal, 0);
  const totalProteinToday = nutritionLogs.reduce((acc, item) => acc + item.proteinG, 0);
  const totalCarbsToday = nutritionLogs.reduce((acc, item) => acc + item.carbsG, 0);
  const totalFatToday = nutritionLogs.reduce((acc, item) => acc + item.fatG, 0);
  const totalFiberToday = nutritionLogs.reduce((acc, item) => acc + item.fiberG, 0);

  const completedRulesCount = Object.values(goldenRules).filter(Boolean).length;
  const recoveryScore = completedRulesCount * 20;

  const todayExercises = getExercisesForDay(selectedDayKey, planMode);
  const currentDayPlan = WEEKLY_PLAN.find((d) => d.key === selectedDayKey) || WEEKLY_PLAN[0];

  const macroData = [
    { name: 'Protein', grams: totalProteinToday, color: '#65C80B', pct: totalCaloriesToday > 0 ? Math.round((totalProteinToday * 4 / totalCaloriesToday) * 100) : 0 },
    { name: 'Karbohidrat', grams: totalCarbsToday, color: '#0D0F10', pct: totalCaloriesToday > 0 ? Math.round((totalCarbsToday * 4 / totalCaloriesToday) * 100) : 0 },
    { name: 'Lemak', grams: totalFatToday, color: '#3B82F6', pct: totalCaloriesToday > 0 ? Math.round((totalFatToday * 9 / totalCaloriesToday) * 100) : 0 },
    { name: 'Serat', grams: totalFiberToday, color: '#10B981', pct: totalCaloriesToday > 0 ? Math.min(100, Math.round((totalFiberToday * 2 / totalCaloriesToday) * 100)) : 0 },
  ];

  const metricLabelMap: Record<ChartMetric, { label: string; unit: string }> = {
    runKm: { label: 'Jarak Lari', unit: 'km' },
    caloriesBurned: { label: 'Kalori Terbakar', unit: 'kkal' },
    workoutVolumeKg: { label: 'Volume Latihan', unit: 'kg' },
  };

  return (
    <AppShell
      title={`Selamat Pagi, ${profile.displayName}`}
      subtitle={`Ringkasan Performa Mingguan · ${profile.city} · Target: ${profile.goal}`}
      ctaLabel="Mulai Latihan Hari Ini"
      ctaHref={`/workout?exercise=${todayExercises[0]?.id || 'pushup'}`}
    >
      {/* ROW 1 — 4 EDITORIAL-ATHLETIC KPI CARDS (Card 1 is Layered Obsidian Hero) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-6">
        {/* KPI 1: HERO OBSIDIAN CARD — Jarak Lari Mingguan */}
        <motion.div
          whileHover={{ y: -3 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          className="rounded-2xl bg-[#0D0F10] athletic-grain text-white p-5 border border-[#23282D] shadow-card flex flex-col justify-between min-w-0"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#1A1E22] border border-[#2C3238] flex items-center justify-center shrink-0">
              <MapPin className="w-4 h-4 text-[#84E818]" />
            </div>
            <span className="text-xs font-semibold text-[#84E818] font-telemetry truncate">
              {totalRunKmWeek > 0 ? `${runSessions.length} sesi aktif` : '0.0 km minggu ini'}
            </span>
          </div>

          <div className="my-3.5 min-w-0">
            <p className="text-xs font-medium text-neutral-400">Jarak Lari Mingguan</p>
            <div className="flex items-baseline justify-between gap-2 mt-1">
              <p className="text-[30px] sm:text-[34px] leading-none font-extrabold tracking-tight font-telemetry text-white">
                <CountUpMetric value={totalRunKmWeek} decimals={1} />{' '}
                <span className="text-sm font-sans font-semibold text-neutral-400">km</span>
              </p>
              <svg className="w-20 h-8 overflow-visible shrink-0" viewBox="0 0 80 28" aria-hidden="true">
                <path
                  d="M2 22 L15 18 L28 24 L42 12 L55 15 L68 5 L78 8"
                  fill="none"
                  stroke="#84E818"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2.5 border-t border-white/10 text-xs text-neutral-400">
            <span className="truncate">{runSessions.length} sesi tercatat</span>
            <Link
              href="/run"
              className="min-h-[44px] -my-2 px-1 flex items-center text-[#84E818] font-bold hover:underline shrink-0"
            >
              Lacak GPS →
            </Link>
          </div>
        </motion.div>

        {/* KPI 2: Latihan Selesai (Sesi + Volume) */}
        <motion.div
          whileHover={{ y: -3 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          className="surface-card surface-card-interactive p-5 flex flex-col justify-between min-w-0"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#ECFCD8] dark:bg-[#1B1F23] flex items-center justify-center shrink-0">
              <Dumbbell className="w-4 h-4 text-[#3D7A00] dark:text-[#84E818]" />
            </div>
            <span className="text-xs font-semibold text-[#3D7A00] dark:text-[#84E818] font-telemetry truncate">
              {totalVolumeWeek > 0 ? `${totalVolumeWeek.toLocaleString('id-ID')} kg` : '0 kg volume'}
            </span>
          </div>

          <div className="my-3.5 min-w-0">
            <p className="text-xs font-medium text-[#5A6068] dark:text-neutral-400">
              Latihan Selesai &amp; Volume
            </p>
            <div className="flex items-baseline justify-between gap-2 mt-1">
              <p className="text-[30px] sm:text-[34px] leading-none font-extrabold tracking-tight font-telemetry text-[#0D0F10] dark:text-white">
                <CountUpMetric value={workouts.length} />{' '}
                <span className="text-xs sm:text-sm font-sans font-semibold text-[#5A6068] dark:text-neutral-400">
                  sesi · {(totalVolumeWeek / 1000).toFixed(1)}t
                </span>
              </p>
              <svg className="w-16 h-8 overflow-visible shrink-0" viewBox="0 0 64 28" aria-hidden="true">
                <path
                  d="M2 20 L16 16 L30 18 L44 9 L62 4"
                  fill="none"
                  stroke="#65C80B"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                />
              </svg>
            </div>
          </div>

          <div className="flex items-center justify-between pt-2.5 border-t border-[#E6E8E4] dark:border-[#23282D] text-xs text-[#5A6068] dark:text-neutral-400">
            <span className="truncate font-telemetry">Beban: {totalVolumeWeek.toLocaleString('id-ID')} kg</span>
            <Link
              href="/workout"
              className="min-h-[44px] -my-2 px-1 flex items-center text-[#3D7A00] dark:text-[#84E818] font-bold hover:underline shrink-0"
            >
              Studio 3D →
            </Link>
          </div>
        </motion.div>

        {/* KPI 3: Kalori & Protein Hari Ini + ProgressRing */}
        <motion.div
          whileHover={{ y: -3 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          className="surface-card surface-card-interactive p-5 flex flex-col justify-between min-w-0"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#F3FCE6] dark:bg-[#1B1F23] flex items-center justify-center shrink-0">
              <Flame className="w-4 h-4 text-[#3D7A00] dark:text-[#84E818]" />
            </div>
            <span className="text-xs font-semibold text-[#3D7A00] dark:text-[#84E818] font-telemetry truncate">
              {Math.round((totalProteinToday / Math.max(1, profile.dailyProteinTargetG)) * 100)}% protein
            </span>
          </div>

          <div className="my-3 flex items-center justify-between gap-2 min-w-0">
            <div className="min-w-0">
              <p className="text-xs font-medium text-[#5A6068] dark:text-neutral-400">
                Protein &amp; Kalori
              </p>
              <p className="text-[28px] sm:text-[32px] leading-tight font-extrabold tracking-tight font-telemetry text-[#0D0F10] dark:text-white mt-0.5">
                <CountUpMetric value={totalProteinToday} suffix="g" />
              </p>
              <p className="text-xs font-telemetry text-[#5A6068] dark:text-neutral-400">
                {totalCaloriesToday} kkal hari ini
              </p>
            </div>
            <ProgressRing
              percent={(totalProteinToday / Math.max(1, profile.dailyProteinTargetG)) * 100}
              size={52}
              strokeWidth={5}
              color="#65C80B"
              label="Progres target protein harian"
            />
          </div>

          <div className="flex items-center justify-between pt-2.5 border-t border-[#E6E8E4] dark:border-[#23282D] text-xs text-[#5A6068] dark:text-neutral-400">
            <span className="truncate font-telemetry">Target: {profile.dailyProteinTargetG}g</span>
            <Link
              href="/nutrisi"
              className="min-h-[44px] -my-2 px-1 flex items-center text-[#3D7A00] dark:text-[#84E818] font-bold hover:underline shrink-0"
            >
              Scan AI →
            </Link>
          </div>
        </motion.div>

        {/* KPI 4: Hidrasi & Skor Pemulihan */}
        <motion.div
          whileHover={{ y: -3 }}
          transition={{ type: 'spring', stiffness: 400, damping: 28 }}
          className="surface-card surface-card-interactive p-5 flex flex-col justify-between min-w-0"
        >
          <div className="flex items-center justify-between gap-2">
            <div className="w-9 h-9 rounded-xl bg-[#E0F2FE] dark:bg-[#1B1F23] flex items-center justify-center shrink-0">
              <Droplets className="w-4 h-4 text-[#075985] dark:text-sky-400" />
            </div>
            <span className="text-xs font-semibold text-[#075985] dark:text-sky-400 font-telemetry truncate">
              Pemulihan {recoveryScore}%
            </span>
          </div>

          <div className="my-3 flex items-center justify-between gap-2 min-w-0">
            <div className="min-w-0">
              <p className="text-xs font-medium text-[#5A6068] dark:text-neutral-400">
                Hidrasi Harian
              </p>
              <p className="text-[28px] sm:text-[32px] leading-tight font-extrabold tracking-tight font-telemetry text-[#0D0F10] dark:text-white mt-0.5">
                <CountUpMetric value={waterMl / 1000} decimals={2} suffix="L" />
              </p>
              <p className="text-xs font-telemetry text-[#5A6068] dark:text-neutral-400">
                / {(profile.dailyWaterTargetMl / 1000).toFixed(1)}L target
              </p>
            </div>
            <motion.button
              type="button"
              whileTap={{ scale: 0.94 }}
              onClick={() => addWaterMl(250)}
              className="min-h-[42px] px-3.5 rounded-full bg-[#0D0F10] dark:bg-[#84E818] text-[#84E818] dark:text-[#0D0F10] text-xs font-extrabold hover:opacity-90 transition cursor-pointer shrink-0"
            >
              +250ml
            </motion.button>
          </div>

          <div className="flex items-center justify-between pt-2.5 border-t border-[#E6E8E4] dark:border-[#23282D] text-xs text-[#5A6068] dark:text-neutral-400">
            <span className="truncate font-telemetry">Tidur: {useFitForgeStore.getState().sleepHoursToday} jam</span>
            <Link
              href="/jadwal"
              className="min-h-[44px] -my-2 px-1 flex items-center text-[#3D7A00] dark:text-[#84E818] font-bold hover:underline shrink-0"
            >
              Jadwal →
            </Link>
          </div>
        </motion.div>
      </div>

      {/* ROW 2 — (65%) WEEKLY PERFORMANCE OVERVIEW + (35%) DONUT MAKRO */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-6">
        {/* 65% Area Spline Chart (8 cols on 12-col grid) */}
        <div className="lg:col-span-8 rounded-2xl bg-white dark:bg-[#161616] p-5 border border-[#EFEFEF] dark:border-[#262626] shadow-card">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <div className="flex items-center gap-2">
                <TrendingUp className="w-4 h-4 text-[#448500] dark:text-[#84E818]" />
                <h2 className="text-sm font-semibold text-[#0D0F10] dark:text-white">
                  Weekly Performance Overview
                </h2>
              </div>
              <p className="text-xs text-[#5A6068] dark:text-neutral-400 mt-0.5">
                Tren harian {metricLabelMap[chartMetric].label.toLowerCase()} dalam 7 hari terakhir
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1 p-1 rounded-xl bg-[#F5F7F4] dark:bg-[#0E1113] border border-[#E6E8E4] dark:border-[#23282D]">
                {(
                  [
                    { key: 'runKm', label: 'Jarak Lari' },
                    { key: 'caloriesBurned', label: 'Kalori Terbakar' },
                    { key: 'workoutVolumeKg', label: 'Volume Latihan' },
                  ] as const
                ).map((tab) => (
                  <button
                    key={tab.key}
                    type="button"
                    onClick={() => setChartMetric(tab.key)}
                    className={`relative px-2.5 py-1 rounded-lg text-xs font-semibold transition whitespace-nowrap cursor-pointer ${
                      chartMetric === tab.key
                        ? 'text-white dark:text-[#0D0F10]'
                        : 'text-[#5A6068] hover:text-[#0D0F10] dark:text-neutral-400 dark:hover:text-white'
                    }`}
                  >
                    {chartMetric === tab.key && (
                      <motion.span
                        layoutId="dashboard-chart-metric-pill"
                        className="absolute inset-0 rounded-lg bg-[#0D0F10] dark:bg-[#84E818] shadow-xs"
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      />
                    )}
                    <span className="relative z-10">{tab.label}</span>
                  </button>
                ))}
              </div>

              <select
                aria-label="Pilih rentang waktu grafik"
                value={periodRange}
                onChange={(e) => setPeriodRange(e.target.value as 'week' | 'month')}
                className="min-w-[118px] pl-3 pr-7 py-1.5 rounded-xl bg-[#F5F7F4] dark:bg-[#0E1113] border border-[#E6E8E4] dark:border-[#23282D] text-xs font-semibold text-[#0D0F10] dark:text-white cursor-pointer"
              >
                <option value="week">Minggu ini</option>
                <option value="month">Bulan ini</option>
              </select>
            </div>
          </div>

          <div className="h-64 w-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={weeklyPerformance} margin={{ top: 10, right: 12, left: -12, bottom: 0 }}>
                <defs>
                  <linearGradient id="fitforgeLimeGrad" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#84E818" stopOpacity={0.36} />
                    <stop offset="95%" stopColor="#84E818" stopOpacity={0.02} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#E5E7EB" opacity={0.35} />
                <XAxis
                  dataKey="day"
                  tick={{ fontSize: 12, fill: '#6B7280' }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 11, fill: '#6B7280' }}
                  axisLine={false}
                  tickLine={false}
                />
                <Tooltip
                  contentStyle={{
                    backgroundColor: '#0D0F10',
                    borderColor: '#23282D',
                    borderRadius: '12px',
                    color: '#FFFFFF',
                    fontSize: '12px',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.28)',
                  }}
                  formatter={(value: unknown) => [
                    `${Number(value).toLocaleString('id-ID')} ${metricLabelMap[chartMetric].unit}`,
                    metricLabelMap[chartMetric].label,
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey={chartMetric}
                  stroke="#65C80B"
                  strokeWidth={3}
                  fillOpacity={1}
                  fill="url(#fitforgeLimeGrad)"
                  activeDot={{ r: 6, fill: '#84E818', stroke: '#0D0F10', strokeWidth: 2 }}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* 35% Donut Makro (4 cols on 12-col grid) */}
        <div className="lg:col-span-4 rounded-2xl bg-white dark:bg-[#161616] p-5 border border-[#EFEFEF] dark:border-[#262626] shadow-card flex flex-col justify-between">
          <div>
            <h2 className="text-sm font-semibold text-[#111111] dark:text-white">
              Komposisi Makro Harian
            </h2>
            <p className="text-xs text-[#6B7280] dark:text-neutral-400 mt-0.5">
              Distribusi nutrisi dari {nutritionLogs.length} makanan hari ini
            </p>
          </div>

          <div className="flex items-center justify-between gap-4 my-4">
            <div className="relative w-40 h-40 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={macroData}
                    dataKey="grams"
                    nameKey="name"
                    innerRadius={48}
                    outerRadius={68}
                    paddingAngle={4}
                    stroke="none"
                  >
                    {macroData.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                </PieChart>
              </ResponsiveContainer>
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <span className="text-xl font-extrabold text-[#111111] dark:text-white tabular-nums">
                  {totalCaloriesToday}
                </span>
                <span className="text-[11px] text-[#6B7280] dark:text-neutral-400">
                  kkal masuk
                </span>
              </div>
            </div>

            {/* Right Legend with Percentages */}
            <div className="flex-1 space-y-2.5">
              {macroData.map((m) => (
                <div key={m.name} className="flex items-center justify-between text-xs">
                  <div className="flex items-center gap-2">
                    <span
                      className="w-2.5 h-2.5 rounded-sm shrink-0"
                      style={{ backgroundColor: m.color }}
                    />
                    <span className="font-medium text-[#111111] dark:text-neutral-200">
                      {m.name}
                    </span>
                  </div>
                  <span className="font-bold tabular-nums text-[#111111] dark:text-white">
                    {m.grams}g ({m.pct}%)
                  </span>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 border-t border-[#EFEFEF] dark:border-[#262626] flex items-center justify-between text-xs">
            <span className="text-[#6B7280] dark:text-neutral-400 tabular-nums">
              Sisa budget: {Math.max(0, profile.dailyCalorieTarget - totalCaloriesToday)} kkal
            </span>
            <Link
              href="/nutrisi"
              className="inline-flex items-center gap-1 font-semibold text-[#3D7A00] dark:text-[#84E818] hover:underline"
            >
              <span>Tambah Makanan</span>
              <ArrowUpRight className="w-3.5 h-3.5" />
            </Link>
          </div>
        </div>
      </div>

      {/* ROW 3 — 3 COLUMNS (Matches ref-1 table/card layout) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Column 1: Rencana Latihan Hari Ini */}
        <div className="rounded-2xl bg-white dark:bg-[#161616] p-5 border border-[#EFEFEF] dark:border-[#262626] shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-[#111111] dark:text-white">
                  Rencana Latihan Hari Ini
                </h2>
                <p className="text-xs text-[#6B7280] dark:text-neutral-400">
                  {currentDayPlan.dayNameId} · {currentDayPlan.titleEn} ({planMode === 'gym' ? 'Gym' : 'Rumah'})
                </p>
              </div>
              <select
                aria-label="Pilih hari latihan"
                value={selectedDayKey}
                onChange={(e) => setSelectedDayKey(e.target.value as typeof selectedDayKey)}
                className="px-2.5 py-1 rounded-lg bg-[#F8F9FA] dark:bg-[#0E0E0E] border border-[#EFEFEF] dark:border-[#262626] text-xs font-semibold"
              >
                {WEEKLY_PLAN.map((d) => (
                  <option key={d.key} value={d.key}>
                    {d.dayNameId}
                  </option>
                ))}
              </select>
            </div>

            <div className="divide-y divide-[#EFEFEF] dark:divide-[#262626]">
              {todayExercises.slice(0, 5).map((ex, idx) => (
                <div
                  key={ex.id}
                  className="py-2.5 flex items-center justify-between gap-3"
                >
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#111111] dark:text-white truncate">
                      {idx + 1}. {ex.name}
                    </p>
                    <p className="text-[11px] text-[#6B7280] dark:text-neutral-400 tabular-nums">
                      {ex.sets} set × {ex.reps} · {MUSCLE_LABELS_ID[ex.primaryMuscles[0]].split(' ')[0]}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      setSelectedExerciseId(ex.id);
                      router.push(`/workout?exercise=${ex.id}`);
                    }}
                    className="min-h-[38px] px-3 py-1.5 rounded-full bg-[#0D0F10] hover:bg-[#1B1F23] dark:bg-[#84E818] dark:hover:opacity-90 text-white dark:text-[#0D0F10] text-xs font-bold flex items-center gap-1 shrink-0 cursor-pointer transition"
                  >
                    <Play className="w-3 h-3 text-[#84E818] fill-[#84E818] dark:text-[#0D0F10] dark:fill-[#0D0F10]" />
                    <span>Mulai</span>
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 mt-2 border-t border-[#EFEFEF] dark:border-[#23282D] flex items-center justify-between text-xs">
            <Link href="/plan" className="text-[#5A6068] dark:text-neutral-400 hover:underline">
              Lihat Poster 7 Hari
            </Link>
            <Link href="/workout" className="font-semibold text-[#3D7A00] dark:text-[#84E818] hover:underline">
              Buka Studio 3D →
            </Link>
          </div>
        </div>

        {/* Column 2: Aktivitas & Makanan Terbaru */}
        <div className="rounded-2xl bg-white dark:bg-[#131618] p-5 border border-[#E6E8E4] dark:border-[#23282D] shadow-card flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-3">
              <div>
                <h2 className="text-sm font-semibold text-[#0D0F10] dark:text-white">
                  Aktivitas &amp; Makanan Terbaru
                </h2>
                <p className="text-xs text-[#5A6068] dark:text-neutral-400">
                  Log terintegrasi lari, beban, dan kuliner harian
                </p>
              </div>
              <Utensils className="w-4 h-4 text-[#448500] dark:text-[#84E818]" />
            </div>

            <div className="divide-y divide-[#EFEFEF] dark:divide-[#23282D]">
              {runSessions.length === 0 && workouts.length === 0 && nutritionLogs.length === 0 && (
                <div className="py-6 px-3 text-center rounded-xl bg-[#F7F8F6] dark:bg-[#0E1113] border border-dashed border-[#DFE2DC] dark:border-[#262B30] my-1">
                  <p className="text-xs font-semibold text-[#0D0F10] dark:text-white">
                    Hari ini masih bersih dari nol
                  </p>
                  <p className="text-[11px] text-[#5A6068] dark:text-neutral-400 mt-1 mb-3">
                    Rekam sesi lari GPS, latihan Studio 3D, atau pindai makanan pertama Anda.
                  </p>
                  <div className="flex flex-wrap items-center justify-center gap-2">
                    <Link
                      href="/run"
                      className="min-h-[36px] px-3.5 py-1.5 rounded-full bg-[#0D0F10] dark:bg-[#84E818] text-white dark:text-[#0D0F10] text-[11px] font-bold inline-flex items-center gap-1 hover:opacity-90 transition"
                    >
                      <MapPin className="w-3 h-3 text-[#84E818] dark:text-[#0D0F10]" />
                      <span>Mulai Lari</span>
                    </Link>
                    <Link
                      href="/nutrisi"
                      className="min-h-[36px] px-3.5 py-1.5 rounded-full bg-[#ECFCD8] dark:bg-[#84E818]/15 text-[#2D6200] dark:text-[#84E818] text-[11px] font-bold inline-flex items-center gap-1 hover:opacity-90 transition"
                    >
                      <Utensils className="w-3 h-3" />
                      <span>Pindai Nutrisi</span>
                    </Link>
                  </div>
                </div>
              )}

              {runSessions.slice(0, 3).map((run) => (
                <div key={run.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#111111] dark:text-white truncate">
                      {run.title}
                    </p>
                    <p className="text-[11px] text-[#6B7280] dark:text-neutral-400 tabular-nums">
                      {(run.distanceM / 1000).toFixed(2)} km · {run.caloriesKcal} kkal terbakar
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-semibold text-[#047857] dark:text-emerald-400">
                      Lari
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteRunSession(run.id)}
                      aria-label={`Hapus riwayat lari ${run.title}`}
                      title="Hapus sesi lari ini"
                      className="p-1 rounded-lg text-neutral-400 hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {workouts.slice(0, 2).map((wo) => (
                <div key={wo.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#111111] dark:text-white truncate">
                      {wo.title}
                    </p>
                    <p className="text-[11px] text-[#6B7280] dark:text-neutral-400 tabular-nums">
                      {wo.setsCompleted} set · {wo.totalVolumeKg.toLocaleString('id-ID')} kg volume
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-semibold text-[#3D7A00] dark:text-[#84E818]">
                      Studio 3D
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteWorkoutRecord(wo.id)}
                      aria-label={`Hapus riwayat latihan ${wo.title}`}
                      title="Hapus sesi latihan ini"
                      className="p-1 rounded-lg text-neutral-400 hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}

              {nutritionLogs.slice(0, 3).map((meal) => (
                <div key={meal.id} className="py-2.5 flex items-center justify-between gap-2">
                  <div className="min-w-0">
                    <p className="text-xs font-semibold text-[#0D0F10] dark:text-white truncate">
                      {meal.foodName}
                    </p>
                    <p className="text-[11px] text-[#5A6068] dark:text-neutral-400 tabular-nums">
                      {meal.caloriesKcal} kkal · {meal.proteinG}g protein · {meal.loggedAt}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-[11px] font-semibold text-[#0369A1] dark:text-sky-400">
                      Nutrisi
                    </span>
                    <button
                      type="button"
                      onClick={() => deleteNutritionLog(meal.id)}
                      aria-label={`Hapus makanan ${meal.foodName}`}
                      title="Hapus log makanan ini"
                      className="p-1 rounded-lg text-neutral-400 hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition cursor-pointer"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="pt-3 mt-2 border-t border-[#EFEFEF] dark:border-[#23282D] flex items-center justify-between text-xs">
            <Link href="/run" className="text-[#5A6068] dark:text-neutral-400 hover:underline">
              Riwayat Lari
            </Link>
            <Link href="/nutrisi" className="font-semibold text-[#3D7A00] dark:text-[#84E818] hover:underline">
              Log Nutrisi Lengkap →
            </Link>
          </div>
        </div>

        {/* Column 3: Waktu Sholat (Hitung Mundur) + Tombol +250ml + Checklist 5 Golden Rules */}
        <div className="rounded-2xl bg-white dark:bg-[#131618] p-5 border border-[#E6E8E4] dark:border-[#23282D] shadow-card flex flex-col justify-between">
          <div>
            {/* Prayer Countdown Banner */}
            <div className="rounded-xl bg-[#0D0F10] text-white p-3.5 border border-[#23282D] mb-4 flex items-center justify-between">
              <div>
                <div className="flex items-center gap-1.5 text-[11px] text-neutral-400">
                  <Clock className="w-3.5 h-3.5 text-[#84E818]" />
                  <span>Sholat Berikutnya · {prayerSchedule.city}</span>
                </div>
                <p className="text-sm font-bold text-white mt-0.5">
                  {nowDate ? `${nextPrayer.label} (${nextPrayer.timeStr} WIB)` : 'Memuat Jadwal...'}
                </p>
              </div>
              <div className="text-right">
                <span className="text-base font-extrabold text-[#84E818] font-telemetry block">
                  {nowDate ? `-${nextPrayer.formattedCountdown}` : '--:--:--'}
                </span>
                <Link href="/jadwal" className="text-[11px] text-neutral-400 hover:text-white underline">
                  Detail Jadwal
                </Link>
              </div>
            </div>

            {/* Quick Hydration +250ml Row */}
            <div className="flex items-center justify-between gap-2 mb-3 pb-3 border-b border-[#EFEFEF] dark:border-[#23282D]">
              <div className="min-w-0">
                <p className="text-xs font-semibold text-[#0D0F10] dark:text-white">
                  Hidrasi Cepat Harian
                </p>
                <p className="text-[11px] text-[#5A6068] dark:text-neutral-400 font-telemetry">
                  Tercatat: {waterMl} ml / {profile.dailyWaterTargetMl} ml
                </p>
              </div>
              <button
                type="button"
                onClick={() => addWaterMl(250)}
                className="inline-flex items-center gap-1 min-h-[40px] px-4 py-2 rounded-full bg-[#0D0F10] dark:bg-[#84E818] text-[#84E818] dark:text-[#0D0F10] text-xs font-bold hover:opacity-92 transition cursor-pointer shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>250ml</span>
              </button>
            </div>

            {/* 5 Golden Rules Checklist */}
            <div>
              <p className="text-xs font-semibold text-[#111111] dark:text-white mb-2">
                Checklist 5 Golden Rules Hari Ini
              </p>
              <div className="space-y-1.5">
                {GOLDEN_RULES.map((rule) => {
                  const checked = goldenRules[rule.key];
                  return (
                    <button
                      key={rule.key}
                      type="button"
                      onClick={() => toggleGoldenRule(rule.key)}
                      className="w-full min-h-[42px] flex items-center justify-between gap-2 px-3 py-2 rounded-xl bg-[#F8F9FA] dark:bg-[#0E0E0E] hover:bg-neutral-100 dark:hover:bg-[#1E1E1E] border border-[#EFEFEF] dark:border-[#262626] text-left transition cursor-pointer"
                    >
                      <div className="flex items-center gap-2.5 min-w-0">
                        <CheckCircle2
                          className={`w-4 h-4 shrink-0 ${
                            checked
                              ? 'text-emerald-600 dark:text-emerald-400'
                              : 'text-neutral-300 dark:text-neutral-600'
                          }`}
                        />
                        <span
                          className={`text-xs font-medium truncate ${
                            checked
                              ? 'text-[#111111] dark:text-white font-semibold'
                              : 'text-[#6B7280] dark:text-neutral-400'
                          }`}
                        >
                          {rule.title}
                        </span>
                      </div>
                      <span className="text-[11px] text-[#6B7280] dark:text-neutral-400 font-telemetry shrink-0">
                        {rule.target}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
