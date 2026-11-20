'use client';

import React, { useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'motion/react';
import { toPng } from 'html-to-image';
import {
  Download,
  Dumbbell,
  Home,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Play,
  Flame,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { BodyHighlighter2D } from '@/components/plan/BodyHighlighter2D';
import { MotionSegmentedControl, MOTION_SPRING } from '@/components/ui/MotionPrimitives';
import { useFitForgeStore } from '@/store/useFitForgeStore';
import {
  WEEKLY_PLAN,
  GOLDEN_RULES,
  getExercisesForDay,
  type DayKey,
} from '@/data/weeklyPlan';

export default function PlanPosterPage() {
  const router = useRouter();
  const posterRef = useRef<HTMLDivElement | null>(null);
  const {
    planMode,
    setPlanMode,
    setSelectedDayKey,
    setSelectedExerciseId,
    goldenRules,
    toggleGoldenRule,
    streakDays,
  } = useFitForgeStore();

  const [expandedDay, setExpandedDay] = useState<DayKey | 'all'>('all');
  const [exporting, setExporting] = useState(false);

  const handleExportPng = async () => {
    if (!posterRef.current || exporting) return;
    setExporting(true);
    try {
      const dataUrl = await toPng(posterRef.current, {
        quality: 0.95,
        pixelRatio: 2,
        backgroundColor: '#FFFFFF',
      });
      const link = document.createElement('a');
      link.download = `FitForge-Weekly-Workout-Plan-${planMode}.png`;
      link.href = dataUrl;
      link.click();
    } catch {
      // ignore export error
    } finally {
      setExporting(false);
    }
  };

  const handleExerciseClick = (dayKey: DayKey, exerciseId: string) => {
    setSelectedDayKey(dayKey);
    setSelectedExerciseId(exerciseId);
    router.push(`/workout?exercise=${exerciseId}`);
  };

  return (
    <AppShell
      title="Poster Rencana Latihan Mingguan"
      subtitle="Klik kartu latihan mana saja untuk membuka peragaan biomekanik di Studio 3D"
      ctaLabel="Buka Studio 3D"
      ctaHref="/workout"
    >
      {/* Top Toolbar: Mode Gym | Mode Rumah + Ekspor Poster PNG */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
        <MotionSegmentedControl
          layoutId="plan-poster-mode-pill"
          ariaLabel="Pilih mode rencana latihan"
          value={planMode}
          onChange={setPlanMode}
          className="p-1.5 rounded-2xl bg-white dark:bg-[#141418] shadow-xs"
          options={[
            { id: 'gym', label: 'Mode Gym', icon: <Dumbbell className="w-4 h-4 shrink-0" /> },
            { id: 'home', label: 'Mode Rumah', icon: <Home className="w-4 h-4 shrink-0" /> },
          ]}
        />

        <motion.button
          type="button"
          whileHover={{ y: -1 }}
          whileTap={{ scale: 0.96 }}
          transition={MOTION_SPRING}
          onClick={handleExportPng}
          disabled={exporting}
          className="min-h-[44px] inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-white dark:bg-[#141418] hover:bg-neutral-50 dark:hover:bg-[#1C1C22] border border-[#E6E6E2] dark:border-[#27272F] text-xs sm:text-sm font-semibold text-[#111114] dark:text-white shadow-xs transition cursor-pointer"
        >
          <Download className="w-4 h-4 text-[#3D7A00] dark:text-[#84E818] shrink-0" />
          <span>{exporting ? 'Mengekspor PNG...' : 'Ekspor Poster (PNG)'}</span>
        </motion.button>
      </div>

      {/* POSTER CONTAINER */}
      <div
        ref={posterRef}
        className="rounded-xl bg-white dark:bg-[#131618] border border-[#E6E8E4] dark:border-[#23272A] shadow-card p-4 sm:p-7 overflow-hidden"
      >
        {/* Poster Header */}
        <div className="text-center border-b-2 border-[#0D0F10] dark:border-[#23272A] pb-5 mb-6">
          <h2
            className="font-display font-black italic tracking-wider uppercase leading-none text-[#0D0F10] dark:text-white text-balance"
            style={{ fontSize: 'clamp(2rem, 6vw, 3.75rem)' }}
          >
            ULTIMATE{' '}
            <span className="text-[#6ED40E] dark:text-[#84E818]">
              WEEKLY WORKOUT
            </span>{' '}
            PLAN
          </h2>
          <p className="text-[11px] sm:text-sm font-extrabold tracking-[0.16em] sm:tracking-[0.22em] text-[#646A6E] dark:text-neutral-300 mt-2 break-words">
            BUILD MUSCLE · BURN FAT · STAY STRONG ({planMode === 'gym' ? 'GYM EDITION' : 'HOME CALISTHENICS'})
          </p>
        </div>

        {/* 7 DAY ROWS */}
        <div className="space-y-4">
          {WEEKLY_PLAN.map((day) => {
            const exercises = getExercisesForDay(day.key, planMode);
            const isExpanded = expandedDay === 'all' || expandedDay === day.key;

            return (
              <div
                key={day.key}
                className="rounded-lg border border-[#E6E8E4] dark:border-[#23272A] bg-[#F8F9FA] dark:bg-[#0E0E0E] overflow-hidden"
              >
                <div className="flex flex-col lg:flex-row lg:items-stretch">
                  {/* Left Colored Day Tab */}
                  <div
                    className="lg:w-48 shrink-0 p-4 text-white flex flex-row lg:flex-col justify-between items-center lg:items-start"
                    style={{ backgroundColor: day.colorHex }}
                  >
                    <div>
                      <span
                        className="text-2xl sm:text-3xl font-black tracking-wide block leading-none"
                        style={{ fontFamily: 'var(--font-poster), sans-serif' }}
                      >
                        {day.dayNameId}
                      </span>
                      <span className="text-xs sm:text-sm font-extrabold uppercase tracking-wider opacity-95 block mt-1">
                        {day.titleEn}
                      </span>
                      <span className="text-[11px] opacity-85 block mt-0.5">
                        {day.focusId}
                      </span>
                    </div>

                    <button
                      type="button"
                      onClick={() =>
                        setExpandedDay((prev) => (prev === day.key ? 'all' : day.key))
                      }
                      className="lg:hidden p-1.5 rounded-lg bg-black/20 text-white"
                      aria-label={`Tampilkan atau sembunyikan latihan hari ${day.dayNameId}`}
                    >
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4" />
                      ) : (
                        <ChevronDown className="w-4 h-4" />
                      )}
                    </button>

                    <div className="hidden lg:block mt-4 pt-2 border-t border-white/25 w-full text-[11px] font-semibold">
                      {exercises.length} Gerakan Terpilih
                    </div>
                  </div>

                  {/* Middle: 2D Anatomical Muscle Highlighter (Front & Back SVG tinted in day color) */}
                  {isExpanded && (
                    <div className="lg:w-44 shrink-0 px-3 py-3 bg-white dark:bg-[#161616] border-b lg:border-b-0 lg:border-r border-[#EFEFEF] dark:border-[#262626] flex items-center justify-center">
                      <BodyHighlighter2D
                        primaryMuscles={day.primaryMuscles}
                        secondaryMuscles={day.secondaryMuscles}
                        primaryColor={day.colorHex}
                        secondaryColor="#F59E0B"
                        compact
                      />
                    </div>
                  )}

                  {/* Right: Numbered Exercise Cards Grid */}
                  {isExpanded && (
                    <div className="flex-1 p-3.5 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-2.5">
                      {exercises.map((ex, idx) => (
                        <button
                          key={ex.id}
                          type="button"
                          onClick={() => handleExerciseClick(day.key, ex.id)}
                          className="group rounded-xl bg-white dark:bg-[#161616] hover:bg-neutral-50 dark:hover:bg-[#1E1E1E] border border-[#EFEFEF] dark:border-[#262626] p-3 text-left transition flex items-start justify-between gap-2.5 cursor-pointer shadow-2xs"
                        >
                          <div className="flex items-start gap-2.5 min-w-0">
                            <span
                              className="w-6 h-6 rounded-lg text-white text-xs font-extrabold flex items-center justify-center shrink-0 tabular-nums mt-0.5"
                              style={{ backgroundColor: day.colorHex }}
                            >
                              {idx + 1}
                            </span>
                            <div className="min-w-0">
                              <p className="text-xs sm:text-sm font-bold text-[#0D0F10] dark:text-white group-hover:text-[#3D7A00] dark:group-hover:text-[#84E818] transition truncate">
                                {ex.name}
                              </p>
                              <p className="text-[11px] font-semibold text-[#646A6E] dark:text-neutral-400 mt-1 tabular-nums">
                                {ex.sets} SETS · {ex.reps} REPS
                              </p>
                            </div>
                          </div>

                          <span className="p-1.5 rounded-lg bg-[#F7F8F6] dark:bg-[#1E2225] text-neutral-500 group-hover:text-[#3D7A00] dark:group-hover:text-[#84E818] transition shrink-0">
                            <Play className="w-3.5 h-3.5" />
                          </span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* FOOTER: GOLDEN RULES (5 Interactive Columns + Quote) */}
        <div className="mt-8 pt-6 border-t-2 border-[#0D0F10] dark:border-[#23272A]">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
            <h3
              className="text-2xl sm:text-3xl font-black tracking-wide uppercase text-[#0D0F10] dark:text-white"
              style={{ fontFamily: 'var(--font-poster), sans-serif' }}
            >
              5 GOLDEN RULES FOR MAXIMUM RESULTS
            </h3>
            <div className="flex items-center gap-1.5 text-xs font-bold text-[#3D7A00] dark:text-[#84E818] tabular-nums">
              <Flame className="w-4 h-4 fill-[#84E818] text-[#3D7A00] dark:text-[#84E818]" />
              <span>Streak Disiplin: {streakDays} Hari Beruntun</span>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {GOLDEN_RULES.map((rule) => {
              const checked = goldenRules[rule.key];
              return (
                <button
                  key={rule.key}
                  type="button"
                  onClick={() => toggleGoldenRule(rule.key)}
                  className={`p-3.5 rounded-2xl border text-left transition cursor-pointer ${
                    checked
                      ? 'bg-[#0D0F10] text-white border-[#0D0F10] dark:bg-[#1A1D20] dark:border-[#84E818]'
                      : 'bg-[#F7F8F6] dark:bg-[#0B0D0E] text-[#0D0F10] dark:text-white border-[#E6E8E4] dark:border-[#23272A]'
                  }`}
                >
                  <div className="flex items-center justify-between mb-1.5">
                    <span className={`text-xs font-extrabold tabular-nums ${checked ? 'text-[#84E818]' : 'text-[#3D7A00] dark:text-[#84E818]'}`}>
                      {rule.target}
                    </span>
                    <CheckCircle2
                      className={`w-4 h-4 ${
                        checked ? 'text-[#84E818]' : 'text-neutral-400'
                      }`}
                    />
                  </div>
                  <p className="text-xs font-bold">{rule.title}</p>
                  <p
                    className={`text-[11px] mt-1 leading-snug ${
                      checked ? 'text-neutral-300' : 'text-[#6B7280] dark:text-neutral-400'
                    }`}
                  >
                    {rule.desc}
                  </p>
                </button>
              );
            })}
          </div>

          <p className="text-center text-xs sm:text-sm font-extrabold tracking-widest uppercase text-[#111111] dark:text-neutral-300 mt-6">
            &ldquo;Stay Consistent, Stay Disciplined, See The Results.&rdquo;
          </p>
        </div>
      </div>
    </AppShell>
  );
}
