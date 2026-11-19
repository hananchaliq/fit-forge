export interface IngredientItem {
  item: string;
  amount: string;
  calories_kcal: number;
  protein_g: number;
}

export interface NutritionAnalysisData {
  is_food: boolean;
  non_food_reason?: string;
  food_name: string;
  portion_estimate: string;
  calories_kcal: number;
  protein_g: number;
  carbs_g: number;
  fat_g: number;
  fiber_g: number;
  sugar_g: number;
  sodium_mg: number;
  health_score: number;
  honest_verdict: string;
  ingredients_breakdown: IngredientItem[];
  local_indonesian_tips: string;
}

interface PresetMeal {
  keywords: string[];
  data: NutritionAnalysisData;
}

const NON_FOOD_PATTERNS = [
  'sepatu', 'laptop', 'hp', 'handphone', 'mobil', 'motor', 'kursi', 'meja', 'batu', 'kertas', 'kunci', 'keyboard', 'baju', 'tas',
];

const INDONESIAN_MEAL_PRESETS: PresetMeal[] = [
  {
    keywords: ['dada ayam', 'ayam bakar', 'ayam panggang', 'nasi merah', 'brokoli', 'meal prep'],
    data: {
      is_food: true,
      food_name: 'Nasi Merah, Dada Ayam Bakar & Tumis Sayur',
      portion_estimate: '1 piring seimbang (±420 g)',
      calories_kcal: 540,
      protein_g: 46,
      carbs_g: 56,
      fat_g: 12,
      fiber_g: 7,
      sugar_g: 4,
      sodium_mg: 620,
      health_score: 9,
      honest_verdict:
        'Profil makro sangat kuat untuk pemulihan otot: tinggi protein tanpa lemak, karbohidrat kompleks stabil, dan rendah lemak jenuh.',
      ingredients_breakdown: [
        { item: 'Dada ayam panggang tanpa kulit', amount: '150 g', calories_kcal: 248, protein_g: 40 },
        { item: 'Nasi merah kukus', amount: '160 g', calories_kcal: 192, protein_g: 4 },
        { item: 'Tumis brokoli & wortel (sedikit minyak)', amount: '110 g', calories_kcal: 100, protein_g: 2 },
      ],
      local_indonesian_tips:
        'Tambahkan 1 potong tempe kukus/panggang (+9g protein) bila baru menyelesaikan sesi angkat beban berat.',
    },
  },
  {
    keywords: ['padang', 'rendang', 'tunjang', 'gulai', 'nasi rames'],
    data: {
      is_food: true,
      food_name: 'Nasi Padang Rendang Sapi & Sayur Daun Singkong',
      portion_estimate: '1 bungkus standar (±460 g)',
      calories_kcal: 790,
      protein_g: 31,
      carbs_g: 86,
      fat_g: 34,
      fiber_g: 5,
      sugar_g: 6,
      sodium_mg: 1280,
      health_score: 6,
      honest_verdict:
        'Protein cukup baik dari daging sapi, namun lemak jenuh santan dan karbohidrat nasi putih sangat tinggi sehingga mudah melampaui defisit kalori.',
      ingredients_breakdown: [
        { item: 'Nasi putih porsi padang', amount: '220 g', calories_kcal: 286, protein_g: 5 },
        { item: 'Rendang daging sapi & bumbu santan', amount: '95 g', calories_kcal: 295, protein_g: 21 },
        { item: 'Sayur daun singkong & kuah gulai', amount: '90 g', calories_kcal: 135, protein_g: 4 },
        { item: 'Sambal ijo berminyak', amount: '30 g', calories_kcal: 74, protein_g: 1 },
      ],
      local_indonesian_tips:
        'Minta setengah nasi, tanpa kuah gulai berlebih, dan ganti/tambah telur dadar atau ayam pop tanpa kulit agar protein naik di atas 40g.',
    },
  },
  {
    keywords: ['mie instan', 'indomie', 'mie goreng', 'seblak', 'bakmi'],
    data: {
      is_food: true,
      food_name: 'Mie Goreng Instan & Telur Ceplok',
      portion_estimate: '1 piring (±240 g)',
      calories_kcal: 560,
      protein_g: 16,
      carbs_g: 62,
      fat_g: 26,
      fiber_g: 3,
      sugar_g: 9,
      sodium_mg: 1540,
      health_score: 4,
      honest_verdict:
        'Tinggi karbohidrat olahan, lemak jenuh minyak bumbu, dan natrium (>65% batas harian), sementara serat dan protein masih kurang untuk target otot.',
      ingredients_breakdown: [
        { item: 'Mie instan goreng + minyak bumbu', amount: '85 g kering', calories_kcal: 410, protein_g: 9 },
        { item: 'Telur ayam goreng ceplok', amount: '1 butir', calories_kcal: 110, protein_g: 6 },
        { item: 'Bawang goreng & kecap manis', amount: '15 g', calories_kcal: 40, protein_g: 1 },
      ],
      local_indonesian_tips:
        'Pakai setengah bumbu saja untuk memangkas natrium, tambahkan 2 butir telur rebus dan segenggam sawi hijau agar kenyang lebih lama.',
    },
  },
  {
    keywords: ['sate', 'lontong', 'bumbu kacang', 'gado'],
    data: {
      is_food: true,
      food_name: 'Sate Ayam Madura (8 Tusuk) + Lontong',
      portion_estimate: '1 porsi (±340 g)',
      calories_kcal: 615,
      protein_g: 36,
      carbs_g: 58,
      fat_g: 25,
      fiber_g: 4,
      sugar_g: 14,
      sodium_mg: 940,
      health_score: 7,
      honest_verdict:
        'Sumber protein padat dari dada/paha ayam panggang, namun saus kacang dan kecap manis menyumbang lemak serta gula tambahan yang cukup tinggi.',
      ingredients_breakdown: [
        { item: 'Daging ayam panggang (8 tusuk)', amount: '140 g', calories_kcal: 245, protein_g: 30 },
        { item: 'Lontong beras', amount: '120 g', calories_kcal: 156, protein_g: 3 },
        { item: 'Bumbu kacang & kecap manis', amount: '70 g', calories_kcal: 214, protein_g: 3 },
      ],
      local_indonesian_tips:
        'Pesan sate daging dada tanpa kulit dan pisahkan bumbu kacang (pakai 1–2 sendok makan saja) untuk menghemat ~120 kkal.',
    },
  },
  {
    keywords: ['martabak', 'gorengan', 'bakwan', 'risol', 'es kopi', 'boba', 'donat'],
    data: {
      is_food: true,
      food_name: 'Jajanan Tinggi Gula / Gorengan Nusantara',
      portion_estimate: '2 potong / 1 gelas (±210 g)',
      calories_kcal: 580,
      protein_g: 9,
      carbs_g: 74,
      fat_g: 27,
      fiber_g: 2,
      sugar_g: 34,
      sodium_mg: 480,
      health_score: 3,
      honest_verdict:
        'Padat energi dari tepung rafinasi, gula tambahan, dan minyak goreng; cepat memicu lonjakan gula darah dengan kontribusi protein sangat minimal.',
      ingredients_breakdown: [
        { item: 'Adonan tepung & minyak/margarin', amount: '140 g', calories_kcal: 410, protein_g: 7 },
        { item: 'Gula / susu kental manis / topping', amount: '70 g', calories_kcal: 170, protein_g: 2 },
      ],
      local_indonesian_tips:
        'Imbangi dengan sesi jalan cepat 30 menit atau kurangi porsi nasi di makan berikutnya, dan prioritaskan protein tanpa lemak (telur/dada ayam).',
    },
  },
  {
    keywords: ['soto', 'rawon', 'sop', 'bakso'],
    data: {
      is_food: true,
      food_name: 'Soto Ayam Kuah Bening + Telur Rebus & Nasi',
      portion_estimate: '1 mangkuk + nasi sedang (±430 g)',
      calories_kcal: 510,
      protein_g: 30,
      carbs_g: 60,
      fat_g: 15,
      fiber_g: 4,
      sugar_g: 3,
      sodium_mg: 1120,
      health_score: 8,
      honest_verdict:
        'Hidangan hangat seimbang dengan kuah bening rendah lemak dan protein solid dari suwiran ayam serta telur rebus; perhatikan asupan natrium kuah.',
      ingredients_breakdown: [
        { item: 'Ayam suwir + 1 butir telur rebus', amount: '130 g', calories_kcal: 205, protein_g: 24 },
        { item: 'Nasi putih porsi sedang + soun', amount: '160 g', calories_kcal: 215, protein_g: 4 },
        { item: 'Kuah soto kunyit, kol & tauge', amount: '140 g', calories_kcal: 90, protein_g: 2 },
      ],
      local_indonesian_tips:
        'Hindari koya berlebih dan kerupuk goreng; tambah jeruk nipis serta potongan ayam suwir ekstra untuk rasio protein optimal.',
    },
  },
  {
    keywords: ['tempe', 'tahu', 'telur', 'warteg', 'oreg', 'pecel'],
    data: {
      is_food: true,
      food_name: 'Paket Warteg Tinggi Protein (Nasi, Tempe, Telur & Sayur)',
      portion_estimate: '1 piring (±400 g)',
      calories_kcal: 565,
      protein_g: 32,
      carbs_g: 64,
      fat_g: 19,
      fiber_g: 7,
      sugar_g: 5,
      sodium_mg: 780,
      health_score: 8,
      honest_verdict:
        'Kombinasi protein nabati-hewani yang ekonomis dan kaya serat; sangat baik untuk rutinitas harian selama minyak tumisan tidak berlebihan.',
      ingredients_breakdown: [
        { item: 'Nasi putih sedang', amount: '150 g', calories_kcal: 195, protein_g: 4 },
        { item: 'Tempe orek / panggang & tahu', amount: '110 g', calories_kcal: 190, protein_g: 15 },
        { item: 'Telur balado / rebus (2 butir)', amount: '100 g', calories_kcal: 145, protein_g: 12 },
        { item: 'Tumis kangkung / capcay', amount: '70 g', calories_kcal: 35, protein_g: 1 },
      ],
      local_indonesian_tips:
        'Pilih telur rebus/semur dan tempe bacem/kukus dibanding gorengan tepung agar lemak turun hingga 10g.',
    },
  },
];

export function analyzeFoodOfflineFallback(hint: string, hasImage: boolean): NutritionAnalysisData {
  const normalized = hint.trim().toLowerCase();

  if (normalized && !hasImage) {
    const matchedNonFood = NON_FOOD_PATTERNS.find((kw) => normalized.includes(kw));
    if (matchedNonFood) {
      return {
        is_food: false,
        non_food_reason: `Input "${hint}" terdeteksi sebagai benda non-pangan ("${matchedNonFood}"), bukan makanan atau minuman.`,
        food_name: hint,
        portion_estimate: '-',
        calories_kcal: 0,
        protein_g: 0,
        carbs_g: 0,
        fat_g: 0,
        fiber_g: 0,
        sugar_g: 0,
        sodium_mg: 0,
        health_score: 0,
        honest_verdict: 'Bukan makanan/minuman yang dapat dihitung gizinya.',
        ingredients_breakdown: [],
        local_indonesian_tips: 'Masukkan nama makanan atau unggah foto hidangan Anda.',
      };
    }
  }

  for (const preset of INDONESIAN_MEAL_PRESETS) {
    if (preset.keywords.some((kw) => normalized.includes(kw))) {
      return {
        ...preset.data,
        food_name: hint.trim().length > 4 ? hint.trim() : preset.data.food_name,
      };
    }
  }

  const label = hint.trim() || 'Hidangan Seimbang Nusantara (Estimasi Visual)';
  return {
    is_food: true,
    food_name: label,
    portion_estimate: '1 porsi standar (±380 g)',
    calories_kcal: 520,
    protein_g: 28,
    carbs_g: 58,
    fat_g: 18,
    fiber_g: 6,
    sugar_g: 6,
    sodium_mg: 820,
    health_score: 7,
    honest_verdict:
      'Estimasi gizi seimbang untuk satu porsi hidangan harian. Tambahkan sumber protein tanpa lemak bila target Anda pembentukan otot.',
    ingredients_breakdown: [
      { item: 'Sumber karbohidrat pokok', amount: '160 g', calories_kcal: 210, protein_g: 4 },
      { item: 'Lauk protein utama', amount: '120 g', calories_kcal: 220, protein_g: 22 },
      { item: 'Sayuran & bumbu olahan', amount: '100 g', calories_kcal: 90, protein_g: 2 },
    ],
    local_indonesian_tips:
      'Konfigurasikan GEMINI_API_KEY di .env.local untuk analisis foto & takaran presisi real-time dari model Gemini Vision.',
  };
}
