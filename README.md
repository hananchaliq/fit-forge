# FitForge — PWA Kebugaran, Studio 3D PBR, Lari GPS & Nutrisi AI Nusantara

**FitForge** adalah Progressive Web App (PWA) kebugaran dan kebiasaan harian yang menggabungkan pelacak lari GPS berfilter Kalman 1D + Haversine, Studio Latihan 3D interaktif bermodel **mannequin polos atletis bertekstur PBR lengkap dengan Mode Tulang & X-Ray**, pemindai nutrisi kuliner Indonesia **real-time berbasis Gemini AI** (transparan model & jumlah token, tanpa fallback palsu), jadwal sholat Kemenag RI, alarm bangun Mode A & notifikasi senyap Mode B, serta antarmuka **Motion UI** responsif dari `320px` hingga `1440px`.

---

## Fitur Utama

### 1. Studio Latihan 3D PBR & Mode Tulang (`/workout` & Hero `/`)
- **Mannequin 3D Polos Atletis (Botak & Tanpa Wajah)**: Model humanoid berotot proporsional dengan celana kompresi charcoal, arm sleeve kiri, wrist wrap kanan, serta anatomi kaki telanjang—sinkron antara Hero Landing (`HeroRunner3D`) dan Studio Latihan (`TrainerStudio3D`).
- **Tekstur 3D PBR 512×512 (`lib/pbrTextures.ts`)**: Normal Map tangent-space prosedural (Sobel heightfield) untuk serat otot & satin clay mannequin, tekstur tulang kortikal, anyaman kain kompresi, lantai studio, serta bayangan kontak lembut.
- **3 Mode Visualisasi Anatomi + Tubuh Fleksibel**:
  - **Otot PBR**: Sorotan otot primer (crimson) & sekunder (ember) real-time pada rig 22-tulang.
  - **X-Ray**: Kulit mannequin transparan menampilkan otot aktif sekaligus kerangka tulang yang bergerak fleksibel.
  - **Mode Tulang**: Kerangka anatomi 3D lengkap (tengkorak, 8 segmen tulang belakang fleksibel, tulang rusuk + sternum, panggul, klavikula, humerus, radius/ulna, femur, tibia/fibula, serta sendi artikulasi bercahaya).
- **Kontrol Latihan & Siklus WebGL**: Mode **Gym & Rumah**, trio blueprint (`01. PUSH-UP`, `02. SQUAT`, `03. PULL-UP`), **4-Sudut**, tempo `0.5×–1.5×`, pause otomatis saat di luar viewport (`IntersectionObserver`), dan pembersihan penuh memori GPU.

### 2. Pelacak Lari GPS Presisi Tinggi (`/run`)
- **Filter Kalman 1D & Geodesik Haversine (`lib/kalman.ts`, `lib/haversine.ts`)**: Meredam spike sinyal GPS (`accuracy > 20m` atau kecepatan tidak wajar `> 12 m/s`).
- **Checkpoint IndexedDB Tiap Detik (`lib/idb.ts`)**: Pemulihan otomatis jika browser/tab tertutup mendadak saat berlari.
- **Simulasi Rute GBK, Voice Coach Bahasa Indonesia, Screen Wake Lock, Tabel Split per KM**, serta ekspor **Kartu Bagikan Lari PNG** bergaya Obsidian + Amber.

### 3. Pemindai Nutrisi Gemini AI Real-Time (`/nutrisi`)
- **Real-Time API Tanpa Fallback Palsu (`/api/analyze-food`)**: Terhubung langsung ke **Google Gemini AI (`gemini-4-hydrogen`)** untuk menganalisis foto makanan (kompresi klien ≤ 1024px JPEG) maupun teks menu Nusantara menjadi rincian bahan, kalori, protein, karbohidrat, lemak, serat, gula, natrium, skor kesehatan 1–10, dan vonis gizi jujur.
- **Transparansi Model, Token & Latensi**: Setiap hasil analisis menampilkan nama model aktual (`modelVersion`), rincian token yang terpakai (`Total`, `Input`, `Output`, `Thinking`), serta latensi real-time (`ms`).
- **Diagnostik Error Spesifik**: Jika perangkat offline, `GEMINI_API_KEY` belum dipasang/tidak valid, kuota habis (429), atau server tidak terjangkau, aplikasi **tidak** mengembalikan data gizi palsu melainkan menampilkan kode error, penyebab spesifik, dan langkah perbaikan.
- **Dynamic Calorie Budget**: Target kalori harian otomatis menyesuaikan energi yang terbakar dari sesi lari hari ini.

### 4. Jadwal Sholat Kemenag RI, Alarm Mode A & Hidrasi (`/jadwal`)
- **Jadwal Sholat Otomatis (`lib/prayer.ts`)**: Menggunakan metode Kemenag RI sesuai kota/koordinat profil dengan hitung mundur adzan real-time dan check-in 5 waktu sholat.
- **Pemisahan Tegas Mode A vs Mode B**:
  - **Mode A (Alarm Bangun Keras)**: Synthesizer Web Audio bertahap (`lib/audio.ts`) + modal layar penuh Snooze/Matikan + konfigurasi Jam Tenang (*Quiet Hours*).
  - **Mode B (Notifikasi Senyap Web Push)**: Pengingat sholat dan hidrasi berkala (`+250ml`) tanpa audio looping.

### 5. Rencana 7 Hari, Dashboard & Analitik (`/plan`, `/dashboard`, `/analitik`)
- **Poster Rencana Split 7 Hari**: Toggle **Mode Gym / Mode Rumah** lengkap dengan ekspor poster ke gambar **PNG** (`html-to-image`).
- **Dashboard & Analitik**: Metrik telemetri tabular dengan animasi `CountUpMetric`, `ProgressRing`, grafik Recharts, serta 5 Golden Rules harian.
- **Sinkronisasi Cloud & Mode Offline**: Mendukung Firebase Auth (Google Sign-In) & Firestore, serta tetap bekerja penuh secara lokal (Zustand + IndexedDB + Service Worker PWA).

### 6. Sistem Motion UI & UX Responsif (`components/ui/MotionPrimitives.tsx`)
- Ditenagai `motion/react` dengan `<MotionConfig reducedMotion="user">` dan hanya menganimasikan properti GPU-composited (`transform`, `opacity`).
- **Scroll Progress Bar** pegas di bagian atas halaman dan paralaks cahaya ember halus pada landing page.
- **Shared-Element Sliding Pills (`layoutId`)** pada navigasi desktop, mobile dock aktif, tab latihan, preset kamera 3D, dan toggle mode Gym/Rumah.
- **Micro-Interactions Taktil**: Animasi morph ikon tema Terang/Gelap, badge melayang `+250ml` saat mencatat hidrasi, pop centang sholat, `MotionProgressBar`, serta transisi `AnimatePresence` pada hasil analisis nutrisi, daftar log/riwayat, banner recovery, dan modal.
- **Mobile-First (`320px`–`1440px`)**: `min-h-dvh`, safe-area inset notch/home-indicator, target sentuh minimal `44×44px`, dan nol horizontal overflow.

---

## Tech Stack

- **Framework**: Next.js 15 (App Router) + React 19 + TypeScript 5
- **Styling & Animasi**: Tailwind CSS v4 + `motion` (`motion/react`) + `lucide-react`
- **Grafis 3D & Chart**: Three.js (WebGL PBR) + Recharts + `html-to-image`
- **State & Storage**: Zustand + IndexedDB (`idb`) + Firebase Auth & Firestore
- **AI & Validasi**: `@google/genai` + Zod

---

## Struktur Proyek

```text
app/
├── page.tsx                  # Landing page + HeroRunner3D + paralaks Motion UI
├── dashboard/page.tsx        # Ringkasan harian, Golden Rules & metrik telemetri
├── workout/page.tsx          # Studio Latihan 3D PBR, 4-Sudut & Peta Otot 2D
├── run/page.tsx              # Pelacak Lari GPS (Kalman + Haversine + IndexedDB)
├── nutrisi/page.tsx          # Pemindai Nutrisi Gemini AI & Log Makanan Harian
├── jadwal/page.tsx           # Jadwal Sholat Kemenag RI, Mode A Alarm & Mode B Hidrasi
├── plan/page.tsx             # Poster Rencana Split 7 Hari (Gym/Rumah) + Ekspor PNG
├── analitik/page.tsx         # Grafik tren lari, nutrisi & konsistensi
├── login/ & onboarding/      # Autentikasi Google & pengaturan profil awal
├── pengaturan/               # Profil atlet, kota sholat, target kalori/air & tema
└── api/
    ├── analyze-food/route.ts # Endpoint server-side Gemini AI + fallback lokal Nusantara
    └── push/send/route.ts    # Endpoint uji notifikasi Mode B
components/
├── landing/HeroRunner3D.tsx  # Siluet pelari 3D PBR karbon & ember
├── workout3d/TrainerStudio3D.tsx # Engine studio latihan 3D PBR 22-tulang
├── layout/AppShell.tsx       # Navigasi desktop, mobile dock, Bento Hub & +250ml burst
└── ui/MotionPrimitives.tsx   # Sistem Motion UI (Spring, ScrollProgressBar, Tabs, Progress)
lib/
├── pbrTextures.ts            # Generator tekstur PBR prosedural & GPU resource disposal
├── kalman.ts & haversine.ts  # Filter GPS 1D & kalkulasi jarak/pace/kalori
├── nutritionFallback.ts      # Mesin estimasi gizi Nusantara lokal (offline-safe)
├── prayer.ts & audio.ts      # Jadwal sholat Kemenag RI & Web Audio synth Mode A
├── idb.ts & firebase.ts      # Persistensi IndexedDB & konfigurasi Firebase
└── *.test.ts                 # Unit test GPS & Nutrition Fallback
docs/audit/
├── AUDIT_FINDINGS.md         # Dokumentasi temuan audit UX/performa/3D
├── before/                   # Screenshot baseline sebelum upgrade
└── after/                    # Screenshot terverifikasi setelah upgrade (320–1440px + E2E)
```

---

## Instalasi & Menjalankan Secara Lokal

### 1. Install Dependency
Gunakan `bun` (sesuai `bun.lock`) atau `npm`:

```bash
bun install
# atau
npm install
```

### 2. Konfigurasi Environment Variable
Salin file contoh menjadi `.env.local` (jangan commit `.env.local` ke git):

```bash
cp .env.example .env.local
```

Daftar variabel di `.env.example`:
- `GEMINI_API_KEY` *(wajib untuk fitur Pemindai Nutrisi AI)* — Kunci API Gemini server-side untuk `/api/analyze-food`. Jika kosong atau tidak valid, endpoint menampilkan diagnostik error secara jujur tanpa data gizi palsu.
- `APP_URL` — URL host aplikasi (contoh: `http://localhost:3000`).
- `NEXT_PUBLIC_SUPABASE_URL` & `NEXT_PUBLIC_SUPABASE_ANON_KEY` *(opsional)* — Konfigurasi Supabase tambahan jika diperlukan.
- `VAPID_PUBLIC_KEY` & `VAPID_PRIVATE_KEY` *(opsional)* — Kunci Web Push untuk notifikasi latar belakang Mode B.

### 3. Jalankan Development Server

```bash
npm run dev
# atau
bun run dev
```

Buka `http://localhost:3000` di browser.

---

## Skrip Tersedia

| Perintah | Fungsi |
| :--- | :--- |
| `npm run dev` | Menjalankan Next.js dev server pada port `3000` (`0.0.0.0`) |
| `npm run build` | Build produksi Next.js |
| `npm run start` | Menjalankan server produksi hasil build |
| `npm run lint` | Menjalankan ESLint pada seluruh proyek |
| `npx tsc --noEmit` | Pengecekan tipe TypeScript penuh |
| `npm test` | Menjalankan unit test GPS (Kalman/Haversine) & Nutrition Fallback (`8/8` tes) |
| `npm run inspect:model` | Utilitas inspeksi model 3D (`scripts/inspect-model.mjs`) |
| `npm run clean` | Membersihkan cache build `.next` |

---

## Status Verifikasi Kualitas

- **Unit Test (`npm test`)**: `8/8` lulus (Haversine, Kalman 1D, GPS fix validator, dan estimasi gizi Nusantara fallback).
- **Static Analysis**: `npm run lint`, `npx tsc --noEmit`, dan `npm run build` lulus dengan **0 error**.
- **Audit Browser Lintas Viewport**: Terverifikasi pada **8 rute utama × 7 viewport** (`320`, `360`, `390`, `430`, `768`, `1024`, `1440` px) dengan **0 horizontal overflow**, **0 runtime console error**, dan **0 Three.js warning**.
- **Dokumentasi Audit**: Screenshot perbandingan sebelum/sesudah dan catatan teknis tersimpan di `docs/audit/`.
