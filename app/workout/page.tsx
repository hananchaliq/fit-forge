'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import { motion, AnimatePresence } from 'motion/react';
import Image from 'next/image';
import {
  Play,
  Pause,
  SkipForward,
  CheckCircle2,
  Volume2,
  Eye,
  AlertTriangle,
  Dumbbell,
  Timer,
  Trash2,
  FileCode2,
  Copy,
  Check,
  Download,
  Layers,
  Sliders,
  Grid2X2,
  Box,
  Bone,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { BodyHighlighter2D } from '@/components/plan/BodyHighlighter2D';
import { BiomechanicalLoader } from '@/components/ui/BiomechanicalLoader';
import { Canvas3DErrorBoundary } from '@/components/ui/Canvas3DErrorBoundary';
import { MOTION_SPRING } from '@/components/ui/MotionPrimitives';
import { useFitForgeStore } from '@/store/useFitForgeStore';
import { EXERCISES } from '@/data/exercises';
import { WEEKLY_PLAN, getExercisesForDay } from '@/data/weeklyPlan';
import { MUSCLE_LABELS_ID } from '@/data/exerciseClipMap';
import {
  AI_BUILD_PROMPT_MD,
  BLUEPRINT_EXERCISES,
  BLUEPRINT_IMAGE_URL,
  type BlueprintExerciseSpec,
} from '@/data/blueprintPack';
import { soundEngine } from '@/lib/audio';
import type {
  CameraPreset,
  MannequinDisplayMode,
} from '@/components/workout3d/TrainerStudio3D';

const TrainerStudio3D = dynamic(
  () => import('@/components/workout3d/TrainerStudio3D').then((m) => m.TrainerStudio3D),
  {
    ssr: false,
    loading: () => (
      <BiomechanicalLoader
        compact
        label="MEMUAT ENGINE MANUSIA 3D & IK RIG"
        sublabel="Menyiapkan 22-Bone Analytical IK & Highlight Otot Blueprint..."
      />
    ),
  }
);

function WorkoutStudioContent() {
  const searchParams = useSearchParams();
  const {
    planMode,
    setPlanMode,
    selectedDayKey,
    setSelectedDayKey,
    selectedExerciseId,
    setSelectedExerciseId,
    workouts,
    addWorkoutRecord,
    deleteWorkoutRecord,
  } = useFitForgeStore();

  // 3D Blueprint Pack & AI_BUILD_PROMPT.md Inspector state
  const [activeBlueprintId, setActiveBlueprintId] =
    useState<BlueprintExerciseSpec['id']>('01_push_up');
  const [blueprintViewTab, setBlueprintViewTab] = useState<'prompt' | 'specs' | 'diagram'>(
    'specs'
  );
  const [copiedPrompt, setCopiedPrompt] = useState(false);

  useEffect(() => {
    const queryEx = searchParams.get('exercise');
    if (queryEx && EXERCISES[queryEx]) {
      setSelectedExerciseId(queryEx);
      const matchingBp = BLUEPRINT_EXERCISES.find((b) => b.fitforgeExerciseId === queryEx);
      if (matchingBp) {
        queueMicrotask(() => setActiveBlueprintId(matchingBp.id));
      }
    }
  }, [searchParams, setSelectedExerciseId]);

  const currentExercise = EXERCISES[selectedExerciseId] || EXERCISES.pushup;
  const dayExercises = getExercisesForDay(selectedDayKey, planMode);

  // 3D Viewport controls
  const [isPaused, setIsPaused] = useState(false);
  const [timeScale, setTimeScale] = useState(1.0);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('side');
  const [displayMode, setDisplayMode] = useState<MannequinDisplayMode>('muscle');
  const [quadView, setQuadView] = useState(false);
  const [lockedFrame, setLockedFrame] = useState<number | null>(null);
  const [debugMuscleMask, setDebugMuscleMask] = useState(false);

  // Active Workout Session state
  const [currentSet, setCurrentSet] = useState(1);
  const [currentRepsDone, setCurrentRepsDone] = useState(0);
  const [restSecondsLeft, setRestSecondsLeft] = useState(0);
  const [sessionSetsCompleted, setSessionSetsCompleted] = useState(0);
  const [sessionTotalVolumeKg, setSessionTotalVolumeKg] = useState(0);
  const [sessionSavedBanner, setSessionSavedBanner] = useState(false);

  const activeBlueprint =
    BLUEPRINT_EXERCISES.find((b) => b.fitforgeExerciseId === currentExercise.id) ||
    BLUEPRINT_EXERCISES.find((b) => b.id === activeBlueprintId) ||
    BLUEPRINT_EXERCISES[0];

  const handleCopyPrompt = async (textToCopy: string) => {
    try {
      await navigator.clipboard.writeText(textToCopy);
      setCopiedPrompt(true);
      setTimeout(() => setCopiedPrompt(false), 2200);
    } catch {
      setCopiedPrompt(false);
    }
  };

  const handleDownloadPrompt = () => {
    const blob = new Blob([AI_BUILD_PROMPT_MD], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'AI_BUILD_PROMPT.md';
    a.click();
    URL.revokeObjectURL(url);
  };

  // Rest countdown timer
  useEffect(() => {
    if (restSecondsLeft <= 0) return;
    const interval = window.setInterval(() => {
      setRestSecondsLeft((prev) => {
        if (prev <= 1) {
          soundEngine.playChime('start');
          return 0;
        }
        if (prev <= 4) {
          soundEngine.playChime('rest_tick');
        }
        return prev - 1;
      });
    }, 1000);
    return () => window.clearInterval(interval);
  }, [restSecondsLeft]);

  const handleCompleteSet = () => {
    soundEngine.playChime('set_done');
    const numericReps = parseInt(currentExercise.reps, 10) || 12;
    const weight = currentExercise.defaultWeightKg || 25;
    const addedVol = numericReps * weight;

    setSessionSetsCompleted((s) => s + 1);
    setSessionTotalVolumeKg((v) => v + addedVol);
    setCurrentRepsDone((r) => r + numericReps);

    if (currentSet < currentExercise.sets) {
      setCurrentSet((s) => s + 1);
      setRestSecondsLeft(currentExercise.restSec);
    } else {
      const idx = dayExercises.findIndex((e) => e.id === currentExercise.id);
      const nextEx = dayExercises[(idx + 1) % dayExercises.length];
      if (nextEx) {
        setSelectedExerciseId(nextEx.id);
        setCurrentSet(1);
        soundEngine.speakIndonesian(`Berikutnya: ${nextEx.name}`);
      }
    }
  };

  const handleSkipNextExercise = () => {
    const idx = dayExercises.findIndex((e) => e.id === currentExercise.id);
    const nextEx = dayExercises[(idx + 1) % dayExercises.length];
    if (nextEx) {
      setSelectedExerciseId(nextEx.id);
      setCurrentSet(1);
      setRestSecondsLeft(0);
      soundEngine.speakIndonesian(`Berikutnya: ${nextEx.name}`);
    }
  };

  const handleFinishSession = () => {
    const dayObj = WEEKLY_PLAN.find((d) => d.key === selectedDayKey) || WEEKLY_PLAN[0];
    const finalVolume = Math.max(1250, sessionTotalVolumeKg);
    const finalSets = Math.max(4, sessionSetsCompleted);

    addWorkoutRecord({
      id: `wo-${Date.now()}`,
      dayKey: selectedDayKey,
      title: `${dayObj.dayNameId}: ${dayObj.titleEn}`,
      mode: planMode,
      startedAt: new Date(Date.now() - 35 * 60000).toISOString(),
      finishedAt: new Date().toISOString(),
      durationMin: 35,
      totalVolumeKg: finalVolume,
      totalReps: Math.max(48, currentRepsDone),
      setsCompleted: finalSets,
    });

    soundEngine.playChime('set_done');
    soundEngine.speakIndonesian('Latihan selesai! Volume latihan berhasil disimpan.');
    setSessionSavedBanner(true);
    setTimeout(() => setSessionSavedBanner(false), 3500);
  };

  const keyframeButtons = [
    { frame: null, shortLabel: 'Loop 30 FPS', sub: 'Animasi Mulus' },
    { frame: 0, shortLabel: '1. Start (F0)', sub: activeBlueprint.animation.keyframes[0]?.pose || 'start' },
    { frame: 15, shortLabel: 'Turun (F15)', sub: activeBlueprint.animation.keyframes[1]?.pose || 'descent' },
    { frame: 30, shortLabel: '2. Puncak (F30)', sub: activeBlueprint.animation.keyframes[2]?.pose || 'bottom' },
    { frame: 45, shortLabel: 'Dorong (F45)', sub: activeBlueprint.animation.keyframes[3]?.pose || 'ascent' },
    { frame: 60, shortLabel: '3. Kembali (F60)', sub: activeBlueprint.animation.keyframes[4]?.pose || 'return' },
  ];

  return (
    <AppShell
      title={`Studio 3D: ${currentExercise.name}`}
      subtitle={`Anatomical Human IK · ${currentExercise.sets} Set × ${currentExercise.reps} Repetisi · Istirahat ${currentExercise.restSec} dtk`}
      ctaLabel="Simpan Sesi Latihan"
      onCtaClick={handleFinishSession}
    >
      <AnimatePresence>
        {sessionSavedBanner && (
          <motion.div
            initial={{ opacity: 0, y: -12, scale: 0.98 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -10, scale: 0.98 }}
            transition={MOTION_SPRING}
            className="mb-4 p-3.5 rounded-2xl bg-[#D1FAE5] text-[#047857] text-xs sm:text-sm font-bold flex items-center justify-between shadow-sm"
          >
            <span>
              ✓ Sesi latihan berhasil disimpan ke riwayat dan menambahkan volume mingguan Anda!
            </span>
            <span className="font-telemetry">+{Math.max(1250, sessionTotalVolumeKg)} kg</span>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Top Exercise & Blueprint Selector Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-2.5 sm:gap-3 mb-3 sm:mb-4">
        <div className="grid grid-cols-2 sm:flex sm:flex-wrap items-center gap-2">
          <select
            aria-label="Pilih hari program latihan"
            value={selectedDayKey}
            onChange={(e) => {
              const nextDay = e.target.value as typeof selectedDayKey;
              setSelectedDayKey(nextDay);
              const list = getExercisesForDay(nextDay, planMode);
              if (list[0]) setSelectedExerciseId(list[0].id);
            }}
            className="min-h-[40px] sm:min-h-[44px] w-full sm:w-auto max-w-full px-2.5 sm:px-3.5 py-2 rounded-xl bg-white dark:bg-[#141418] border border-[#E6E6E2] dark:border-[#27272F] text-[11px] sm:text-xs font-bold text-[#111114] dark:text-white shadow-xs truncate"
          >
            {WEEKLY_PLAN.map((d) => (
              <option key={d.key} value={d.key}>
                {d.dayNameId} — {d.titleEn}
              </option>
            ))}
          </select>

          <select
            aria-label="Pilih gerakan latihan 3D"
            value={currentExercise.id}
            onChange={(e) => {
              const exId = e.target.value;
              setSelectedExerciseId(exId);
              setCurrentSet(1);
              const bp = BLUEPRINT_EXERCISES.find((b) => b.fitforgeExerciseId === exId);
              if (bp) setActiveBlueprintId(bp.id);
            }}
            className="min-h-[40px] sm:min-h-[44px] w-full sm:w-auto max-w-full px-2.5 sm:px-3.5 py-2 rounded-xl bg-white dark:bg-[#141418] border border-[#E6E6E2] dark:border-[#27272F] text-[11px] sm:text-xs font-bold text-[#111114] dark:text-white shadow-xs truncate"
          >
            {Object.values(EXERCISES).map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name} ({ex.sets}×{ex.reps})
              </option>
            ))}
          </select>

          <div className="col-span-2 sm:col-span-1 flex items-center gap-2 min-w-0">
            <div className="inline-flex rounded-xl bg-white dark:bg-[#141418] border border-[#E6E6E2] dark:border-[#27272F] p-1 shadow-xs shrink-0">
              {(
                [
                  { key: 'gym', label: 'Gym' },
                  { key: 'home', label: 'Rumah' },
                ] as const
              ).map((mode) => (
                <button
                  key={mode.key}
                  type="button"
                  onClick={() => setPlanMode(mode.key)}
                  className={`relative min-h-[34px] sm:min-h-[38px] px-3 sm:px-3.5 py-1 sm:py-1.5 rounded-lg text-xs font-bold cursor-pointer transition-colors ${
                    planMode === mode.key
                      ? 'text-white dark:text-black'
                      : 'text-neutral-500 hover:text-neutral-800 dark:hover:text-white'
                  }`}
                >
                  {planMode === mode.key && (
                    <motion.span
                      layoutId="workout-plan-mode-pill"
                      transition={MOTION_SPRING}
                      className="absolute inset-0 rounded-lg bg-[#141418] dark:bg-[#F97316] shadow-xs"
                    />
                  )}
                  <span className="relative z-10">{mode.label}</span>
                </button>
              ))}
            </div>

            {/* Mobile horizontal swipeable Blueprint trio */}
            <div className="lg:hidden flex items-center gap-1 overflow-x-auto no-scrollbar snap-x snap-mandatory bg-white dark:bg-[#141418] border border-[#E6E6E2] dark:border-[#27272F] p-1 rounded-xl shadow-xs min-w-0 flex-1">
              {BLUEPRINT_EXERCISES.map((bp) => {
                const isSelected = currentExercise.id === bp.fitforgeExerciseId;
                return (
                  <button
                    key={`mob-${bp.id}`}
                    type="button"
                    onClick={() => {
                      setSelectedExerciseId(bp.fitforgeExerciseId);
                      setActiveBlueprintId(bp.id);
                      setCurrentSet(1);
                      setCameraPreset(bp.id === '03_pull_up' ? 'front' : 'side');
                    }}
                    className={`snap-start shrink-0 min-h-[34px] px-2.5 py-1 rounded-lg text-[11px] font-extrabold transition-colors cursor-pointer ${
                      isSelected
                        ? 'bg-gradient-to-r from-[#F97316] to-[#F59E0B] text-black'
                        : 'text-[#111114] dark:text-neutral-300'
                    }`}
                  >
                    {bp.code}. {bp.exercise.replace('_', '-').toUpperCase()}
                  </button>
                );
              })}
            </div>
          </div>
        </div>

        {/* Desktop Blueprint 3D Core Trio Quick-Switch (01. PUSH-UP · 02. SQUAT · 03. PULL-UP) */}
        <div className="hidden lg:flex items-center gap-1.5 bg-white dark:bg-[#141418] border border-[#E6E6E2] dark:border-[#27272F] p-1.5 rounded-2xl shadow-xs">
          <span className="px-2 text-[11px] font-extrabold uppercase tracking-wider text-slate-500 dark:text-slate-400">
            Blueprint:
          </span>
          {BLUEPRINT_EXERCISES.map((bp) => {
            const isSelected = currentExercise.id === bp.fitforgeExerciseId;
            return (
              <motion.button
                key={bp.id}
                type="button"
                whileTap={{ scale: 0.96 }}
                onClick={() => {
                  setSelectedExerciseId(bp.fitforgeExerciseId);
                  setActiveBlueprintId(bp.id);
                  setCurrentSet(1);
                  setCameraPreset(bp.id === '03_pull_up' ? 'front' : 'side');
                }}
                className={`relative min-h-[40px] px-3 py-1.5 rounded-xl text-xs font-extrabold transition-colors cursor-pointer ${
                  isSelected
                    ? 'text-black'
                    : 'text-[#111114] dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-[#22222A]'
                }`}
              >
                {isSelected && (
                  <motion.span
                    layoutId="workout-blueprint-trio-pill"
                    transition={MOTION_SPRING}
                    className="absolute inset-0 rounded-xl bg-gradient-to-r from-[#F97316] to-[#F59E0B] shadow-xs"
                  />
                )}
                <span className="relative z-10">
                  {bp.code}. {bp.exercise.replace('_', '-').toUpperCase()}
                </span>
              </motion.button>
            );
          })}
        </div>
      </div>

      {/* =====================================================================
          UNIFIED STUDIO 3D VIEWPORT CARD (ZERO COLLISION / ZERO LAYOUT SHIFT)
         ===================================================================== */}
      <div className="w-full rounded-3xl bg-[#070B14] border border-[#1E293B] overflow-hidden shadow-2xl mb-6">
        {/* 1. Studio Top Bar */}
        <div className="px-3.5 sm:px-5 py-3 bg-[#0B1120] border-b border-[#1E293B] flex flex-wrap items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-baseline gap-x-2.5 gap-y-0.5">
              <h2 className="text-xs sm:text-sm font-extrabold text-white truncate">
                {currentExercise.name}
              </h2>
              <span className="text-[11px] font-semibold text-amber-400 font-telemetry">
                Set {currentSet}/{currentExercise.sets} · {currentExercise.reps} rep
              </span>
            </div>
            <div className="hidden sm:flex items-center gap-3 mt-1 text-[11px] text-slate-400">
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#E53935]" />
                Otot Aktif
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#DFC5A4]" />
                Mannequin PBR
              </span>
              <span className="inline-flex items-center gap-1.5">
                <span className="w-2 h-2 rounded-full bg-[#F4ECDA]" />
                Kerangka Tulang
              </span>
            </div>
          </div>

          {/* Right: 3D Anatomy Mode (Otot PBR / X-Ray / Mode Tulang) + View & Camera Controls */}
          <div className="flex flex-wrap items-center gap-2 max-w-full">
            {/* Mannequin Display Mode Switcher */}
            <div
              className="inline-flex rounded-xl bg-[#070B14] p-1 border border-[#1E293B] overflow-x-auto no-scrollbar max-w-full"
              role="group"
              aria-label="Mode tampilan anatomi 3D"
            >
              {(
                [
                  { key: 'muscle', label: 'Otot PBR' },
                  { key: 'xray', label: 'X-Ray' },
                  { key: 'skeleton', label: 'Mode Tulang' },
                ] as const
              ).map((m) => (
                <button
                  key={m.key}
                  type="button"
                  onClick={() => setDisplayMode(m.key)}
                  className={`relative min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer whitespace-nowrap ${
                    displayMode === m.key
                      ? 'text-black'
                      : 'text-slate-400 hover:text-white'
                  }`}
                >
                  {displayMode === m.key && (
                    <motion.span
                      layoutId="workout-displaymode-pill"
                      transition={MOTION_SPRING}
                      className="absolute inset-0 rounded-lg bg-gradient-to-r from-[#F97316] to-[#F59E0B]"
                    />
                  )}
                  {m.key === 'skeleton' && (
                    <Bone className="relative z-10 w-3.5 h-3.5 shrink-0" />
                  )}
                  <span className="relative z-10">{m.label}</span>
                </button>
              ))}
            </div>

            <div className="inline-flex rounded-xl bg-[#070B14] p-1 border border-[#1E293B]">
              <button
                type="button"
                onClick={() => setQuadView(false)}
                className={`relative min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  !quadView ? 'text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                {!quadView && (
                  <motion.span
                    layoutId="workout-viewmode-pill"
                    transition={MOTION_SPRING}
                    className="absolute inset-0 rounded-lg bg-sky-500"
                  />
                )}
                <Box className="relative z-10 w-3.5 h-3.5 shrink-0" />
                <span className="relative z-10">Studio</span>
              </button>
              <button
                type="button"
                onClick={() => setQuadView(true)}
                className={`relative min-h-[38px] px-2.5 sm:px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition-colors cursor-pointer ${
                  quadView ? 'text-slate-950' : 'text-slate-400 hover:text-white'
                }`}
              >
                {quadView && (
                  <motion.span
                    layoutId="workout-viewmode-pill"
                    transition={MOTION_SPRING}
                    className="absolute inset-0 rounded-lg bg-sky-500"
                  />
                )}
                <Grid2X2 className="relative z-10 w-3.5 h-3.5 shrink-0" />
                <span className="relative z-10">4-Sudut</span>
              </button>
            </div>

            {!quadView && (
              <div className="flex items-center gap-0.5 bg-[#070B14] p-1 rounded-xl border border-[#1E293B] overflow-x-auto no-scrollbar max-w-full">
                {(
                  [
                    { key: 'front', label: 'Depan' },
                    { key: 'side', label: 'Samping' },
                    { key: 'back', label: 'Belakang' },
                    { key: 'top', label: 'Atas' },
                  ] as const
                ).map((cam) => (
                  <button
                    key={cam.key}
                    type="button"
                    onClick={() => setCameraPreset(cam.key)}
                    className={`relative min-h-[38px] px-2.5 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer whitespace-nowrap ${
                      cameraPreset === cam.key
                        ? 'text-[#F59E0B]'
                        : 'text-slate-400 hover:text-white'
                    }`}
                  >
                    {cameraPreset === cam.key && (
                      <motion.span
                        layoutId="workout-cam-preset-pill"
                        className="absolute inset-0 rounded-lg bg-[#162033] border border-amber-500/30"
                        transition={{ type: 'spring', stiffness: 420, damping: 32 }}
                      />
                    )}
                    <span className="relative z-10">{cam.label}</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* 2. Center 3D Viewport (Error Boundary + Fixed Aspect Height = Zero CLS) */}
        <div className="relative w-full h-[360px] sm:h-[500px]">
          <Canvas3DErrorBoundary
            title="Studio 3D Dalam Mode Hemat Daya"
            description="Perangkat atau konteks WebGL terhenti sementara. Gunakan peta otot 2D dan panduan langkah di bawah."
            heightClass="h-full"
          >
            <TrainerStudio3D
              exerciseId={currentExercise.id}
              clip={currentExercise.clip}
              biomechanicalVariant={currentExercise.biomechanicalVariant}
              exerciseName={currentExercise.name}
              primaryMuscles={currentExercise.primaryMuscles}
              secondaryMuscles={currentExercise.secondaryMuscles}
              timeScale={timeScale}
              isPaused={isPaused}
              cameraPreset={cameraPreset}
              displayMode={displayMode}
              debugMuscleMask={debugMuscleMask}
              quadView={quadView}
              lockedFrame={lockedFrame}
            />
          </Canvas3DErrorBoundary>
        </div>

        {/* 3. Studio Bottom Control Dock */}
        <div className="bg-[#0B1120] border-t border-[#1E293B] p-3 sm:p-4 space-y-3">
          {/* Row A: 3D Pose Sequence Scrubber (Horizontal snap scroll on mobile, 6-col grid on sm+) */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-3 border-b border-[#1E293B]/80">
            <span className="text-xs font-bold text-amber-400 shrink-0">
              Urutan Pose 3D
            </span>
            <div className="flex sm:grid sm:grid-cols-6 gap-1.5 w-full sm:w-auto flex-1 max-w-[780px] overflow-x-auto sm:overflow-visible snap-x snap-mandatory pb-1 sm:pb-0">
              {keyframeButtons.map((btn) => {
                const isSelected = lockedFrame === btn.frame;
                return (
                  <button
                    key={String(btn.frame)}
                    type="button"
                    onClick={() => {
                      setLockedFrame(btn.frame);
                      if (btn.frame === null) setIsPaused(false);
                    }}
                    className={`min-w-[118px] sm:min-w-0 snap-start min-h-[44px] px-2.5 py-1.5 rounded-xl border text-left transition cursor-pointer shrink-0 sm:shrink ${
                      isSelected
                        ? 'bg-amber-500/20 border-amber-400 text-white'
                        : 'bg-[#070B14] border-[#1E293B] text-slate-400 hover:text-white hover:border-slate-700'
                    }`}
                  >
                    <p className="text-[11px] font-bold truncate">{btn.shortLabel}</p>
                    <p className="text-[9px] text-slate-400 font-mono truncate">{btn.sub}</p>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Row B: Playback, Set Completion, Tempo Slider & Voice Coach */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setLockedFrame(null);
                  setIsPaused((p) => !p);
                }}
                className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl bg-[#162033] hover:bg-[#1E293B] border border-slate-700/60 text-white transition cursor-pointer"
                aria-label={isPaused ? 'Putar animasi 3D' : 'Jeda animasi 3D'}
              >
                {isPaused || lockedFrame !== null ? (
                  <Play className="w-4 h-4 text-[#F59E0B] fill-[#F59E0B]" />
                ) : (
                  <Pause className="w-4 h-4 text-white" />
                )}
              </button>

              <button
                type="button"
                onClick={handleCompleteSet}
                className="min-h-[44px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#F97316] to-[#F59E0B] text-black text-xs font-extrabold hover:opacity-95 active:scale-[0.98] transition flex items-center gap-1.5 cursor-pointer shadow-md"
              >
                <CheckCircle2 className="w-4 h-4 shrink-0" />
                <span>Selesai Set {currentSet}</span>
              </button>

              <button
                type="button"
                onClick={handleSkipNextExercise}
                className="min-h-[44px] px-3.5 py-2.5 rounded-xl bg-[#162033] hover:bg-[#1E293B] border border-slate-700/60 text-slate-200 text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
                title="Gerakan Berikutnya"
              >
                <SkipForward className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">Gerakan Berikutnya</span>
              </button>

              {restSecondsLeft > 0 && (
                <div className="px-3 py-2 rounded-xl bg-[#EF4444]/20 border border-[#EF4444] text-xs font-bold text-[#EF4444] tabular-nums flex items-center gap-1.5">
                  <Timer className="w-3.5 h-3.5" />
                  <span>Istirahat: {restSecondsLeft}s</span>
                </div>
              )}
            </div>

            <div className="flex items-center gap-3 w-full sm:w-auto justify-between sm:justify-end">
              <div className="flex items-center gap-2 bg-[#070D19] px-3 py-1.5 rounded-xl border border-[#1E293B]">
                <label htmlFor="speed-slider" className="text-[11px] font-semibold text-slate-300 tabular-nums">
                  Tempo: {timeScale.toFixed(1)}×
                </label>
                <input
                  id="speed-slider"
                  type="range"
                  min="0.5"
                  max="1.5"
                  step="0.1"
                  value={timeScale}
                  onChange={(e) => setTimeScale(parseFloat(e.target.value))}
                  className="w-20 accent-[#F97316]"
                />
              </div>

              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={() =>
                    soundEngine.speakIndonesian(
                      `${currentExercise.name}. ${currentExercise.formTips[0]}`
                    )
                  }
                  className="p-2.5 rounded-xl bg-[#162033] hover:bg-[#1E293B] border border-slate-700/60 text-slate-200 cursor-pointer"
                  aria-label="Dengarkan panduan suara Bahasa Indonesia"
                  title="Panduan Suara (ID)"
                >
                  <Volume2 className="w-4 h-4 text-[#F59E0B]" />
                </button>

                <button
                  type="button"
                  onClick={() => setDebugMuscleMask((d) => !d)}
                  className={`p-2.5 rounded-xl border text-xs font-semibold cursor-pointer ${
                    debugMuscleMask
                      ? 'bg-[#F97316] text-black border-[#F97316]'
                      : 'bg-[#070D19] text-slate-400 border-[#1E293B] hover:text-white'
                  }`}
                  aria-label="Tampilkan warna wilayah mask otot"
                  title="Toggle Mask Region Otot"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* BELOW VIEWPORT: 2D MUSCLE MAP + FORM TIPS + COMMON MISTAKES */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Left 4 cols: 2D SVG Muscle Highlighter & Active Muscle Legend */}
        <div className="lg:col-span-4 rounded-2xl bg-white dark:bg-[#161616] p-5 border border-[#EFEFEF] dark:border-[#262626] shadow-card">
          <h2 className="text-sm font-semibold text-[#111111] dark:text-white mb-1">
            Peta Aktivasi Otot (2D & 3D Sinkron)
          </h2>
          <p className="text-xs text-[#6B7280] dark:text-neutral-400 mb-4">
            Merah menyala = Otot Primer · Coral = Otot Sekunder
          </p>

          <BodyHighlighter2D
            primaryMuscles={currentExercise.primaryMuscles}
            secondaryMuscles={currentExercise.secondaryMuscles}
            primaryColor="#DC2626"
            secondaryColor="#EA580C"
          />

          <div className="mt-4 pt-3 border-t border-[#EFEFEF] dark:border-[#262626] space-y-2 text-xs">
            <div>
              <span className="font-bold text-[#DC2626]">Otot Primer: </span>
              <span className="text-[#111111] dark:text-neutral-200">
                {currentExercise.primaryMuscles.map((m) => MUSCLE_LABELS_ID[m]).join(', ')}
              </span>
            </div>
            {currentExercise.secondaryMuscles.length > 0 && (
              <div>
                <span className="font-bold text-[#EA580C]">Otot Sekunder: </span>
                <span className="text-[#6B7280] dark:text-neutral-400">
                  {currentExercise.secondaryMuscles.map((m) => MUSCLE_LABELS_ID[m]).join(', ')}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* Right 8 cols: Form Tips (3) + Common Mistakes (2) + Day Exercise Queue */}
        <div className="lg:col-span-8 space-y-5">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
            <div className="rounded-2xl bg-white dark:bg-[#161616] p-5 border border-[#EFEFEF] dark:border-[#262626] shadow-card">
              <div className="flex items-center gap-2 mb-3">
                <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                <h3 className="text-sm font-semibold text-[#111111] dark:text-white">
                  3 Kunci Teknik Form yang Benar
                </h3>
              </div>
              <ol className="space-y-2.5 text-xs text-[#111111] dark:text-neutral-200 list-decimal list-inside leading-relaxed">
                {currentExercise.formTips.map((tip, i) => (
                  <li key={i}>{tip}</li>
                ))}
              </ol>
            </div>

            <div className="rounded-2xl bg-white dark:bg-[#161616] p-5 border border-[#EFEFEF] dark:border-[#262626] shadow-card">
              <div className="flex items-center gap-2 mb-3">
                <AlertTriangle className="w-4 h-4 text-[#EF4444]" />
                <h3 className="text-sm font-semibold text-[#111111] dark:text-white">
                  2 Kesalahan Umum yang Harus Dihindari
                </h3>
              </div>
              <ul className="space-y-2.5 text-xs text-[#6B7280] dark:text-neutral-300 leading-relaxed">
                {currentExercise.commonMistakes.map((mistake, i) => (
                  <li key={i} className="flex items-start gap-2">
                    <span className="text-[#EF4444] font-bold">✕</span>
                    <span>{mistake}</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Day Queue Bar */}
          <div className="rounded-2xl bg-white dark:bg-[#161616] p-5 border border-[#EFEFEF] dark:border-[#262626] shadow-card">
            <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-neutral-400 mb-3">
              Urutan Latihan Hari Ini ({planMode === 'gym' ? 'Mode Gym' : 'Mode Rumah'})
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
              {dayExercises.map((ex, idx) => {
                const active = ex.id === currentExercise.id;
                return (
                  <button
                    key={ex.id}
                    type="button"
                    onClick={() => {
                      setSelectedExerciseId(ex.id);
                      setCurrentSet(1);
                    }}
                    className={`p-3 rounded-xl border text-left transition flex items-center justify-between cursor-pointer ${
                      active
                        ? 'bg-[#161616] text-white border-[#F97316]'
                        : 'bg-[#F8F9FA] dark:bg-[#0E0E0E] text-[#111111] dark:text-white border-[#EFEFEF] dark:border-[#262626]'
                    }`}
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold truncate">
                        {idx + 1}. {ex.name}
                      </p>
                      <p className="text-[11px] opacity-75 tabular-nums">
                        {ex.sets} × {ex.reps}
                      </p>
                    </div>
                    <Dumbbell className={`w-4 h-4 shrink-0 ${active ? 'text-[#F59E0B]' : 'opacity-40'}`} />
                  </button>
                );
              })}
            </div>
          </div>

          {/* Saved Workout Sessions History with Delete Option */}
          <div className="rounded-2xl bg-white dark:bg-[#161616] p-5 border border-[#EFEFEF] dark:border-[#262626] shadow-card">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#6B7280] dark:text-neutral-400">
                Riwayat Sesi Latihan 3D Tersimpan ({workouts.length})
              </h3>
              {workouts.length > 0 && (
                <span className="text-[11px] text-[#6B7280] dark:text-neutral-400">
                  Klik ikon sampah untuk menghapus
                </span>
              )}
            </div>
            {workouts.length === 0 ? (
              <p className="text-xs text-[#6B7280] dark:text-neutral-400">
                Belum ada riwayat sesi latihan yang disimpan. Klik &ldquo;Simpan Sesi Latihan&rdquo; di pojok kanan atas setelah selesai berlatih.
              </p>
            ) : (
              <div className="space-y-2">
                {workouts.map((wo) => (
                  <div
                    key={wo.id}
                    className="p-3 rounded-xl bg-[#F8F9FA] dark:bg-[#0E0E0E] border border-[#EFEFEF] dark:border-[#262626] flex items-center justify-between gap-3"
                  >
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-[#111111] dark:text-white truncate">
                        {wo.title}
                      </p>
                      <p className="text-[11px] text-[#6B7280] dark:text-neutral-400 tabular-nums mt-0.5">
                        {wo.setsCompleted} set · {wo.totalReps} rep · Volume{' '}
                        {wo.totalVolumeKg.toLocaleString('id-ID')} kg
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => deleteWorkoutRecord(wo.id)}
                      aria-label={`Hapus sesi latihan ${wo.title}`}
                      title="Hapus riwayat latihan ini"
                      className="p-1.5 rounded-lg text-neutral-400 hover:text-[#EF4444] hover:bg-[#EF4444]/10 transition cursor-pointer shrink-0"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* 3D MODEL BLUEPRINT PACK & MASTER AI_BUILD_PROMPT.MD STUDIO */}
      <div className="mt-6 rounded-3xl bg-[#070D19] text-white border border-[#1E293B] p-5 sm:p-6 shadow-card">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-[#1E293B]">
          <div>
            <div className="inline-flex items-center gap-2 px-2.5 py-1 rounded-lg bg-[#F97316]/15 border border-[#F97316]/40 text-[#F59E0B] text-[11px] font-extrabold uppercase tracking-wider mb-2">
              <FileCode2 className="w-3.5 h-3.5" />
              <span>Fitness 3D Blueprint Pack · Master Prompt</span>
            </div>
            <h2 className="text-base sm:text-lg font-extrabold tracking-tight text-white">
              AI_BUILD_PROMPT.md & Spesifikasi Rigging 3D (Push-Up · Squat · Pull-Up)
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              Spesifikasi lengkap karakter manusia atletis 180 cm / 70 kg, 22 tulang wajib, 5 keyframe @ 30 FPS, dan highlight otot merah sesuai blueprint.
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => handleCopyPrompt(AI_BUILD_PROMPT_MD)}
              className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#F97316] to-[#F59E0B] text-black text-xs font-extrabold flex items-center gap-1.5 hover:opacity-95 transition cursor-pointer"
            >
              {copiedPrompt ? (
                <>
                  <Check className="w-4 h-4" />
                  <span>Tersalin ke Clipboard!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>Salin AI_BUILD_PROMPT.md</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={handleDownloadPrompt}
              className="px-3.5 py-2 rounded-xl bg-[#111A2E] hover:bg-[#1E293B] border border-[#2A3B5C] text-white text-xs font-bold flex items-center gap-1.5 transition cursor-pointer"
            >
              <Download className="w-4 h-4 text-[#F59E0B]" />
              <span>Unduh AI_BUILD_PROMPT.md</span>
            </button>
          </div>
        </div>

        {/* Navigation Tabs: Prompt vs JSON Keyframe Specs vs Reference Blueprint Image */}
        <div className="flex flex-wrap items-center justify-between gap-3 my-4">
          <div className="inline-flex rounded-xl bg-[#0B1324] border border-[#1E293B] p-1">
            {(
              [
                { id: 'specs', label: '5-Keyframe & Rigging JSON', icon: Sliders },
                { id: 'diagram', label: 'Blueprint Reference Sheet', icon: Layers },
                { id: 'prompt', label: 'Master AI_BUILD_PROMPT.md', icon: FileCode2 },
              ] as const
            ).map((tab) => {
              const Icon = tab.icon;
              const active = blueprintViewTab === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setBlueprintViewTab(tab.id)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold flex items-center gap-1.5 transition cursor-pointer ${
                    active ? 'bg-[#F97316] text-black' : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Icon className="w-3.5 h-3.5" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            {BLUEPRINT_EXERCISES.map((bp) => {
              const active = activeBlueprint.id === bp.id;
              return (
                <button
                  key={bp.id}
                  type="button"
                  onClick={() => {
                    setActiveBlueprintId(bp.id);
                    setSelectedExerciseId(bp.fitforgeExerciseId);
                    setCameraPreset(bp.id === '03_pull_up' ? 'front' : 'side');
                  }}
                  className={`px-3 py-1.5 rounded-xl text-xs font-bold border transition cursor-pointer ${
                    active
                      ? 'bg-[#162033] text-[#F59E0B] border-[#F59E0B]'
                      : 'bg-[#0B1324] text-slate-400 border-[#1E293B] hover:text-white'
                  }`}
                >
                  {bp.titleLabel}
                </button>
              );
            })}
          </div>
        </div>

        {/* Tab 1: 5-Keyframe Sequence & 22-Bone Rigging JSON Inspector */}
        {blueprintViewTab === 'specs' && (
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
            <div className="lg:col-span-7 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#F59E0B]">
                  Urutan Pose 3D ({activeBlueprint.animation.fps} FPS ·{' '}
                  {activeBlueprint.animation.duration_seconds}s Loop) — Klik untuk Pratinjau di 3D
                </h3>
                <a
                  href={activeBlueprint.jsonFileUrl}
                  download={`${activeBlueprint.id}.json`}
                  className="text-xs font-bold text-[#F97316] hover:underline"
                >
                  Unduh {activeBlueprint.id}.json
                </a>
              </div>

              <div className="space-y-2">
                {activeBlueprint.animation.keyframes.map((kf) => {
                  const isLocked = lockedFrame === kf.frame;
                  return (
                    <button
                      key={kf.frame}
                      type="button"
                      onClick={() => setLockedFrame(isLocked ? null : kf.frame)}
                      className={`w-full text-left p-3 rounded-xl border flex items-start gap-3 transition cursor-pointer ${
                        isLocked
                          ? 'bg-sky-500/15 border-sky-400'
                          : 'bg-[#0B1324] border-[#1E293B] hover:border-slate-600'
                      }`}
                    >
                      <span className="px-2.5 py-1 rounded-lg bg-[#F97316]/20 border border-[#F97316]/40 text-[#F59E0B] text-xs font-extrabold tabular-nums shrink-0">
                        Frame {kf.frame}
                      </span>
                      <div>
                        <p className="text-xs font-bold text-white font-mono">{kf.pose}</p>
                        <p className="text-xs text-slate-300 mt-0.5">{kf.description}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="lg:col-span-5 space-y-4">
              <div className="rounded-2xl bg-[#0B1324] border border-[#1E293B] p-4">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-[#F59E0B] mb-2">
                  Kontrol IK / FK ({activeBlueprint.rigging.controls.length} Kontrol)
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {activeBlueprint.rigging.controls.map((ctrl) => (
                    <span
                      key={ctrl}
                      className="px-2.5 py-1 rounded-lg bg-[#070D19] border border-[#2A3B5C] text-[11px] font-mono text-amber-300"
                    >
                      {ctrl}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-[#0B1324] border border-[#1E293B] p-4">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-slate-300 mb-2">
                  Hierarki Tulang Wajib ({activeBlueprint.rigging.required_bones.length} Bones)
                </h3>
                <div className="flex flex-wrap gap-1.5">
                  {activeBlueprint.rigging.required_bones.map((bone) => (
                    <span
                      key={bone}
                      className="px-2 py-0.5 rounded-md bg-[#070D19] border border-[#1E293B] text-[10px] font-mono text-slate-300"
                    >
                      {bone}
                    </span>
                  ))}
                </div>
              </div>

              <div className="rounded-2xl bg-[#0B1324] border border-[#1E293B] p-4">
                <h3 className="text-xs font-extrabold uppercase tracking-wider text-emerald-400 mb-2">
                  Form Checks ({activeBlueprint.titleLabel})
                </h3>
                <ul className="space-y-1.5 text-xs text-slate-200">
                  {activeBlueprint.form_checks.map((check, i) => (
                    <li key={i} className="flex items-center gap-2">
                      <CheckCircle2 className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
                      <span>{check}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </div>
          </div>
        )}

        {/* Tab 2: High-Resolution Blueprint Reference Sheet */}
        {blueprintViewTab === 'diagram' && (
          <div className="rounded-2xl bg-[#050912] border border-[#1E293B] p-3 sm:p-4">
            <div className="relative w-full aspect-[16/15] max-h-[680px] rounded-xl overflow-hidden bg-[#050912]">
              <Image
                src={BLUEPRINT_IMAGE_URL}
                alt="3D Model Blueprint Reference — 01 Push-Up, 02 Squat, 03 Pull-Up"
                fill
                className="object-contain"
                referrerPolicy="no-referrer"
              />
            </div>
          </div>
        )}

        {/* Tab 3: Master AI_BUILD_PROMPT.md Content */}
        {blueprintViewTab === 'prompt' && (
          <div className="rounded-2xl bg-[#050912] border border-[#1E293B] p-4 overflow-x-auto max-h-[460px] overflow-y-auto">
            <pre className="text-[11px] sm:text-xs font-mono text-slate-200 whitespace-pre-wrap leading-relaxed">
              {AI_BUILD_PROMPT_MD}
            </pre>
          </div>
        )}
      </div>
    </AppShell>
  );
}

export default function WorkoutPage() {
  return (
    <Suspense
      fallback={
        <BiomechanicalLoader
          label="MEMUAT STUDIO 3D HUMAN IK"
          sublabel="Menyiapkan Model Manusia Anatomis 180 cm & Peta Aktivasi Otot..."
        />
      }
    >
      <WorkoutStudioContent />
    </Suspense>
  );
}
