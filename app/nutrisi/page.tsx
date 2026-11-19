'use client';

import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Camera,
  Plus,
  Trash2,
  CheckCircle2,
  Utensils,
  ShieldAlert,
  ListChecks,
  WifiOff,
  RotateCcw,
  Cpu,
  ScanSearch,
} from 'lucide-react';
import { AppShell } from '@/components/layout/AppShell';
import {
  MotionCard,
  MotionProgressBar,
  MOTION_SPRING,
} from '@/components/ui/MotionPrimitives';
import { useFitForgeStore } from '@/store/useFitForgeStore';
import {
  INDONESIAN_HIGH_PROTEIN_SUGGESTIONS,
  type NutritionLogItem,
} from '@/data/demoData';

interface IngredientBreakdownItem {
  item: string;
  amount: string;
  calories_kcal: number;
  protein_g: number;
}

interface AnalyzedFoodResult {
  food_name: string;
  portion_estimate: string;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g?: number;
  sodium_mg?: number;
  health_score: number;
  honest_verdict?: string;
  ingredients_breakdown?: IngredientBreakdownItem[];
  local_indonesian_tips: string;
}

interface TokenUsageMeta {
  promptTokenCount: number;
  candidatesTokenCount: number;
  thoughtsTokenCount: number;
  totalTokenCount: number;
}

interface AnalysisMeta {
  model: string;
  usage: TokenUsageMeta;
  latencyMs: number;
  analyzedAt?: string;
}

interface AnalysisErrorDetail {
  error: string;
  errorCode: string;
  reason?: string;
  hint?: string;
  modelAttempted?: string;
  rawDetail?: string;
}

const SAMPLE_DISHES = [
  'Nasi Padang Rendang Sapi + Kuah Gulai & Perkedel',
  'Dada Ayam Bakar 200g + Nasi Merah 150g + Tempe Rebus',
  'Indomie Goreng 2 Bungkus + Telur Ceplok + Kerupuk',
  'Seblak Kerupuk Ceker Pedas + Bakso Sosis Semangkuk',
];

export default function NutrisiAiPage() {
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const {
    profile,
    nutritionLogs,
    addNutritionLog,
    deleteNutritionLog,
    runSessions,
  } = useFitForgeStore();

  const [foodHint, setFoodHint] = useState('');
  const [mealType, setMealType] = useState<NutritionLogItem['mealType']>('lunch');
  const [previewDataUrl, setPreviewDataUrl] = useState<string | null>(null);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [errorDetail, setErrorDetail] = useState<AnalysisErrorDetail | null>(null);
  const [analysisResult, setAnalysisResult] = useState<AnalyzedFoodResult | null>(null);
  const [analysisMeta, setAnalysisMeta] = useState<AnalysisMeta | null>(null);
  const [addedToast, setAddedToast] = useState(false);

  // Totals & Dynamic Calorie Budget (+ today's real logged running calories, 0 if none)
  const totalCaloriesIn = nutritionLogs.reduce((acc, m) => acc + m.caloriesKcal, 0);
  const totalProteinG = nutritionLogs.reduce((acc, m) => acc + m.proteinG, 0);
  const totalCarbsG = nutritionLogs.reduce((acc, m) => acc + m.carbsG, 0);
  const totalFatG = nutritionLogs.reduce((acc, m) => acc + m.fatG, 0);
  const totalFiberG = nutritionLogs.reduce((acc, m) => acc + m.fiberG, 0);

  const todayRunBurnKcal = runSessions[0]?.caloriesKcal || 0;
  const adjustedCalorieBudget = profile.dailyCalorieTarget + todayRunBurnKcal;
  const remainingCalories = adjustedCalorieBudget - totalCaloriesIn;
  const remainingProteinG = Math.max(0, profile.dailyProteinTargetG - totalProteinG);

  // Client-side image compression to <= 1024px JPEG
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setErrorDetail(null);

    const reader = new FileReader();
    reader.onload = () => {
      const img = new window.Image();
      img.onload = () => {
        const maxDim = 1024;
        let w = img.width;
        let h = img.height;
        if (w > maxDim || h > maxDim) {
          if (w > h) {
            h = Math.round((h * maxDim) / w);
            w = maxDim;
          } else {
            w = Math.round((w * maxDim) / h);
            h = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, w, h);
          const compressedDataUrl = canvas.toDataURL('image/jpeg', 0.82);
          setPreviewDataUrl(compressedDataUrl);
          runFoodAnalysis(compressedDataUrl, foodHint);
        }
      };
      img.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const runFoodAnalysis = async (imageBase64?: string, customHint?: string) => {
    const activeHint = (customHint ?? foodHint).trim();
    if (!imageBase64 && !activeHint) {
      setErrorDetail({
        error: 'Masukkan deskripsi makanan atau unggah foto makanan terlebih dahulu.',
        errorCode: 'EMPTY_INPUT',
        reason: 'Belum ada input makanan yang dapat dikirim ke Gemini AI.',
        hint: 'Ketik menu di kolom teks atau tekan tombol Ambil Foto / Unggah.',
      });
      return;
    }

    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      setErrorDetail({
        error: 'Perangkat sedang offline — koneksi ke Gemini AI tidak tersedia.',
        errorCode: 'BROWSER_OFFLINE',
        reason: 'Browser mendeteksi tidak ada sambungan internet aktif. Analisis gizi real-time dibatalkan agar tidak menampilkan estimasi palsu.',
        hint: 'Aktifkan Wi-Fi atau data seluler, lalu klik Coba Analisis Ulang.',
        modelAttempted: 'gemini-4-hydrogen',
      });
      return;
    }

    setIsAnalyzing(true);
    setErrorDetail(null);
    const clientStart = performance.now();

    try {
      const res = await fetch('/api/analyze-food', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageBase64: imageBase64 || undefined,
          mimeType: 'image/jpeg',
          foodHint: activeHint,
        }),
      });

      const data = await res.json().catch(() => null);
      if (!res.ok || !data?.result) {
        setAnalysisResult(null);
        setAnalysisMeta(null);
        setErrorDetail({
          error: data?.error || `Permintaan analisis gagal (HTTP ${res.status}).`,
          errorCode: data?.errorCode || `HTTP_${res.status}`,
          reason:
            data?.reason ||
            'Server tidak mengembalikan data nutrisi yang valid dari Gemini AI.',
          hint:
            data?.hint ||
            'Pastikan koneksi internet stabil dan konfigurasi GEMINI_API_KEY aktif.',
          modelAttempted: data?.modelAttempted || 'gemini-4-hydrogen',
          rawDetail: data?.rawDetail,
        });
        return;
      }

      setAnalysisResult(data.result);
      setAnalysisMeta({
        model: data.model || data.source || 'gemini-4-hydrogen',
        usage: {
          promptTokenCount: data.usage?.promptTokenCount ?? 0,
          candidatesTokenCount: data.usage?.candidatesTokenCount ?? 0,
          thoughtsTokenCount: data.usage?.thoughtsTokenCount ?? 0,
          totalTokenCount: data.usage?.totalTokenCount ?? 0,
        },
        latencyMs: data.latencyMs ?? Math.round(performance.now() - clientStart),
        analyzedAt: data.analyzedAt,
      });
    } catch (err) {
      setAnalysisResult(null);
      setAnalysisMeta(null);
      const msg = err instanceof Error ? err.message : String(err);
      setErrorDetail({
        error: 'Koneksi ke endpoint analisis /api/analyze-food terputus.',
        errorCode: 'FETCH_NETWORK_ERROR',
        reason:
          'Permintaan jaringan dari browser ke server gagal tersambung. Tidak ada data fallback yang digunakan.',
        hint: 'Periksa koneksi internet Anda atau pastikan server aplikasi sedang berjalan, lalu coba lagi.',
        modelAttempted: 'gemini-4-hydrogen',
        rawDetail: msg.slice(0, 180),
      });
    } finally {
      setIsAnalyzing(false);
    }
  };

  const handleAddResultToLog = () => {
    if (!analysisResult) return;
    const nowStr = new Date().toTimeString().slice(0, 5);
    addNutritionLog({
      id: `meal-${Date.now()}`,
      mealType,
      foodName: analysisResult.food_name,
      portionEstimate: analysisResult.portion_estimate,
      caloriesKcal: Math.round(analysisResult.calories_kcal),
      proteinG: Math.round(analysisResult.protein_g),
      carbsG: Math.round(analysisResult.carbs_g),
      fatG: Math.round(analysisResult.fat_g),
      fiberG: Math.round(analysisResult.fiber_g),
      healthScore: analysisResult.health_score,
      tips: analysisResult.local_indonesian_tips,
      loggedAt: nowStr,
    });
    setAddedToast(true);
    setTimeout(() => setAddedToast(false), 2500);
  };

  const mealTypeLabel: Record<NutritionLogItem['mealType'], string> = {
    breakfast: 'Sarapan',
    lunch: 'Makan Siang',
    dinner: 'Makan Malam',
    snack: 'Camilan',
  };

  return (
    <AppShell
      title="Nutrisi AI Kuliner Indonesia"
      subtitle="Analisis gizi real-time Gemini AI dengan rincian bahan, model aktif, dan pemakaian token aktual"
      ctaLabel="Foto / Unggah Makanan"
      onCtaClick={() => fileInputRef.current?.click()}
    >
      {/* Dynamic Calorie & Protein Budget Summary Strip (swipeable on small phones, 4-col grid on desktop) */}
      <div className="flex sm:grid sm:grid-cols-2 lg:grid-cols-4 gap-3.5 sm:gap-4 mb-6 overflow-x-auto sm:overflow-visible snap-x snap-mandatory pb-1 sm:pb-0 -mx-1 px-1 sm:mx-0 sm:px-0">
        <MotionCard className="min-w-[230px] sm:min-w-0 snap-start rounded-2xl bg-[#141418] text-white p-4 sm:p-5 border border-[#27272E] shadow-card">
          <p className="text-xs text-neutral-400">Sisa Budget Kalori (+Lari)</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-[#F59E0B] font-telemetry mt-1">
            {remainingCalories.toLocaleString('id-ID')}{' '}
            <span className="text-sm font-normal">kkal</span>
          </p>
          <p className="text-[11px] text-neutral-400 mt-2 font-telemetry">
            Target {profile.dailyCalorieTarget} + {todayRunBurnKcal} lari − {totalCaloriesIn} masuk
          </p>
        </MotionCard>

        <MotionCard className="min-w-[230px] sm:min-w-0 snap-start rounded-2xl bg-white dark:bg-[#141418] p-4 sm:p-5 border border-[#E5E5E0] dark:border-[#27272E] shadow-card">
          <p className="text-xs text-[#6B7280] dark:text-neutral-400">Total Protein Harian</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-[#111111] dark:text-white font-telemetry mt-1">
            {totalProteinG}g{' '}
            <span className="text-sm font-normal text-[#6B7280]">
              / {profile.dailyProteinTargetG}g
            </span>
          </p>
          <MotionProgressBar
            percent={(totalProteinG / Math.max(1, profile.dailyProteinTargetG)) * 100}
            className="h-1.5 mt-2.5"
            barClassName="bg-gradient-to-r from-[#10B981] to-[#34D399]"
          />
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1.5">
            {remainingProteinG > 0
              ? `Sisa protein: ${remainingProteinG}g lagi`
              : 'Target Golden Rule Protein Tercapai'}
          </p>
        </MotionCard>

        <MotionCard className="min-w-[200px] sm:min-w-0 snap-start rounded-2xl bg-white dark:bg-[#141418] p-4 sm:p-5 border border-[#E5E5E0] dark:border-[#27272E] shadow-card">
          <p className="text-xs text-[#6B7280] dark:text-neutral-400">Karbohidrat &amp; Serat</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-[#111111] dark:text-white font-telemetry mt-1">
            {totalCarbsG}g{' '}
            <span className="text-sm font-normal text-[#6B7280]">· {totalFiberG}g serat</span>
          </p>
          <p className="text-[11px] text-[#6B7280] dark:text-neutral-400 mt-2">
            Glikogen otot &amp; pencernaan
          </p>
        </MotionCard>

        <MotionCard className="min-w-[190px] sm:min-w-0 snap-start rounded-2xl bg-white dark:bg-[#141418] p-4 sm:p-5 border border-[#E5E5E0] dark:border-[#27272E] shadow-card">
          <p className="text-xs text-[#6B7280] dark:text-neutral-400">Lemak Harian</p>
          <p className="text-2xl sm:text-3xl font-extrabold text-[#111111] dark:text-white font-telemetry mt-1">
            {totalFatG}g
          </p>
          <p className="text-[11px] text-[#6B7280] dark:text-neutral-400 mt-2">
            Utamakan lemak sehat &amp; kurangi gorengan
          </p>
        </MotionCard>
      </div>

      {/* SCANNER + AI ANALYSIS RESULT */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 mb-6">
        {/* Left 6 Cols: Camera / Photo Upload + Live Gemini Query Input */}
        <div className="lg:col-span-6 rounded-2xl bg-white dark:bg-[#161616] p-4 sm:p-5 border border-[#EFEFEF] dark:border-[#262626] shadow-card space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-sm font-bold text-[#111111] dark:text-white">
                Pemindai &amp; Kalkulator Gizi Real-Time
              </h2>
              <p className="text-xs text-[#6B7280] dark:text-neutral-400 mt-0.5">
                Langsung via API Gemini tanpa estimasi fallback palsu
              </p>
            </div>
            <ScanSearch className="w-5 h-5 text-[#F97316] shrink-0" />
          </div>

          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            onChange={handleFileChange}
            className="hidden"
          />

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <select
              aria-label="Pilih waktu makan"
              value={mealType}
              onChange={(e) => setMealType(e.target.value as NutritionLogItem['mealType'])}
              className="min-h-[44px] px-3 py-2.5 rounded-xl bg-[#F7F7F5] dark:bg-[#0E0E11] border border-[#E6E6E2] dark:border-[#27272F] text-xs font-semibold"
            >
              <option value="breakfast">Sarapan</option>
              <option value="lunch">Makan Siang</option>
              <option value="dinner">Makan Malam</option>
              <option value="snack">Camilan</option>
            </select>

            <input
              type="text"
              value={foodHint}
              onChange={(e) => setFoodHint(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !isAnalyzing) {
                  runFoodAnalysis(previewDataUrl || undefined, foodHint);
                }
              }}
              placeholder="Ketik makanan (mis: Nasi Padang, Dada Ayam Bakar)..."
              className="sm:col-span-2 min-h-[44px] min-w-0 px-3.5 py-2.5 rounded-xl bg-[#F7F7F5] dark:bg-[#0E0E11] border border-[#E6E6E2] dark:border-[#27272F] text-xs"
            />
          </div>

          {previewDataUrl && (
            <div className="relative rounded-xl overflow-hidden border border-[#E6E6E2] dark:border-[#27272F] bg-black/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewDataUrl}
                alt="Pratinjau foto makanan"
                className="w-full h-40 object-cover"
              />
              <button
                type="button"
                onClick={() => setPreviewDataUrl(null)}
                className="absolute top-2 right-2 min-h-[36px] px-3 py-1.5 rounded-lg bg-black/80 text-white text-xs font-semibold hover:bg-black cursor-pointer"
              >
                Hapus Foto
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-2.5">
            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={MOTION_SPRING}
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#141418] dark:bg-[#27272F] text-white text-xs font-bold flex items-center gap-2 hover:opacity-95 transition cursor-pointer"
            >
              <Camera className="w-4 h-4 text-[#F59E0B] shrink-0" />
              <span>Ambil Foto / Unggah</span>
            </motion.button>

            <motion.button
              type="button"
              whileTap={{ scale: 0.97 }}
              transition={MOTION_SPRING}
              onClick={() => runFoodAnalysis(previewDataUrl || undefined, foodHint)}
              disabled={isAnalyzing}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#F97316] to-[#F59E0B] text-black text-xs font-extrabold flex items-center gap-2 hover:opacity-95 transition disabled:opacity-60 cursor-pointer"
            >
              <Cpu className={`w-4 h-4 shrink-0 ${isAnalyzing ? 'animate-spin' : ''}`} />
              <span>{isAnalyzing ? 'Menghubungi Gemini AI...' : 'Analisis Real-Time'}</span>
            </motion.button>
          </div>

          {/* Quick Real-Time Prompts — horizontal snap on small mobile, 2x2 grid on sm+ */}
          <div className="pt-3 border-t border-[#E6E6E2] dark:border-[#27272F]">
            <p className="text-[11px] font-semibold text-[#52525B] dark:text-neutral-400 mb-2">
              Uji Cepat Hidangan Nusantara (Sehat vs Tinggi Kalori):
            </p>
            <div className="flex sm:grid sm:grid-cols-2 gap-2 overflow-x-auto sm:overflow-visible snap-x snap-mandatory pb-1 sm:pb-0">
              {SAMPLE_DISHES.map((sampleQuery) => (
                <button
                  key={sampleQuery}
                  type="button"
                  disabled={isAnalyzing}
                  onClick={() => {
                    setFoodHint(sampleQuery);
                    runFoodAnalysis(previewDataUrl || undefined, sampleQuery);
                  }}
                  className="min-w-[215px] sm:min-w-0 snap-start min-h-[44px] p-3 rounded-xl bg-[#F7F7F5] dark:bg-[#0E0E11] hover:bg-neutral-100 dark:hover:bg-[#1C1C22] border border-[#E6E6E2] dark:border-[#27272F] text-left text-xs font-semibold leading-snug break-words transition active:scale-[0.98] cursor-pointer disabled:opacity-50"
                >
                  {sampleQuery}
                </button>
              ))}
            </div>
          </div>

          {/* Explicit Real-Time Connection / API Error Diagnostic Card */}
          <AnimatePresence>
            {errorDetail && (
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -6 }}
                transition={MOTION_SPRING}
                role="alert"
                className="p-4 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-950 dark:text-rose-200 space-y-2"
              >
                <div className="flex items-start gap-2.5">
                  <WifiOff className="w-4 h-4 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
                  <div className="min-w-0 flex-1 space-y-1">
                    <p className="text-xs font-bold leading-snug break-words">
                      {errorDetail.error}
                    </p>
                    <p className="text-[11px] font-telemetry text-rose-700 dark:text-rose-300">
                      Kode: {errorDetail.errorCode}
                      {errorDetail.modelAttempted ? ` · Model: ${errorDetail.modelAttempted}` : ''}
                    </p>
                  </div>
                </div>

                {errorDetail.reason && (
                  <p className="text-xs leading-relaxed text-rose-900/90 dark:text-rose-200/90 break-words">
                    <strong>Penyebab:</strong> {errorDetail.reason}
                  </p>
                )}

                {errorDetail.hint && (
                  <p className="text-xs leading-relaxed text-rose-900/80 dark:text-rose-200/80 break-words">
                    <strong>Solusi:</strong> {errorDetail.hint}
                  </p>
                )}

                {errorDetail.rawDetail && (
                  <p className="text-[11px] font-mono text-rose-800/75 dark:text-rose-300/75 break-all pt-1 border-t border-rose-500/20">
                    Detail API: {errorDetail.rawDetail}
                  </p>
                )}

                <div className="pt-1">
                  <button
                    type="button"
                    disabled={isAnalyzing}
                    onClick={() => runFoodAnalysis(previewDataUrl || undefined, foodHint)}
                    className="inline-flex items-center gap-1.5 min-h-[36px] px-3 py-1.5 rounded-lg bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold transition cursor-pointer disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>Coba Analisis Ulang</span>
                  </button>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Right 6 Cols: Live Gemini Analysis Result Card */}
        <div className="lg:col-span-6 surface-card p-4 sm:p-5 flex flex-col justify-between min-w-0">
          <AnimatePresence mode="wait">
            {analysisResult ? (
              <motion.div
                key={`${analysisResult.food_name}-${analysisMeta?.analyzedAt || ''}`}
                initial={{ opacity: 0, y: 12, scale: 0.985 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.985 }}
                transition={MOTION_SPRING}
                className="min-w-0"
              >
                <div className="flex flex-wrap items-start justify-between gap-2.5 mb-2.5">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold text-[#111114] dark:text-white break-words">
                      {analysisResult.food_name}
                    </h3>
                    <p className="text-xs text-[#52525B] dark:text-neutral-400 mt-0.5">
                      Estimasi porsi: {analysisResult.portion_estimate}
                    </p>
                  </div>
                  <div
                    className={`px-3 py-1.5 rounded-xl text-xs font-extrabold font-telemetry shrink-0 ${
                      analysisResult.health_score >= 7
                        ? 'bg-[#D1FAE5] text-[#065F46]'
                        : analysisResult.health_score >= 5
                        ? 'bg-[#FEF3C7] text-[#92400E]'
                        : 'bg-[#FFE4E6] text-[#9F1239]'
                    }`}
                  >
                    Skor: {analysisResult.health_score}/10
                  </div>
                </div>

                {/* Transparent Real-Time Model & Token Usage Telemetry (Clean unboxed typography, zero pill clutter) */}
                {analysisMeta && (
                  <div className="mb-3 py-2 px-3 rounded-xl bg-[#F7F7F5] dark:bg-[#0E0E11] border border-[#E6E6E2] dark:border-[#27272F] text-[11px] font-telemetry text-[#52525B] dark:text-neutral-300 space-y-1">
                    <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-0.5">
                      <span className="font-bold text-[#111114] dark:text-white">
                        Model: <span className="text-[#F97316]">{analysisMeta.model}</span>
                      </span>
                      <span>
                        Latensi:{' '}
                        <strong className="text-[#111114] dark:text-white">
                          {analysisMeta.latencyMs.toLocaleString('id-ID')} ms
                        </strong>
                      </span>
                    </div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px]">
                      <span>
                        Total Token:{' '}
                        <strong className="text-[#111114] dark:text-white">
                          {analysisMeta.usage.totalTokenCount.toLocaleString('id-ID')}
                        </strong>
                      </span>
                      <span>·</span>
                      <span>
                        Input: {analysisMeta.usage.promptTokenCount.toLocaleString('id-ID')}
                      </span>
                      <span>·</span>
                      <span>
                        Output: {analysisMeta.usage.candidatesTokenCount.toLocaleString('id-ID')}
                      </span>
                      {analysisMeta.usage.thoughtsTokenCount > 0 && (
                        <>
                          <span>·</span>
                          <span>
                            Thinking:{' '}
                            {analysisMeta.usage.thoughtsTokenCount.toLocaleString('id-ID')}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                )}

                {/* Honest Verdict Banner */}
                {analysisResult.honest_verdict && (
                  <div
                    className={`p-3 rounded-xl mb-3 text-xs font-medium flex items-start gap-2.5 border ${
                      analysisResult.health_score >= 7
                        ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-950 dark:text-emerald-200'
                        : analysisResult.health_score >= 5
                        ? 'bg-amber-500/10 border-amber-500/25 text-amber-950 dark:text-amber-200'
                        : 'bg-rose-500/10 border-rose-500/25 text-rose-950 dark:text-rose-200'
                    }`}
                  >
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                    <div className="min-w-0 break-words">
                      <strong className="font-bold">Vonis Gizi: </strong>
                      <span>{analysisResult.honest_verdict}</span>
                    </div>
                  </div>
                )}

                {/* Macro Breakdown Boxes — responsive 2 cols on 320px, 5 cols on sm+ */}
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2 mb-3 text-center font-telemetry">
                  <div className="col-span-2 sm:col-span-1 p-2.5 rounded-xl bg-[#141418] text-white">
                    <span className="text-[10px] font-sans text-neutral-400 block">Kalori</span>
                    <span className="text-base sm:text-sm font-extrabold text-[#F59E0B]">
                      {Math.round(analysisResult.calories_kcal)}
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#F7F7F5] dark:bg-[#0E0E11] border border-[#E6E6E2] dark:border-[#27272F]">
                    <span className="text-[10px] font-sans text-[#52525B] dark:text-neutral-400 block">
                      Protein
                    </span>
                    <span className="text-sm font-extrabold text-[#F97316]">
                      {Math.round(analysisResult.protein_g)}g
                    </span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#F7F7F5] dark:bg-[#0E0E11] border border-[#E6E6E2] dark:border-[#27272F]">
                    <span className="text-[10px] font-sans text-[#52525B] dark:text-neutral-400 block">
                      Karbo
                    </span>
                    <span className="text-sm font-bold">{Math.round(analysisResult.carbs_g)}g</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#F7F7F5] dark:bg-[#0E0E11] border border-[#E6E6E2] dark:border-[#27272F]">
                    <span className="text-[10px] font-sans text-[#52525B] dark:text-neutral-400 block">
                      Lemak
                    </span>
                    <span className="text-sm font-bold">{Math.round(analysisResult.fat_g)}g</span>
                  </div>
                  <div className="p-2.5 rounded-xl bg-[#F7F7F5] dark:bg-[#0E0E11] border border-[#E6E6E2] dark:border-[#27272F]">
                    <span className="text-[10px] font-sans text-[#52525B] dark:text-neutral-400 block">
                      Serat
                    </span>
                    <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      {Math.round(analysisResult.fiber_g)}g
                    </span>
                  </div>
                </div>

                {/* Sugar & Sodium Strip */}
                {(analysisResult.sugar_g !== undefined ||
                  analysisResult.sodium_mg !== undefined) && (
                  <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#52525B] dark:text-neutral-400 mb-3 px-1 font-telemetry">
                    {analysisResult.sugar_g !== undefined && (
                      <span>
                        Gula:{' '}
                        <strong className="text-[#111114] dark:text-white">
                          {Math.round(analysisResult.sugar_g)}g
                        </strong>
                      </span>
                    )}
                    {analysisResult.sodium_mg !== undefined && (
                      <span>
                        Natrium:{' '}
                        <strong className="text-[#111114] dark:text-white">
                          {Math.round(analysisResult.sodium_mg)} mg
                        </strong>
                      </span>
                    )}
                  </div>
                )}

                {/* Itemized Ingredients Breakdown */}
                {analysisResult.ingredients_breakdown &&
                  analysisResult.ingredients_breakdown.length > 0 && (
                    <div className="mb-3 rounded-xl bg-[#F7F7F5] dark:bg-[#0E0E11] border border-[#E6E6E2] dark:border-[#27272F] p-3">
                      <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#111114] dark:text-white mb-2">
                        <ListChecks className="w-3.5 h-3.5 text-[#F97316] shrink-0" />
                        <span>Rincian Komponen Bahan</span>
                      </div>
                      <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                        {analysisResult.ingredients_breakdown.map((ing, i) => (
                          <div
                            key={`${ing.item}-${i}`}
                            className="flex items-center justify-between gap-2 text-xs border-b border-[#E6E6E2]/60 dark:border-[#27272F]/60 last:border-none pb-1 last:pb-0"
                          >
                            <span className="text-[#111114] dark:text-neutral-200 font-medium min-w-0 truncate">
                              {ing.item}{' '}
                              <span className="text-[#52525B] dark:text-neutral-400">
                                ({ing.amount})
                              </span>
                            </span>
                            <span className="font-telemetry font-semibold text-[#52525B] dark:text-neutral-300 shrink-0">
                              {Math.round(ing.calories_kcal)} kkal · {Math.round(ing.protein_g)}g P
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                <div className="p-3.5 rounded-xl bg-[#FEF3C7]/60 dark:bg-[#0E0E11] border border-[#F59E0B]/30 text-xs text-[#111114] dark:text-neutral-200 leading-relaxed mb-4 break-words">
                  <strong className="text-[#92400E] dark:text-[#F59E0B]">Saran Praktis: </strong>
                  {analysisResult.local_indonesian_tips}
                </div>

                <motion.button
                  type="button"
                  whileHover={{ scale: 1.01 }}
                  whileTap={{ scale: 0.98 }}
                  transition={MOTION_SPRING}
                  onClick={handleAddResultToLog}
                  className="w-full min-h-[44px] py-3 rounded-xl bg-gradient-to-r from-[#F97316] to-[#F59E0B] text-black font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 hover:opacity-95 cursor-pointer"
                >
                  {addedToast ? (
                    <>
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>Ditambahkan ke Log Harian</span>
                    </>
                  ) : (
                    <>
                      <Plus className="w-4 h-4 shrink-0" />
                      <span>Tambah ke Log ({mealTypeLabel[mealType]})</span>
                    </>
                  )}
                </motion.button>
              </motion.div>
            ) : (
              <motion.div
                key="empty-suggestions"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={MOTION_SPRING}
                className="space-y-4"
              >
                <div>
                  <h3 className="text-sm font-semibold text-[#111111] dark:text-white">
                    Rekomendasi Penutup Target Protein Harian
                  </h3>
                  <p className="text-xs text-[#6B7280] dark:text-neutral-400 mt-0.5">
                    Sisa protein hari ini:{' '}
                    <strong className="text-[#F97316]">{remainingProteinG}g</strong> · Pilih saran
                    makanan tinggi protein lokal:
                  </p>
                </div>
                <div className="space-y-2">
                  {INDONESIAN_HIGH_PROTEIN_SUGGESTIONS.map((s) => (
                    <div
                      key={s.name}
                      className="p-3 rounded-xl bg-[#F8F9FA] dark:bg-[#0E0E0E] border border-[#EFEFEF] dark:border-[#262626] flex items-center justify-between gap-2 text-xs"
                    >
                      <div className="min-w-0">
                        <p className="font-bold text-[#111111] dark:text-white truncate">{s.name}</p>
                        <p className="text-[11px] text-[#6B7280] dark:text-neutral-400 tabular-nums">
                          +{s.proteinG}g protein · {s.kcal} kkal
                        </p>
                      </div>
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.03 }}
                        whileTap={{ scale: 0.95 }}
                        transition={MOTION_SPRING}
                        onClick={() => {
                          addNutritionLog({
                            id: `meal-${Date.now()}`,
                            mealType: 'snack',
                            foodName: s.name,
                            portionEstimate: '1 porsi standar',
                            caloriesKcal: s.kcal,
                            proteinG: s.proteinG,
                            carbsG: 8,
                            fatG: 5,
                            fiberG: 2,
                            healthScore: 9,
                            tips: 'Tambahan protein berkualitas tinggi untuk memenuhi Golden Rule 1.6–2.2g/kg.',
                            loggedAt: new Date().toTimeString().slice(0, 5),
                          });
                        }}
                        className="min-h-[36px] px-3 py-1.5 rounded-lg bg-[#161616] text-white font-semibold hover:bg-[#262626] shrink-0 cursor-pointer"
                      >
                        + Log Cepat
                      </motion.button>
                    </div>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* DAILY MEAL LOG TABLE */}
      <div className="rounded-2xl bg-white dark:bg-[#161616] p-4 sm:p-5 border border-[#EFEFEF] dark:border-[#262626] shadow-card">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-4">
          <div className="flex items-center gap-2">
            <Utensils className="w-4 h-4 text-[#F97316]" />
            <h2 className="text-sm font-semibold text-[#111111] dark:text-white">
              Log Makanan Harian ({nutritionLogs.length} Entri)
            </h2>
          </div>
          <span className="text-xs font-bold text-[#F97316] tabular-nums">
            Total: {totalCaloriesIn} kkal · {totalProteinG}g Protein
          </span>
        </div>

        <div className="divide-y divide-[#EFEFEF] dark:divide-[#262626]">
          <AnimatePresence initial={false}>
            {nutritionLogs.map((item) => (
              <motion.div
                key={item.id}
                layout
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -16 }}
                transition={MOTION_SPRING}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
              >
                <div className="space-y-1 min-w-0">
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-xs text-[#6B7280] dark:text-neutral-400">
                    <span className="font-bold text-[#F97316]">
                      {mealTypeLabel[item.mealType]}
                    </span>
                    <span>·</span>
                    <span className="tabular-nums">{item.loggedAt} WIB</span>
                    <span>·</span>
                    <span>{item.portionEstimate}</span>
                    <span>·</span>
                    <span className="text-emerald-600 dark:text-emerald-400 font-semibold">
                      Skor {item.healthScore}/10
                    </span>
                  </div>
                  <p className="text-sm font-bold text-[#111111] dark:text-white break-words">
                    {item.foodName}
                  </p>
                  <p className="text-xs text-[#6B7280] dark:text-neutral-400">{item.tips}</p>
                </div>

                <div className="flex items-center gap-4 shrink-0 tabular-nums">
                  <div className="text-right">
                    <p className="text-sm font-extrabold text-[#111111] dark:text-white">
                      {item.caloriesKcal} kkal
                    </p>
                    <p className="text-xs text-[#F97316] font-bold">
                      {item.proteinG}g P · {item.carbsG}g K · {item.fatG}g L
                    </p>
                  </div>
                  <motion.button
                    type="button"
                    whileHover={{ scale: 1.08 }}
                    whileTap={{ scale: 0.9 }}
                    transition={MOTION_SPRING}
                    onClick={() => deleteNutritionLog(item.id)}
                    className="p-2 rounded-lg text-neutral-400 hover:text-[#EF4444] hover:bg-neutral-100 dark:hover:bg-[#262626] transition cursor-pointer"
                    aria-label={`Hapus ${item.foodName}`}
                  >
                    <Trash2 className="w-4 h-4" />
                  </motion.button>
                </div>
              </motion.div>
            ))}
          </AnimatePresence>
        </div>
      </div>
    </AppShell>
  );
}
