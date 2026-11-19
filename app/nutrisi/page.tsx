'use client';

import React, { useRef, useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Camera,
  Sparkles,
  Plus,
  Trash2,
  CheckCircle2,
  Utensils,
  AlertCircle,
  ShieldAlert,
  ListChecks,
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
  const [errorMsg, setErrorMsg] = useState('');
  const [analysisResult, setAnalysisResult] = useState<AnalyzedFoodResult | null>(null);
  const [analysisSource, setAnalysisSource] = useState<string>('');
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
    setErrorMsg('');

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
      setErrorMsg('Silakan ketik deskripsi makanan atau unggah foto makanan terlebih dahulu.');
      return;
    }

    setIsAnalyzing(true);
    setErrorMsg('');
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
      const data = await res.json();
      if (!res.ok) {
        setErrorMsg(data.error || 'Gagal menganalisis makanan.');
      } else if (data.result) {
        setAnalysisResult(data.result);
        setAnalysisSource(data.source || 'gemini-4-hydrogen');
      }
    } catch {
      setErrorMsg('Gagal menghubungi server analisis Gemini AI.');
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
      subtitle="Analisis kalori, makronutrien, rincian bahan & vonis gizi jujur berbasis Live Gemini AI"
      ctaLabel="Foto / Unggah Makanan"
      onCtaClick={() => fileInputRef.current?.click()}
    >
      {/* Dynamic Calorie & Protein Budget Summary Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <MotionCard className="rounded-2xl bg-[#141418] text-white p-5 border border-[#27272E] shadow-card">
          <p className="text-xs text-neutral-400">Sisa Budget Kalori (+Lari Hari Ini)</p>
          <p className="text-3xl font-extrabold text-[#F59E0B] font-telemetry mt-1">
            {remainingCalories.toLocaleString('id-ID')} <span className="text-sm font-normal">kkal</span>
          </p>
          <p className="text-[11px] text-neutral-400 mt-2 font-telemetry">
            Target {profile.dailyCalorieTarget} + {todayRunBurnKcal} lari − {totalCaloriesIn} masuk
          </p>
        </MotionCard>

        <MotionCard className="rounded-2xl bg-white dark:bg-[#141418] p-5 border border-[#E5E5E0] dark:border-[#27272E] shadow-card">
          <p className="text-xs text-[#6B7280] dark:text-neutral-400">Total Protein Harian</p>
          <p className="text-3xl font-extrabold text-[#111111] dark:text-white font-telemetry mt-1">
            {totalProteinG}g{' '}
            <span className="text-sm font-normal text-[#6B7280]">/ {profile.dailyProteinTargetG}g</span>
          </p>
          <MotionProgressBar
            percent={(totalProteinG / Math.max(1, profile.dailyProteinTargetG)) * 100}
            className="h-1.5 mt-2.5"
            barClassName="bg-gradient-to-r from-[#10B981] to-[#34D399]"
          />
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-1.5">
            {remainingProteinG > 0
              ? `Sisa protein: ${remainingProteinG}g lagi`
              : 'Target Golden Rule Protein Tercapai ✓'}
          </p>
        </MotionCard>

        <MotionCard className="rounded-2xl bg-white dark:bg-[#141418] p-5 border border-[#E5E5E0] dark:border-[#27272E] shadow-card">
          <p className="text-xs text-[#6B7280] dark:text-neutral-400">Karbohidrat &amp; Serat</p>
          <p className="text-3xl font-extrabold text-[#111111] dark:text-white font-telemetry mt-1">
            {totalCarbsG}g <span className="text-sm font-normal text-[#6B7280]">· {totalFiberG}g serat</span>
          </p>
          <p className="text-[11px] text-[#6B7280] dark:text-neutral-400 mt-2">
            Glikogen otot &amp; pencernaan
          </p>
        </MotionCard>

        <MotionCard className="rounded-2xl bg-white dark:bg-[#141418] p-5 border border-[#E5E5E0] dark:border-[#27272E] shadow-card">
          <p className="text-xs text-[#6B7280] dark:text-neutral-400">Lemak Harian</p>
          <p className="text-3xl font-extrabold text-[#111111] dark:text-white font-telemetry mt-1">
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
        <div className="lg:col-span-6 rounded-2xl bg-white dark:bg-[#161616] p-5 border border-[#EFEFEF] dark:border-[#262626] shadow-card space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-sm font-semibold text-[#111111] dark:text-white">
                Pemindai & Kalkulator Gizi Jujur (Live Gemini AI)
              </h2>
              <p className="text-xs text-[#6B7280] dark:text-neutral-400">
                Terkoneksi langsung ke Gemini 4 Hydrogen API · Tanpa jawaban default
              </p>
            </div>
            <Sparkles className="w-5 h-5 text-[#F97316]" />
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
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-[#141418] dark:bg-[#27272F] text-white text-xs font-bold flex items-center gap-2 hover:opacity-95 active:scale-[0.98] transition cursor-pointer"
            >
              <Camera className="w-4 h-4 text-[#F59E0B] shrink-0" />
              <span>Ambil Foto / Unggah</span>
            </button>

            <button
              type="button"
              onClick={() => runFoodAnalysis(previewDataUrl || undefined, foodHint)}
              disabled={isAnalyzing}
              className="min-h-[44px] px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#F97316] to-[#F59E0B] text-black text-xs font-extrabold flex items-center gap-2 hover:opacity-95 active:scale-[0.98] transition disabled:opacity-60 cursor-pointer"
            >
              <Sparkles className="w-4 h-4 shrink-0" />
              <span>{isAnalyzing ? 'Menganalisis...' : 'Analisis Sekarang'}</span>
            </button>
          </div>

          {/* One-Click Real Live Gemini Prompts (Both Healthy & Unhealthy Dishes to Prove Honest Evaluation) */}
          <div className="pt-3 border-t border-[#E6E6E2] dark:border-[#27272F]">
            <p className="text-[11px] font-semibold text-[#52525B] dark:text-neutral-400 mb-2">
              Uji Cepat Hidangan Nusantara (Sehat vs Tinggi Kalori):
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {[
                'Nasi Padang Rendang Sapi + Kuah Gulai & Perkedel',
                'Dada Ayam Bakar 200g + Nasi Merah 150g + Tempe Rebus',
                'Indomie Goreng 2 Bungkus + Telur Ceplok + Kerupuk',
                'Seblak Kerupuk Ceker Pedas + Bakso Sosis Semangkuk',
              ].map((sampleQuery) => (
                <button
                  key={sampleQuery}
                  type="button"
                  disabled={isAnalyzing}
                  onClick={() => {
                    setFoodHint(sampleQuery);
                    runFoodAnalysis(previewDataUrl || undefined, sampleQuery);
                  }}
                  className="min-h-[44px] p-3 rounded-xl bg-[#F7F7F5] dark:bg-[#0E0E11] hover:bg-neutral-100 dark:hover:bg-[#1C1C22] border border-[#E6E6E2] dark:border-[#27272F] text-left text-xs font-semibold leading-snug break-words transition active:scale-[0.99] cursor-pointer disabled:opacity-50"
                >
                  {sampleQuery}
                </button>
              ))}
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-[#FFE4E6] text-[#9F1239] text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span className="min-w-0 break-words">{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Right 6 Cols: Live Gemini Analysis Result Card */}
        <div className="lg:col-span-6 surface-card p-4 sm:p-5 flex flex-col justify-between min-w-0">
          <AnimatePresence mode="wait">
          {analysisResult ? (
            <motion.div
              key={analysisResult.food_name}
              initial={{ opacity: 0, y: 12, scale: 0.985 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -8, scale: 0.985 }}
              transition={MOTION_SPRING}
              className="min-w-0"
            >
              <div className="flex flex-wrap items-start justify-between gap-2.5 mb-3">
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[11px] font-bold uppercase tracking-wider text-[#F97316]">
                      {analysisSource === 'local-indonesian-fallback'
                        ? 'ESTIMASI GIZI LOKAL'
                        : 'HASIL GEMINI AI'}
                    </span>
                    {analysisSource && (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 text-[10px] font-mono font-bold">
                        {analysisSource === 'local-indonesian-fallback' ? 'Mode Lokal' : analysisSource}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-[#111114] dark:text-white mt-1 break-words">
                    {analysisResult.food_name}
                  </h3>
                  <p className="text-xs text-[#52525B] dark:text-neutral-400">
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
                  <span className="text-[10px] font-sans text-[#52525B] dark:text-neutral-400 block">Protein</span>
                  <span className="text-sm font-extrabold text-[#F97316]">
                    {Math.round(analysisResult.protein_g)}g
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#F7F7F5] dark:bg-[#0E0E11] border border-[#E6E6E2] dark:border-[#27272F]">
                  <span className="text-[10px] font-sans text-[#52525B] dark:text-neutral-400 block">Karbo</span>
                  <span className="text-sm font-bold">{Math.round(analysisResult.carbs_g)}g</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#F7F7F5] dark:bg-[#0E0E11] border border-[#E6E6E2] dark:border-[#27272F]">
                  <span className="text-[10px] font-sans text-[#52525B] dark:text-neutral-400 block">Lemak</span>
                  <span className="text-sm font-bold">{Math.round(analysisResult.fat_g)}g</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#F7F7F5] dark:bg-[#0E0E11] border border-[#E6E6E2] dark:border-[#27272F]">
                  <span className="text-[10px] font-sans text-[#52525B] dark:text-neutral-400 block">Serat</span>
                  <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">
                    {Math.round(analysisResult.fiber_g)}g
                  </span>
                </div>
              </div>

              {/* Sugar & Sodium Strip */}
              {(analysisResult.sugar_g !== undefined || analysisResult.sodium_mg !== undefined) && (
                <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-[#52525B] dark:text-neutral-400 mb-3 px-1 font-telemetry">
                  {analysisResult.sugar_g !== undefined && (
                    <span>
                      Gula: <strong className="text-[#111114] dark:text-white">{Math.round(analysisResult.sugar_g)}g</strong>
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
                  Sisa protein hari ini: <strong className="text-[#F97316]">{remainingProteinG}g</strong> → Pilih saran makanan tinggi protein lokal:
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
      <div className="rounded-2xl bg-white dark:bg-[#161616] p-5 border border-[#EFEFEF] dark:border-[#262626] shadow-card">
        <div className="flex items-center justify-between mb-4">
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
                    <span className="font-bold text-[#F97316] uppercase">
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
                  <p className="text-xs text-[#6B7280] dark:text-neutral-400">
                    {item.tips}
                  </p>
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
