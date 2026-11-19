import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import { z } from 'zod';

const AnalyzeFoodSchema = z.object({
  imageBase64: z.string().optional(),
  mimeType: z.string().optional(),
  foodHint: z.string().optional(),
  description: z.string().optional(),
});

// Simple in-memory rate limiter per IP
const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

function checkRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = rateLimitMap.get(ip);
  if (!entry || now > entry.resetAt) {
    rateLimitMap.set(ip, { count: 1, resetAt: now + 60_000 });
    return true;
  }
  if (entry.count >= 20) return false;
  entry.count += 1;
  return true;
}

interface DiagnosticErrorPayload {
  error: string;
  errorCode: string;
  reason: string;
  hint: string;
  modelAttempted: string;
  rawDetail?: string;
  httpStatus: number;
}

function classifyGeminiError(err: unknown, modelAttempted: string): DiagnosticErrorPayload {
  const rawMsg = err instanceof Error ? err.message : String(err);
  const lower = rawMsg.toLowerCase();

  if (
    lower.includes('api_key_invalid') ||
    lower.includes('api key not valid') ||
    lower.includes('invalid api key') ||
    lower.includes('permission_denied') ||
    lower.includes('401') ||
    lower.includes('403')
  ) {
    return {
      error: 'Koneksi ke Gemini AI ditolak karena kunci API tidak valid atau tidak memiliki izin.',
      errorCode: 'API_KEY_INVALID',
      reason: 'Server menerima penolakan autentikasi (401/403) dari endpoint Google Gemini.',
      hint: 'Periksa kembali nilai GEMINI_API_KEY di konfigurasi server/Secrets lalu muat ulang halaman.',
      modelAttempted,
      rawDetail: rawMsg.slice(0, 220),
      httpStatus: 401,
    };
  }

  if (
    lower.includes('resource_exhausted') ||
    lower.includes('quota') ||
    lower.includes('rate limit') ||
    lower.includes('429')
  ) {
    return {
      error: 'Kuota permintaan Gemini AI saat ini telah habis atau terkena batas kecepatan (429).',
      errorCode: 'QUOTA_EXCEEDED',
      reason: 'Batas permintaan per menit/hari untuk GEMINI_API_KEY sudah terlampaui.',
      hint: 'Tunggu 30–60 detik sebelum mencoba analisis ulang, atau tingkatkan kuota pada proyek Google AI.',
      modelAttempted,
      rawDetail: rawMsg.slice(0, 220),
      httpStatus: 429,
    };
  }

  if (
    lower.includes('fetch failed') ||
    lower.includes('enotfound') ||
    lower.includes('econnrefused') ||
    lower.includes('etimedout') ||
    lower.includes('eai_again') ||
    lower.includes('network') ||
    lower.includes('socket') ||
    lower.includes('abort')
  ) {
    return {
      error: 'Tidak dapat terhubung ke server Google Gemini AI secara real-time.',
      errorCode: 'NETWORK_DISCONNECTED',
      reason: 'Permintaan jaringan dari server ke API Google gagal tersambung atau mengalami timeout.',
      hint: 'Pastikan koneksi internet stabil dan tidak ada firewall/proxy yang memblokir generativelanguage.googleapis.com.',
      modelAttempted,
      rawDetail: rawMsg.slice(0, 220),
      httpStatus: 503,
    };
  }

  if (lower.includes('not_found') || lower.includes('404') || lower.includes('is not found')) {
    return {
      error: `Model ${modelAttempted} tidak tersedia atau tidak ditemukan pada endpoint API saat ini.`,
      errorCode: 'MODEL_UNAVAILABLE',
      reason: 'Server Google Gemini mengembalikan status 404 untuk model yang diminta.',
      hint: 'Periksa akses model pada akun Google AI atau coba lagi beberapa saat.',
      modelAttempted,
      rawDetail: rawMsg.slice(0, 220),
      httpStatus: 502,
    };
  }

  if (lower.includes('503') || lower.includes('500') || lower.includes('unavailable') || lower.includes('overloaded')) {
    return {
      error: 'Layanan Google Gemini AI sedang sibuk atau mengalami gangguan sementara (5xx).',
      errorCode: 'UPSTREAM_OVERLOADED',
      reason: 'Endpoint Google Gemini mengembalikan galat server sementara.',
      hint: 'Tunggu beberapa detik lalu klik "Coba Analisis Ulang".',
      modelAttempted,
      rawDetail: rawMsg.slice(0, 220),
      httpStatus: 503,
    };
  }

  return {
    error: 'Gagal memperoleh respons valid dari Gemini AI secara real-time.',
    errorCode: 'GEMINI_REQUEST_FAILED',
    reason: rawMsg.slice(0, 220) || 'Terjadi galat tak terduga saat memproses permintaan.',
    hint: 'Periksa koneksi internet serta konfigurasi GEMINI_API_KEY, lalu coba kembali.',
    modelAttempted,
    rawDetail: rawMsg.slice(0, 220),
    httpStatus: 502,
  };
}

export async function POST(req: NextRequest) {
  const startedAt = Date.now();
  const primaryModel = 'gemini-4-hydrogen';

  try {
    const ip = req.headers.get('x-forwarded-for') || 'local';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        {
          error: 'Batas permintaan lokal tercapai (maks 20 analisis/menit). Silakan tunggu sebentar.',
          errorCode: 'LOCAL_RATE_LIMIT',
          reason: 'Terlalu banyak permintaan dalam satu menit dari perangkat ini.',
          hint: 'Tunggu hingga 60 detik sebelum mengirim permintaan analisis berikutnya.',
          modelAttempted: primaryModel,
        },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = AnalyzeFoodSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        {
          error: 'Data input tidak valid. Ketik nama makanan atau unggah foto makanan.',
          errorCode: 'INVALID_INPUT',
          reason: 'Payload permintaan tidak sesuai format analisis nutrisi.',
          hint: 'Masukkan deskripsi makanan/minuman atau pilih file gambar berformat JPG/PNG.',
          modelAttempted: primaryModel,
        },
        { status: 400 }
      );
    }

    const { imageBase64, mimeType, foodHint, description } = parsed.data;
    const trimmedHint = (foodHint || description || '').trim();

    if (!imageBase64 && !trimmedHint) {
      return NextResponse.json(
        {
          error: 'Silakan ketik nama makanan/minuman atau unggah foto hidangan terlebih dahulu.',
          errorCode: 'EMPTY_INPUT',
          reason: 'Tidak ada teks deskripsi maupun foto makanan yang dikirim.',
          hint: 'Ketik menu yang ingin dicek (contoh: "Dada Ayam Bakar 200g + Nasi Merah") atau unggah foto.',
          modelAttempted: primaryModel,
        },
        { status: 400 }
      );
    }

    const apiKey = (process.env.GEMINI_API_KEY || '').trim();
    const isPlaceholderKey =
      !apiKey ||
      apiKey.length < 20 ||
      /^(MY_|your_|placeholder|changeme|example|test|xxx)/i.test(apiKey) ||
      apiKey.includes('your_gemini');

    if (isPlaceholderKey) {
      return NextResponse.json(
        {
          error: 'Gemini AI tidak terhubung: GEMINI_API_KEY belum dikonfigurasi di server.',
          errorCode: 'API_KEY_MISSING',
          reason:
            'Variabel lingkungan GEMINI_API_KEY kosong atau masih menggunakan nilai placeholder. FitForge tidak menampilkan data nutrisi buatan agar tidak memberi informasi gizi yang keliru.',
          hint: 'Tambahkan GEMINI_API_KEY yang valid pada panel Secrets / file .env.local lalu muat ulang server.',
          modelAttempted: primaryModel,
        },
        { status: 503 }
      );
    }

    const ai = new GoogleGenAI({
      apiKey,
      httpOptions: {
        headers: {
          'User-Agent': 'aistudio-build',
        },
      },
    });

    const parts: Array<{ text: string } | { inlineData: { mimeType: string; data: string } }> = [];
    if (imageBase64) {
      const cleanBase64 = imageBase64.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
      parts.push({
        inlineData: {
          mimeType: mimeType || 'image/jpeg',
          data: cleanBase64,
        },
      });
    }

    const promptText = imageBase64
      ? `Analisis foto makanan/minuman ini secara JUJUR, kritis, dan ilmiah (petunjuk pengguna: "${
          trimmedHint || 'Tidak ada teks tambahan, analisis langsung dari visual foto'
        }").`
      : `Analisis kandungan gizi dari makanan/minuman berikut secara JUJUR, kritis, dan akurat: "${trimmedHint}".`;

    parts.push({
      text: `${promptText}

INSTRUKSI WAJIB (JANGAN BERIKAN JAWABAN DEFAULT ATAU BASA-BASI):
1. Jika input teks atau gambar sama sekali BUKAN makanan/minuman manusia (misal: benda mati, elektronik, pemandangan kosong, teks acak), set "is_food" = false dan jelaskan alasannya di "non_food_reason".
2. Hitung estimasi kalori (kkal), protein (g), karbohidrat (g), lemak (g), serat (g), gula (g), dan natrium (mg) berdasarkan rincian tiap bahan makanan di dalamnya ("ingredients_breakdown"). Pastikan total kalori & makro konsisten secara matematis dengan penjumlahan komponennya.
3. Berikan penilaian JUJUR tanpa memanis-maniskan ("honest_verdict" dan "health_score" 1-10):
   - Jika makanan tinggi minyak/gorengan, tinggi tepung/gula (misal: mie instan dobel, martabak manis, seblak kerupuk, es kopi susu manis, gorengan), beri skor rendah (2-5), sebutkan risiko lemak jenuh/natrium/lonjakan gula darah secara blak-blakan.
   - Jika makanan tinggi protein berkualitas & gizi seimbang (misal: dada ayam bakar, ikan, telur, tempe, sayur), beri skor tinggi (8-10) dan jelaskan manfaatnya bagi sintesis protein otot.
4. Gunakan Bahasa Indonesia yang jelas, tajam, dan praktis untuk pengguna aplikasi kebugaran.`,
    });

    const responseSchema = {
      type: Type.OBJECT,
      properties: {
        is_food: {
          type: Type.BOOLEAN,
          description: 'True jika gambar atau teks adalah makanan/minuman manusia.',
        },
        non_food_reason: {
          type: Type.STRING,
          description: 'Alasan jika bukan makanan (kosongkan jika is_food true).',
        },
        food_name: {
          type: Type.STRING,
          description: 'Nama lengkap hidangan yang teridentifikasi secara spesifik.',
        },
        portion_estimate: {
          type: Type.STRING,
          description: 'Estimasi berat (gram/ml) dan ukuran porsi realistis.',
        },
        calories_kcal: {
          type: Type.NUMBER,
          description: 'Total energi dalam kilokalori (kkal).',
        },
        protein_g: {
          type: Type.NUMBER,
          description: 'Total protein dalam gram.',
        },
        carbs_g: {
          type: Type.NUMBER,
          description: 'Total karbohidrat dalam gram.',
        },
        fat_g: {
          type: Type.NUMBER,
          description: 'Total lemak dalam gram.',
        },
        fiber_g: {
          type: Type.NUMBER,
          description: 'Total serat pangan dalam gram.',
        },
        sugar_g: {
          type: Type.NUMBER,
          description: 'Estimasi kandungan gula dalam gram.',
        },
        sodium_mg: {
          type: Type.NUMBER,
          description: 'Estimasi kandungan natrium/garam dalam miligram.',
        },
        health_score: {
          type: Type.INTEGER,
          description: 'Skor kesehatan jujur dari 1 (sangat buruk/junk food) sampai 10 (sangat sehat/atletis).',
        },
        honest_verdict: {
          type: Type.STRING,
          description: 'Ringkasan vonis jujur 1-2 kalimat mengenai kualitas gizi makanan ini.',
        },
        ingredients_breakdown: {
          type: Type.ARRAY,
          description: 'Rincian komponen bahan makanan dalam porsi tersebut.',
          items: {
            type: Type.OBJECT,
            properties: {
              item: { type: Type.STRING },
              amount: { type: Type.STRING },
              calories_kcal: { type: Type.NUMBER },
              protein_g: { type: Type.NUMBER },
            },
            required: ['item', 'amount', 'calories_kcal', 'protein_g'],
          },
        },
        local_indonesian_tips: {
          type: Type.STRING,
          description: 'Saran modifikasi praktis untuk mencapai target otot/defisit kalori.',
        },
      },
      required: [
        'is_food',
        'food_name',
        'portion_estimate',
        'calories_kcal',
        'protein_g',
        'carbs_g',
        'fat_g',
        'fiber_g',
        'sugar_g',
        'sodium_mg',
        'health_score',
        'honest_verdict',
        'ingredients_breakdown',
        'local_indonesian_tips',
      ],
    };

    const candidateModels: Array<{ name: string; useThinking: boolean }> = [
      { name: 'gemini-4-hydrogen', useThinking: true },
      { name: 'gemini-3.1-flash-lite', useThinking: false },
    ];

    let jsonText = '';
    let resolvedModel = primaryModel;
    let promptTokenCount = 0;
    let candidatesTokenCount = 0;
    let thoughtsTokenCount = 0;
    let totalTokenCount = 0;
    let lastError: unknown = null;
    let lastAttemptedModel = primaryModel;

    for (const candidate of candidateModels) {
      lastAttemptedModel = candidate.name;
      try {
        const response = await ai.models.generateContent({
          model: candidate.name,
          contents: { parts },
          config: {
            ...(candidate.useThinking
              ? { thinkingConfig: { thinkingLevel: ThinkingLevel.LOW } }
              : {}),
            responseMimeType: 'application/json',
            responseSchema,
          },
        });

        const candidateText = (response.text ?? '').trim();
        if (candidateText) {
          jsonText = candidateText;
          resolvedModel = response.modelVersion || candidate.name;
          const meta = response.usageMetadata;
          promptTokenCount = meta?.promptTokenCount ?? 0;
          candidatesTokenCount = meta?.candidatesTokenCount ?? 0;
          thoughtsTokenCount = meta?.thoughtsTokenCount ?? 0;
          totalTokenCount =
            meta?.totalTokenCount ??
            promptTokenCount + candidatesTokenCount + thoughtsTokenCount;
          break;
        }
      } catch (err) {
        lastError = err;
        const msg = err instanceof Error ? err.message : String(err);
        const lower = msg.toLowerCase();
        // Do not retry secondary model if API key or network itself is broken
        if (
          lower.includes('api_key_invalid') ||
          lower.includes('api key not valid') ||
          lower.includes('permission_denied') ||
          lower.includes('401') ||
          lower.includes('403') ||
          lower.includes('fetch failed') ||
          lower.includes('enotfound') ||
          lower.includes('econnrefused') ||
          lower.includes('etimedout')
        ) {
          break;
        }
      }
    }

    if (!jsonText) {
      const diagnostic = classifyGeminiError(
        lastError ?? new Error('Respons teks kosong dari model Gemini.'),
        lastAttemptedModel
      );
      return NextResponse.json(
        {
          error: diagnostic.error,
          errorCode: diagnostic.errorCode,
          reason: diagnostic.reason,
          hint: diagnostic.hint,
          modelAttempted: diagnostic.modelAttempted,
          rawDetail: diagnostic.rawDetail,
        },
        { status: diagnostic.httpStatus }
      );
    }

    let data: Record<string, unknown>;
    try {
      data = JSON.parse(jsonText);
    } catch {
      return NextResponse.json(
        {
          error: 'Respons JSON dari Gemini AI tidak dapat diurai dengan valid.',
          errorCode: 'INVALID_AI_JSON',
          reason: 'Output terstruktur dari model terpotong atau tidak sesuai skema JSON.',
          hint: 'Klik "Coba Analisis Ulang" agar model menghasilkan ulang rincian gizi.',
          modelAttempted: resolvedModel,
        },
        { status: 502 }
      );
    }

    if (!data.is_food || data.health_score === 0) {
      return NextResponse.json(
        {
          error:
            (typeof data.non_food_reason === 'string' && data.non_food_reason) ||
            'Input atau gambar yang diberikan tidak terdeteksi sebagai makanan/minuman.',
          errorCode: 'NOT_FOOD',
          reason: 'Gemini AI memverifikasi bahwa input bukan makanan atau minuman yang dapat dikonsumsi.',
          hint: 'Masukkan nama hidangan yang jelas atau unggah foto makanan/minuman.',
          modelAttempted: resolvedModel,
          usage: {
            promptTokenCount,
            candidatesTokenCount,
            thoughtsTokenCount,
            totalTokenCount,
          },
          latencyMs: Date.now() - startedAt,
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      result: data,
      model: resolvedModel,
      source: resolvedModel,
      usage: {
        promptTokenCount,
        candidatesTokenCount,
        thoughtsTokenCount,
        totalTokenCount,
      },
      latencyMs: Date.now() - startedAt,
      analyzedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const diagnostic = classifyGeminiError(err, primaryModel);
    return NextResponse.json(
      {
        error: diagnostic.error,
        errorCode: diagnostic.errorCode,
        reason: diagnostic.reason,
        hint: diagnostic.hint,
        modelAttempted: diagnostic.modelAttempted,
        rawDetail: diagnostic.rawDetail,
      },
      { status: diagnostic.httpStatus }
    );
  }
}
