'use client';

import React, { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import dynamic from 'next/dynamic';
import {
  Play,
  Pause,
  SkipForward,
  CheckCircle2,
  Volume2,
  Eye,
  ChevronDown,
  ChevronUp,
  Sparkles,
  AlertTriangle,
  Dumbbell,
  Timer,
  Trash2,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import { BodyHighlighter2D } from '@/components/plan/BodyHighlighter2D';
import { useFitForgeStore } from '@/store/useFitForgeStore';
import { EXERCISES } from '@/data/exercises';
import { WEEKLY_PLAN, getExercisesForDay } from '@/data/weeklyPlan';
import { MUSCLE_LABELS_ID } from '@/data/exerciseClipMap';
import { soundEngine } from '@/lib/audio';
import type { CameraPreset } from '@/components/workout3d/TrainerStudio3D';

const TrainerStudio3D = dynamic(
  () => import('@/components/workout3d/TrainerStudio3D').then((m) => m.TrainerStudio3D),
  {
    ssr: false,
    loading: () => (
      <div className="w-full h-[520px] rounded-2xl bg-[#0C0C0E] border border-[#262626] flex items-center justify-center text-xs text-neutral-400">
        Memuat Engine Biomekanik Studio 3D...
      </div>
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

  useEffect(() => {
    const queryEx = searchParams.get('exercise');
    if (queryEx && EXERCISES[queryEx]) {
      setSelectedExerciseId(queryEx);
    }
  }, [searchParams, setSelectedExerciseId]);

  const currentExercise = EXERCISES[selectedExerciseId] || EXERCISES.pushup;
  const dayExercises = getExercisesForDay(selectedDayKey, planMode);

  // 3D Viewport controls
  const [isPaused, setIsPaused] = useState(false);
  const [timeScale, setTimeScale] = useState(1.0);
  const [cameraPreset, setCameraPreset] = useState<CameraPreset>('front');
  const [dockCollapsed, setDockCollapsed] = useState(false);
  const [debugMuscleMask, setDebugMuscleMask] = useState(false);

  // Active Workout Session state
  const [currentSet, setCurrentSet] = useState(1);
  const [currentRepsDone, setCurrentRepsDone] = useState(0);
  const [restSecondsLeft, setRestSecondsLeft] = useState(0);
  const [sessionSetsCompleted, setSessionSetsCompleted] = useState(0);
  const [sessionTotalVolumeKg, setSessionTotalVolumeKg] = useState(0);
  const [sessionSavedBanner, setSessionSavedBanner] = useState(false);

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
      // Advance to next exercise in day plan
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

  return (
    <AppShell
      title={`Studio 3D: ${currentExercise.name}`}
      subtitle={`Sorotan Otot Real-Time · ${currentExercise.sets} Set × ${currentExercise.reps} Repetisi · Istirahat ${currentExercise.restSec} dtk`}
      ctaLabel="Simpan Sesi Latihan"
      onCtaClick={handleFinishSession}
    >
      {sessionSavedBanner && (
        <div className="mb-4 p-3.5 rounded-2xl bg-[#D1FAE5] text-[#047857] text-xs sm:text-sm font-bold flex items-center justify-between">
          <span>
            ✓ Sesi latihan berhasil disimpan ke riwayat dan menambahkan volume mingguan Anda!
          </span>
          <span>+{Math.max(1250, sessionTotalVolumeKg)} kg</span>
        </div>
      )}

      {/* Top Exercise Selector Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Pilih hari program latihan"
            value={selectedDayKey}
            onChange={(e) => {
              const nextDay = e.target.value as typeof selectedDayKey;
              setSelectedDayKey(nextDay);
              const list = getExercisesForDay(nextDay, planMode);
              if (list[0]) setSelectedExerciseId(list[0].id);
            }}
            className="px-3 py-2 rounded-xl bg-white dark:bg-[#161616] border border-[#EFEFEF] dark:border-[#262626] text-xs font-bold"
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
              setSelectedExerciseId(e.target.value);
              setCurrentSet(1);
            }}
            className="px-3 py-2 rounded-xl bg-white dark:bg-[#161616] border border-[#EFEFEF] dark:border-[#262626] text-xs font-bold"
          >
            {Object.values(EXERCISES).map((ex) => (
              <option key={ex.id} value={ex.id}>
                {ex.name} ({ex.sets}×{ex.reps})
              </option>
            ))}
          </select>

          <div className="inline-flex rounded-xl bg-white dark:bg-[#161616] border border-[#EFEFEF] dark:border-[#262626] p-0.5">
            <button
              type="button"
              onClick={() => setPlanMode('gym')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                planMode === 'gym' ? 'bg-[#161616] text-white dark:bg-[#F97316] dark:text-black' : 'text-neutral-500'
              }`}
            >
              Gym
            </button>
            <button
              type="button"
              onClick={() => setPlanMode('home')}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold cursor-pointer ${
                planMode === 'home' ? 'bg-[#161616] text-white dark:bg-[#F97316] dark:text-black' : 'text-neutral-500'
              }`}
            >
              Rumah
            </button>
          </div>
        </div>

        {currentExercise.isApproximateClip && (
          <span className="text-xs font-medium text-[#B45309] dark:text-[#F59E0B]">
            Mode Gerakan: Peragaan perkiraan biomekanik ({currentExercise.clip})
          </span>
        )}
      </div>

      {/* MAIN 3D VIEWPORT CONTAINER WITH UNOBSTRUCTED CENTER + COLLAPSIBLE BOTTOM DOCK */}
      <div className="relative w-full h-[540px] sm:h-[600px] rounded-3xl overflow-hidden shadow-card mb-6">
        <TrainerStudio3D
          clip={currentExercise.clip}
          biomechanicalVariant={currentExercise.biomechanicalVariant}
          primaryMuscles={currentExercise.primaryMuscles}
          secondaryMuscles={currentExercise.secondaryMuscles}
          timeScale={timeScale}
          isPaused={isPaused}
          cameraPreset={cameraPreset}
          debugMuscleMask={debugMuscleMask}
        />

        {/* Top-Left Minimal Spec Header */}
        <div className="absolute top-3 left-3 bg-[#161616]/90 border border-[#262626] rounded-xl px-3.5 py-2 text-white pointer-events-none">
          <p className="text-xs font-bold text-white">{currentExercise.name}</p>
          <p className="text-[11px] text-[#F59E0B] tabular-nums">
            Set {currentSet} dari {currentExercise.sets} · Target {currentExercise.reps} rep
          </p>
        </div>

        {/* Unified Collapsible Bottom Control Dock (Zero Side-Panel Clutter over 3D Canvas) */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 w-[94%] max-w-[900px] z-20">
          <div className="flex justify-center mb-1.5">
            <button
              type="button"
              onClick={() => setDockCollapsed((prev) => !prev)}
              className="px-3 py-1 rounded-full bg-[#161616] border border-[#333333] text-[11px] font-semibold text-neutral-200 hover:text-white flex items-center gap-1 cursor-pointer"
            >
              {dockCollapsed ? (
                <>
                  <ChevronUp className="w-3.5 h-3.5 text-[#F59E0B]" />
                  <span>Tampilkan Kontrol 3D</span>
                </>
              ) : (
                <>
                  <ChevronDown className="w-3.5 h-3.5 text-[#F59E0B]" />
                  <span>Sembunyikan Kontrol (Mode Zen)</span>
                </>
              )}
            </button>
          </div>

          {!dockCollapsed && (
            <div className="rounded-2xl bg-[#161616] border border-[#262626] p-3.5 text-white shadow-2xl flex flex-wrap items-center justify-between gap-3">
              {/* Playback & Set Actions */}
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setIsPaused((p) => !p)}
                  className="p-2.5 rounded-xl bg-[#262626] hover:bg-[#333333] text-white transition cursor-pointer"
                  aria-label={isPaused ? 'Putar animasi 3D' : 'Jeda animasi 3D'}
                >
                  {isPaused ? (
                    <Play className="w-4 h-4 text-[#F59E0B] fill-[#F59E0B]" />
                  ) : (
                    <Pause className="w-4 h-4 text-white" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleCompleteSet}
                  className="px-3.5 py-2 rounded-xl bg-gradient-to-r from-[#F97316] to-[#F59E0B] text-black text-xs font-extrabold hover:opacity-95 transition flex items-center gap-1.5 cursor-pointer"
                >
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Selesai Set {currentSet}</span>
                </button>

                <button
                  type="button"
                  onClick={handleSkipNextExercise}
                  className="p-2.5 rounded-xl bg-[#262626] hover:bg-[#333333] text-neutral-200 transition cursor-pointer"
                  aria-label="Lanjut ke gerakan berikutnya"
                  title="Gerakan Berikutnya"
                >
                  <SkipForward className="w-4 h-4" />
                </button>

                {restSecondsLeft > 0 && (
                  <div className="px-3 py-1.5 rounded-xl bg-[#EF4444]/20 border border-[#EF4444] text-xs font-bold text-[#EF4444] tabular-nums flex items-center gap-1.5">
                    <Timer className="w-3.5 h-3.5" />
                    <span>Istirahat: {restSecondsLeft}s</span>
                  </div>
                )}
              </div>

              {/* Camera Angle Presets (Depan / Samping / Belakang) */}
              <div className="flex items-center gap-1 bg-[#0E0E0E] p-1 rounded-xl border border-[#262626]">
                {(
                  [
                    { key: 'front', label: 'Depan' },
                    { key: 'side', label: 'Samping' },
                    { key: 'back', label: 'Belakang' },
                  ] as const
                ).map((cam) => (
                  <button
                    key={cam.key}
                    type="button"
                    onClick={() => setCameraPreset(cam.key)}
                    className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition cursor-pointer ${
                      cameraPreset === cam.key
                        ? 'bg-[#262626] text-[#F59E0B]'
                        : 'text-neutral-400 hover:text-white'
                    }`}
                  >
                    {cam.label}
                  </button>
                ))}
              </div>

              {/* Speed Slider (0.5x – 1.5x) & Voice Coach + Debug Mask */}
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2">
                  <label htmlFor="speed-slider" className="text-[11px] text-neutral-400 tabular-nums">
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

                <button
                  type="button"
                  onClick={() =>
                    soundEngine.speakIndonesian(
                      `${currentExercise.name}. ${currentExercise.formTips[0]}`
                    )
                  }
                  className="p-2 rounded-xl bg-[#262626] hover:bg-[#333333] text-neutral-200 cursor-pointer"
                  aria-label="Dengarkan panduan suara Bahasa Indonesia"
                  title="Panduan Suara (ID)"
                >
                  <Volume2 className="w-4 h-4 text-[#F59E0B]" />
                </button>

                <button
                  type="button"
                  onClick={() => setDebugMuscleMask((d) => !d)}
                  className={`p-2 rounded-xl border text-xs font-semibold cursor-pointer ${
                    debugMuscleMask
                      ? 'bg-[#F97316] text-black border-[#F97316]'
                      : 'bg-[#0E0E0E] text-neutral-400 border-[#262626]'
                  }`}
                  aria-label="Tampilkan warna wilayah mask otot"
                  title="Toggle Mask Region Otot"
                >
                  <Eye className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
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
            Merah menyala = Otot Primer · Amber = Otot Sekunder
          </p>

          <BodyHighlighter2D
            primaryMuscles={currentExercise.primaryMuscles}
            secondaryMuscles={currentExercise.secondaryMuscles}
            primaryColor="#EF4444"
            secondaryColor="#F59E0B"
          />

          <div className="mt-4 pt-3 border-t border-[#EFEFEF] dark:border-[#262626] space-y-2 text-xs">
            <div>
              <span className="font-bold text-[#EF4444]">Otot Primer: </span>
              <span className="text-[#111111] dark:text-neutral-200">
                {currentExercise.primaryMuscles.map((m) => MUSCLE_LABELS_ID[m]).join(', ')}
              </span>
            </div>
            {currentExercise.secondaryMuscles.length > 0 && (
              <div>
                <span className="font-bold text-[#F59E0B]">Otot Sekunder: </span>
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
            {/* 3 Form Tips */}
            <div className="rounded-2xl bg-white dark:bg-[#161616] p-5 border border-[#EFEFEF] dark:border-[#262626] shadow-card">
              <div className="flex items-center gap-2 mb-3">
                <Sparkles className="w-4 h-4 text-emerald-500" />
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

            {/* 2 Common Mistakes */}
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
    </AppShell>
  );
}

export default function WorkoutPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-[#0E0E0E] text-white flex items-center justify-center text-sm">
          Memuat Studio 3D...
        </div>
      }
    >
      <WorkoutStudioContent />
    </Suspense>
  );
}
