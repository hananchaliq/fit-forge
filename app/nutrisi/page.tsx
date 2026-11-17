'use client';

import React, { useRef, useState } from 'react';
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
        <div className="rounded-2xl bg-[#161616] text-white p-5 border border-[#262626] shadow-card">
          <p className="text-xs text-neutral-400">Sisa Budget Kalori (+Lari Hari Ini)</p>
          <p className="text-3xl font-extrabold text-[#F59E0B] tabular-nums mt-1">
            {remainingCalories.toLocaleString('id-ID')} <span className="text-sm font-normal">kkal</span>
          </p>
          <p className="text-[11px] text-neutral-400 mt-2 tabular-nums">
            Target {profile.dailyCalorieTarget} + {todayRunBurnKcal} lari − {totalCaloriesIn} masuk
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#161616] p-5 border border-[#EFEFEF] dark:border-[#262626] shadow-card">
          <p className="text-xs text-[#6B7280] dark:text-neutral-400">Total Protein Harian</p>
          <p className="text-3xl font-extrabold text-[#111111] dark:text-white tabular-nums mt-1">
            {totalProteinG}g{' '}
            <span className="text-sm font-normal text-[#6B7280]">/ {profile.dailyProteinTargetG}g</span>
          </p>
          <p className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold mt-2">
            {remainingProteinG > 0
              ? `Sisa protein: ${remainingProteinG}g lagi`
              : 'Target Golden Rule Protein Tercapai ✓'}
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#161616] p-5 border border-[#EFEFEF] dark:border-[#262626] shadow-card">
          <p className="text-xs text-[#6B7280] dark:text-neutral-400">Karbohidrat & Serat</p>
          <p className="text-3xl font-extrabold text-[#111111] dark:text-white tabular-nums mt-1">
            {totalCarbsG}g <span className="text-sm font-normal text-[#6B7280]">· {totalFiberG}g serat</span>
          </p>
          <p className="text-[11px] text-[#6B7280] dark:text-neutral-400 mt-2">
            Glikogen otot & pencernaan
          </p>
        </div>

        <div className="rounded-2xl bg-white dark:bg-[#161616] p-5 border border-[#EFEFEF] dark:border-[#262626] shadow-card">
          <p className="text-xs text-[#6B7280] dark:text-neutral-400">Lemak Harian</p>
          <p className="text-3xl font-extrabold text-[#111111] dark:text-white tabular-nums mt-1">
            {totalFatG}g
          </p>
          <p className="text-[11px] text-[#6B7280] dark:text-neutral-400 mt-2">
            Utamakan lemak sehat & kurangi gorengan
          </p>
        </div>
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
              className="px-3 py-2.5 rounded-xl bg-[#F8F9FA] dark:bg-[#0E0E0E] border border-[#EFEFEF] dark:border-[#262626] text-xs font-semibold"
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
              placeholder="Ketik makanan apa saja (mis: Indomie Goreng 2 bungkus + telur, Nasi Padang)..."
              className="sm:col-span-2 px-3.5 py-2.5 rounded-xl bg-[#F8F9FA] dark:bg-[#0E0E0E] border border-[#EFEFEF] dark:border-[#262626] text-xs"
            />
          </div>

          {previewDataUrl && (
            <div className="relative rounded-xl overflow-hidden border border-[#EFEFEF] dark:border-[#262626] bg-black/5">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={previewDataUrl}
                alt="Pratinjau foto makanan"
                className="w-full h-40 object-cover"
              />
              <button
                type="button"
                onClick={() => setPreviewDataUrl(null)}
                className="absolute top-2 right-2 px-2.5 py-1 rounded-lg bg-black/75 text-white text-[11px] font-semibold hover:bg-black cursor-pointer"
              >
                Hapus Foto
              </button>
            </div>
          )}

          <div className="flex flex-wrap gap-2.5">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="px-4 py-2.5 rounded-xl bg-[#161616] dark:bg-[#262626] text-white text-xs font-bold flex items-center gap-2 hover:opacity-95 cursor-pointer"
            >
              <Camera className="w-4 h-4 text-[#F59E0B]" />
              <span>Ambil Foto / Unggah Gambar</span>
            </button>

            <button
              type="button"
              onClick={() => runFoodAnalysis(previewDataUrl || undefined, foodHint)}
              disabled={isAnalyzing}
              className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-[#F97316] to-[#F59E0B] text-black text-xs font-extrabold flex items-center gap-2 hover:opacity-95 disabled:opacity-60 cursor-pointer"
            >
              <Sparkles className="w-4 h-4" />
              <span>{isAnalyzing ? 'Menganalisis via Gemini AI...' : 'Analisis Sekarang'}</span>
            </button>
          </div>

          {/* One-Click Real Live Gemini Prompts (Both Healthy & Unhealthy Dishes to Prove Honest Evaluation) */}
          <div className="pt-2 border-t border-[#EFEFEF] dark:border-[#262626]">
            <p className="text-[11px] font-semibold text-[#6B7280] dark:text-neutral-400 mb-2">
              Uji Analisis Jujur Live Gemini AI (Sehat vs Tinggi Kalori/Lemak):
            </p>
            <div className="grid grid-cols-2 gap-2">
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
                  className="p-2.5 rounded-xl bg-[#F8F9FA] dark:bg-[#0E0E0E] hover:bg-neutral-100 dark:hover:bg-[#1E1E1E] border border-[#EFEFEF] dark:border-[#262626] text-left text-xs font-semibold transition cursor-pointer disabled:opacity-50"
                >
                  {sampleQuery}
                </button>
              ))}
            </div>
          </div>

          {errorMsg && (
            <div className="p-3 rounded-xl bg-[#FFE4E6] text-[#BE123C] text-xs font-semibold flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMsg}</span>
            </div>
          )}
        </div>

        {/* Right 6 Cols: Live Gemini Analysis Result Card */}
        <div className="lg:col-span-6 rounded-2xl bg-white dark:bg-[#161616] p-5 border border-[#EFEFEF] dark:border-[#262626] shadow-card flex flex-col justify-between">
          {analysisResult ? (
            <div>
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="text-[11px] font-bold uppercase text-[#F97316]">
                      HASIL LIVE GEMINI AI
                    </span>
                    {analysisSource && (
                      <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 text-[10px] font-mono font-bold">
                        {analysisSource}
                      </span>
                    )}
                  </div>
                  <h3 className="text-base font-bold text-[#111111] dark:text-white mt-0.5">
                    {analysisResult.food_name}
                  </h3>
                  <p className="text-xs text-[#6B7280] dark:text-neutral-400">
                    Estimasi porsi: {analysisResult.portion_estimate}
                  </p>
                </div>
                <div
                  className={`px-3 py-1.5 rounded-xl text-xs font-extrabold tabular-nums shrink-0 ${
                    analysisResult.health_score >= 7
                      ? 'bg-[#D1FAE5] text-[#047857]'
                      : analysisResult.health_score >= 5
                      ? 'bg-[#FEF3C7] text-[#B45309]'
                      : 'bg-[#FFE4E6] text-[#BE123C]'
                  }`}
                >
                  Skor Jujur: {analysisResult.health_score}/10
                </div>
              </div>

              {/* Honest Verdict Banner */}
              {analysisResult.honest_verdict && (
                <div
                  className={`p-3 rounded-xl mb-3 text-xs font-medium flex items-start gap-2.5 border ${
                    analysisResult.health_score >= 7
                      ? 'bg-emerald-500/10 border-emerald-500/25 text-emerald-900 dark:text-emerald-200'
                      : analysisResult.health_score >= 5
                      ? 'bg-amber-500/10 border-amber-500/25 text-amber-900 dark:text-amber-200'
                      : 'bg-rose-500/10 border-rose-500/25 text-rose-900 dark:text-rose-200'
                  }`}
                >
                  <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5" />
                  <div>
                    <strong className="font-bold">Vonis Gizi Jujur: </strong>
                    <span>{analysisResult.honest_verdict}</span>
                  </div>
                </div>
              )}

              {/* Macro Breakdown Boxes */}
              <div className="grid grid-cols-5 gap-2 mb-3 text-center tabular-nums">
                <div className="p-2.5 rounded-xl bg-[#161616] text-white">
                  <span className="text-[10px] text-neutral-400 block">Kalori</span>
                  <span className="text-sm font-extrabold text-[#F59E0B]">
                    {Math.round(analysisResult.calories_kcal)}
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#F8F9FA] dark:bg-[#0E0E0E] border border-[#EFEFEF] dark:border-[#262626]">
                  <span className="text-[10px] text-[#6B7280] block">Protein</span>
                  <span className="text-sm font-extrabold text-[#F97316]">
                    {Math.round(analysisResult.protein_g)}g
                  </span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#F8F9FA] dark:bg-[#0E0E0E] border border-[#EFEFEF] dark:border-[#262626]">
                  <span className="text-[10px] text-[#6B7280] block">Karbo</span>
                  <span className="text-sm font-bold">{Math.round(analysisResult.carbs_g)}g</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#F8F9FA] dark:bg-[#0E0E0E] border border-[#EFEFEF] dark:border-[#262626]">
                  <span className="text-[10px] text-[#6B7280] block">Lemak</span>
                  <span className="text-sm font-bold">{Math.round(analysisResult.fat_g)}g</span>
                </div>
                <div className="p-2.5 rounded-xl bg-[#F8F9FA] dark:bg-[#0E0E0E] border border-[#EFEFEF] dark:border-[#262626]">
                  <span className="text-[10px] text-[#6B7280] block">Serat</span>
                  <span className="text-sm font-bold text-emerald-500">
                    {Math.round(analysisResult.fiber_g)}g
                  </span>
                </div>
              </div>

              {/* Sugar & Sodium Strip */}
              {(analysisResult.sugar_g !== undefined || analysisResult.sodium_mg !== undefined) && (
                <div className="flex items-center gap-4 text-[11px] text-[#6B7280] dark:text-neutral-400 mb-3 px-1 tabular-nums">
                  {analysisResult.sugar_g !== undefined && (
                    <span>
                      Gula: <strong className="text-[#111111] dark:text-white">{Math.round(analysisResult.sugar_g)}g</strong>
                    </span>
                  )}
                  {analysisResult.sodium_mg !== undefined && (
                    <span>
                      Natrium (Garam):{' '}
                      <strong className="text-[#111111] dark:text-white">
                        {Math.round(analysisResult.sodium_mg)} mg
                      </strong>
                    </span>
                  )}
                </div>
              )}

              {/* Itemized Ingredients Breakdown */}
              {analysisResult.ingredients_breakdown &&
                analysisResult.ingredients_breakdown.length > 0 && (
                  <div className="mb-3 rounded-xl bg-[#F8F9FA] dark:bg-[#0E0E0E] border border-[#EFEFEF] dark:border-[#262626] p-3">
                    <div className="flex items-center gap-1.5 text-[11px] font-bold text-[#111111] dark:text-white mb-2">
                      <ListChecks className="w-3.5 h-3.5 text-[#F97316]" />
                      <span>Rincian Komponen Bahan Makanan:</span>
                    </div>
                    <div className="space-y-1.5 max-h-36 overflow-y-auto pr-1">
                      {analysisResult.ingredients_breakdown.map((ing, i) => (
                        <div
                          key={`${ing.item}-${i}`}
                          className="flex items-center justify-between text-xs border-b border-[#EFEFEF]/60 dark:border-[#262626]/60 last:border-none pb-1 last:pb-0"
                        >
                          <span className="text-[#111111] dark:text-neutral-200 font-medium">
                            {ing.item}{' '}
                            <span className="text-[#6B7280] dark:text-neutral-400">
                              ({ing.amount})
                            </span>
                          </span>
                          <span className="tabular-nums font-semibold text-[#6B7280] dark:text-neutral-300 shrink-0 ml-2">
                            {Math.round(ing.calories_kcal)} kkal · {Math.round(ing.protein_g)}g P
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

              <div className="p-3.5 rounded-xl bg-[#FEF3C7]/60 dark:bg-[#0E0E0E] border border-[#F59E0B]/30 text-xs text-[#111111] dark:text-neutral-200 leading-relaxed mb-4">
                <strong className="text-[#B45309] dark:text-[#F59E0B]">Saran Praktis Atletis: </strong>
                {analysisResult.local_indonesian_tips}
              </div>

              <button
                type="button"
                onClick={handleAddResultToLog}
                className="w-full py-3 rounded-xl bg-gradient-to-r from-[#F97316] to-[#F59E0B] text-black font-extrabold text-xs sm:text-sm flex items-center justify-center gap-2 hover:opacity-95 transition cursor-pointer"
              >
                {addedToast ? (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Berhasil Ditambahkan ke Log Harian!</span>
                  </>
                ) : (
                  <>
                    <Plus className="w-4 h-4" />
                    <span>Tambah ke Log ({mealTypeLabel[mealType]})</span>
                  </>
                )}
              </button>
            </div>
          ) : (
            <div className="space-y-4">
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
                    className="p-3 rounded-xl bg-[#F8F9FA] dark:bg-[#0E0E0E] border border-[#EFEFEF] dark:border-[#262626] flex items-center justify-between text-xs"
                  >
                    <div>
                      <p className="font-bold text-[#111111] dark:text-white">{s.name}</p>
                      <p className="text-[11px] text-[#6B7280] dark:text-neutral-400 tabular-nums">
                        +{s.proteinG}g protein · {s.kcal} kkal
                      </p>
                    </div>
                    <button
                      type="button"
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
                      className="px-3 py-1.5 rounded-lg bg-[#161616] text-white font-semibold hover:bg-[#262626] cursor-pointer"
                    >
                      + Log Cepat
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}
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
          {nutritionLogs.map((item) => (
            <div
              key={item.id}
              className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3"
            >
              <div className="space-y-1">
                <div className="flex items-center gap-2 text-xs text-[#6B7280] dark:text-neutral-400">
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
                <p className="text-sm font-bold text-[#111111] dark:text-white">
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
                <button
                  type="button"
                  onClick={() => deleteNutritionLog(item.id)}
                  className="p-2 rounded-lg text-neutral-400 hover:text-[#EF4444] hover:bg-neutral-100 dark:hover:bg-[#262626] transition cursor-pointer"
                  aria-label={`Hapus ${item.foodName}`}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </AppShell>
  );
}
