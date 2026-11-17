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

export async function POST(req: NextRequest) {
  try {
    const ip = req.headers.get('x-forwarded-for') || 'local';
    if (!checkRateLimit(ip)) {
      return NextResponse.json(
        { error: 'Batas permintaan tercapai (maks 20 analisis/menit). Silakan tunggu sebentar.' },
        { status: 429 }
      );
    }

    const body = await req.json();
    const parsed = AnalyzeFoodSchema.safeParse(body);
    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Data input tidak valid. Ketik nama makanan atau unggah foto makanan.' },
        { status: 400 }
      );
    }

    const { imageBase64, mimeType, foodHint, description } = parsed.data;
    const trimmedHint = (foodHint || description || '').trim();

    if (!imageBase64 && !trimmedHint) {
      return NextResponse.json(
        { error: 'Silakan ketik nama makanan/minuman atau unggah foto hidangan terlebih dahulu.' },
        { status: 400 }
      );
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
      return NextResponse.json(
        {
          error:
            'Kunci API Gemini (GEMINI_API_KEY) belum dikonfigurasi di server. Periksa panel Settings > Secrets.',
        },
        { status: 500 }
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

    const candidateModels = ['gemini-4-hydrogen', 'gemini-2.5-flash', 'gemini-3-flash-preview'];
    let jsonText = '';
    let usedModel = candidateModels[0];
    let lastModelError: unknown = null;

    for (const modelName of candidateModels) {
      try {
        const isHydrogen = modelName.startsWith('gemini-4');
        const response = await ai.models.generateContent({
          model: modelName,
          contents: { parts },
          config: {
            ...(isHydrogen
              ? {
                  thinkingConfig: {
                    thinkingLevel: ThinkingLevel.LOW,
                  },
                }
              : {}),
            responseMimeType: 'application/json',
            responseSchema,
          },
        });
        const candidateText = (response.text ?? '').trim();
        if (candidateText) {
          jsonText = candidateText;
          usedModel = modelName;
          break;
        }
      } catch (err) {
        lastModelError = err;
        const msg = err instanceof Error ? err.message : String(err);
        // If API key is invalid, do not retry other models
        if (msg.includes('API_KEY_INVALID') || msg.includes('PERMISSION_DENIED') || msg.includes('403')) {
          throw err;
        }
      }
    }

    if (!jsonText && lastModelError) {
      throw lastModelError;
    }

    if (!jsonText) {
      return NextResponse.json(
        { error: 'Model Gemini AI tidak mengembalikan respons teks. Silakan coba lagi.' },
        { status: 502 }
      );
    }

    const data = JSON.parse(jsonText);
    if (!data.is_food || data.health_score === 0) {
      return NextResponse.json(
        {
          error:
            data.non_food_reason ||
            'Input atau gambar yang diberikan tidak terdeteksi sebagai makanan/minuman.',
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      result: data,
      source: usedModel,
      analyzedAt: new Date().toISOString(),
    });
  } catch (err: unknown) {
    const rawMsg = err instanceof Error ? err.message : String(err);
    console.error('[analyze-food] Gemini API error:', rawMsg);

    if (rawMsg.includes('API_KEY_INVALID') || rawMsg.includes('PERMISSION_DENIED') || rawMsg.includes('403')) {
      return NextResponse.json(
        {
          error:
            'Kunci API Gemini tidak valid atau akses ditolak. Silakan periksa GEMINI_API_KEY di panel Settings > Secrets.',
        },
        { status: 403 }
      );
    }
    if (rawMsg.includes('RESOURCE_EXHAUSTED') || rawMsg.includes('429')) {
      return NextResponse.json(
        {
          error:
            'Kuota Gemini API habis (429 Resource Exhausted). Silakan coba beberapa saat lagi atau perbarui kunci API di Settings > Secrets.',
        },
        { status: 429 }
      );
    }

    return NextResponse.json(
      {
        error: `Gagal menganalisis makanan dengan Gemini AI: ${rawMsg.slice(0, 180)}`,
      },
      { status: 500 }
    );
  }
}
