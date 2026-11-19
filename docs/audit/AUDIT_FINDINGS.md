# Audit Baseline FitForge — Fase 0, 1 & 2

Dokumen ini mencatat hasil pemetaan arsitektur, pengujian baseline (`eslint`, `tsc --noEmit`, `node:test`, `next build`), serta temuan audit jujur dan spesifik (file, baris, penyebab) **sebelum** perubahan upgrade UI/UX, responsif, dan 3D diterapkan pada branch `feat/ui-upgrade`.

---

## 1. Peta Arsitektur & Stack Terverifikasi (Fase 0)

- **Framework**: Next.js `15.4.9` (App Router, `output: 'standalone'`), React `19.2.1`, TypeScript `5.9.3`.
- **Styling & Animasi**: Tailwind CSS v4 (`@tailwindcss/postcss` `4.1.11`, `tw-animate-css`), `motion` (`12.23.24`), `lucide-react` (`0.553.0`).
- **3D & Grafis**: `three` (`0.187.0` + `RoomEnvironment`, `OrbitControls`), `recharts` (`3.10.1`), `html-to-image` (`1.11.13`), peta anatomi SVG 2D (`components/plan/BodyHighlighter2D.tsx`).
- **State & Persistensi**: Zustand (`5.1.0` + `persist` ke `localStorage`), Firebase (`13.3.0` Auth + Firestore), IndexedDB (`idb` `8.0.4`) untuk checkpoint GPS per detik.
- **AI**: `@google/genai` (`3.4.0`) di `/app/api/analyze-food/route.ts`.
- **PWA**: `/app/manifest.ts` (`/manifest.webmanifest`) + `/public/sw.js` (precache offline + Web Push senyap Mode B).
- **Rute Kritis (tidak boleh rusak)**:
  - `/` (Landing + `HeroRunner3D`)
  - `/dashboard` (KPI harian, Recharts AreaChart & PieChart, rencana hari ini, 5 Golden Rules, countdown sholat)
  - `/run` (Pelacak Lari GPS Kalman 1D + Haversine + IndexedDB recovery + simulasi GBK + kartu PNG)
  - `/workout` (Studio 3D Anatomi Otot + 22-bone IK + 4-angle blueprint + scrubber 5 keyframe + rest timer + peta 2D)
  - `/nutrisi` (Pemindai Nutrisi Gemini AI foto/teks + rincian bahan + budget kalori dinamis dari lari)
  - `/jadwal` (Jadwal Sholat Kemenag RI + Mode A Alarm Web Audio + Mode B Push Hidrasi +250ml)
  - `/plan` (Poster Rencana Mingguan 7 Hari Gym/Rumah + ekspor PNG)
  - `/analitik` (Volume mingguan, tren protein, tabel progressive overload)
  - `/pengaturan`, `/login`, `/onboarding`, `/about/credits`

---

## 2. Hasil Baseline (Fase 1)

| Pemeriksaan | Status Baseline | Catatan |
| --- | --- | --- |
| `npm test` (`lib/gps.test.ts`) | **PASS (4/4)** | Haversine, Kalman 1D, GPS validator, pace/calorie helper lolos. |
| `npx eslint .` | **PASS (0 error)** | Bersih pada baseline. |
| `npx tsc --noEmit` | **PASS (0 error)** | Bersih pada baseline. |
| `npm run build` | **PASS** | Production build sukses. |
| `dev` script port binding | **Perlu perbaikan** | `next dev` belum mengikat `-p 3000 -H 0.0.0.0` secara eksplisit. |
| `.env.local` & API Fallback | **Perlu perbaikan** | `/app/api/analyze-food/route.ts:56-65` langsung mengembalikan HTTP 500 bila `GEMINI_API_KEY` kosong/placeholder `MY_GEMINI_API_KEY` sehingga UI nutrisi tidak bisa diuji lokal tanpa key. |
| Screenshot Baseline | **Tersimpan** | `/docs/audit/before/` pada viewport `320, 360, 390, 430, 768, 1024, 1440 px`. |

---

## 3. Temuan Audit Spesifik (Fase 2)

### A. Tabrakan Layout, Overflow & Pemotongan Teks

1. **Tabrakan Brand Header di Viewport `320px`**
   - **Lokasi**: `components/layout/AppShell.tsx:176-372`
   - **Penyebab**: Baris atas header (`h-16`) menampung logo + teks `FitForge`, tombol Search, `PWAInstallButton`, Theme Toggle, Bell, dan tombol Masuk secara bersamaan tanpa menyembunyikan label atau menyesuaikan jarak pada `< 380px`. Pada screenshot `docs/audit/before/nutrisi-320.png`, teks `FitForge` tertimpa langsung oleh ikon tombol Search (`Fit[🔍]e`).
2. **Grid 5 Kolom Makro Nutrisi Terjepit di `320px–390px`**
   - **Lokasi**: `app/nutrisi/page.tsx:411`
   - **Penyebab**: `grid-cols-5 gap-2` memaksa 5 kotak makro (Kalori, Protein, Karbo, Lemak, Serat) berjejer pada lebar 280px konten mobile (~50px per kotak), membuat angka besar dan label terpotong atau turun baris janggal.
3. **Metrik Jarak & Durasi Lari Berpotensi Overflow pada `320px`**
   - **Lokasi**: `app/run/page.tsx:539`
   - **Penyebab**: `text-5xl sm:text-6xl` untuk jarak + `text-2xl sm:text-3xl` untuk durasi dalam flex satu baris tanpa `flex-wrap` dan tanpa tipografi `clamp()`.
4. **Halaman Konten Kosong Saat First Paint / SSR (`opacity: 0`)**
   - **Lokasi**: `components/layout/AppShell.tsx:492-496` dan `app/page.tsx:148-153`
   - **Penyebab**: Wrapper utama menggunakan `motion.div` dengan `initial={{ opacity: 0, y: 10 }}` pada SSR initial render. HTML yang dikirim server memiliki inline style `opacity: 0`, membuat halaman terlihat kosong (blank) sampai seluruh bundle JavaScript selesai diunduh dan dihidrasi (merusak LCP dan pengalaman pengguna jaringan lambat).

### B. Ergonomi Mobile, Safe-Area & Touch Target

1. **Penggunaan `min-h-screen` (`100vh`) alih-alih `min-h-dvh`**
   - **Lokasi**: `components/layout/AppShell.tsx:170`, `app/page.tsx:67`, `app/login/page.tsx:129`, `app/onboarding/page.tsx:109`
   - **Penyebab**: `100vh` pada Safari iOS / Chrome Mobile tidak memperhitungkan dynamic URL toolbar sehingga memicu scroll berlebih atau elemen bawah terpotong.
2. **Bottom Navigation & Sticky Header Belum Memakai `env(safe-area-inset-*)`**
   - **Lokasi**: `components/layout/AppShell.tsx:174`, `components/layout/AppShell.tsx:459`, `components/layout/AppShell.tsx:557`, `components/layout/AppShell.tsx:680`
   - **Penyebab**: Bottom dock `fixed bottom-2.5` dan bottom sheet `fixed bottom-20` tidak menambahkan `env(safe-area-inset-bottom)` sehingga bersinggungan dengan home indicator iPhone/Android gesture bar. Padding bawah `<main>` (`pb-28`) juga belum memperhitungkan safe-area inset.
3. **Touch Target Di Bawah Standar `44×44 px` (Terdeteksi 12–34 elemen per halaman pada 390px)**
   - **Lokasi**:
     - `components/layout/AppShell.tsx:236-295` (tombol Search, Theme, Bell hanya `p-2` = `34×34px`), `components/layout/AppShell.tsx:570-588` (tombol close Bento Hub hanya `p-1` = `24×24px`).
     - `components/pwa/PWAInstallButton.tsx` (tinggi tombol `29px`).
     - `app/page.tsx:96-135` (tombol header `32px`).
     - `app/dashboard/page.tsx:271` (tombol `+250ml` hanya `py-1`).
     - `app/workout/page.tsx:346-470` (preset kamera & tombol pose keyframe di bawah `44px`).
     - `app/run/page.tsx:680` (tombol hapus sesi hanya `p-1.5`).

### C. Performa, Console Warning/Error & Memory Leak (3D & GPS)

1. **Peringatan Depresiasi Three.js di Console**
   - **Lokasi**: `components/landing/HeroRunner3D.tsx:251`
   - **Penyebab**: `new THREE.Clock()` menghasilkan warning `THREE.Clock: This module has been deprecated. Please use THREE.Timer instead.` pada Three.js `0.187.0`.
2. **Kebocoran Memori GPU (Resource Disposal Tidak Lengkap) pada Kedua Canvas 3D**
   - **Lokasi**: `components/workout3d/TrainerStudio3D.tsx:2814-2819` dan `components/landing/HeroRunner3D.tsx:307-314`
   - **Penyebab**: Cleanup `useEffect` hanya memanggil `renderer.dispose()` tanpa men-traverse `scene` untuk memanggil `.dispose()` pada seluruh `BufferGeometry`, `Material`, dan `Texture` (`scene.environment`, tekstur prosedural), serta tidak mendaftarkan listener `webglcontextlost` / `webglcontextrestored`.
3. **Render Loop 3D Tidak Berhenti Saat Off-Screen / Tab Tidak Aktif / `prefers-reduced-motion`**
   - **Lokasi**: `components/workout3d/TrainerStudio3D.tsx:2739-2802` dan `components/landing/HeroRunner3D.tsx:274-305`
   - **Penyebab**: `requestAnimationFrame` terus merender 60 FPS meskipun pengguna menggulir melewati canvas (`IntersectionObserver` tidak ada) atau berpindah tab (`document.visibilityState`), menguras baterai mobile dan CPU.
4. **Kontrol Sentuh 3D Mengganggu Scroll Halaman Mobile**
   - **Lokasi**: `components/workout3d/TrainerStudio3D.tsx:2844-2848`
   - **Penyebab**: Container OrbitControls tidak mengatur `touch-action` secara adaptif atau batas zoom/polar yang ramah mobile sehingga usapan vertikal di layar kecil sering tertangkap sebagai orbit kamera.
5. **Material 3D Masih Polos Tanpa Peta Tekstur Mikro PBR & Transisi Otot Seketika**
   - **Lokasi**: `components/workout3d/TrainerStudio3D.tsx:440-520, 1566-1618` dan `components/landing/HeroRunner3D.tsx:82-104`
   - **Penyebab**: Material kulit/otot belum memiliki procedural normal/roughness micro-texture (terkesan agak halus/seragam) dan perubahan sorotan otot menggunakan snap langsung (`setHex`) tanpa interpolasi halus (`lerp`) antar frame.
6. **Tidak Ada Error Boundary Khusus Canvas 3D**
   - **Lokasi**: `app/workout/page.tsx` dan `app/page.tsx`
   - **Penyebab**: Jika konteks WebGL gagal saat runtime (bukan saat inisialisasi), tidak ada React Error Boundary yang menangkap error secara anggun dengan fallback ilustrasi/peta otot 2D.

### D. Inkonsistensi Desain, Tipografi & Keamanan Konfigurasi

1. **Design Tokens Terpecah & Font Monospace Telemetri Belum Terdefinisi**
   - **Lokasi**: `app/globals.css:4-52` dan `app/layout.tsx:7-17`
   - **Penyebab**: Skala spacing, radius, durasi motion, easing curve, dan warna permukaan berlapis masih ditulis hardcode (`#161616`, `#141414`, `#121214`, `#0B1324`) di berbagai file. Angka telemetri belum memiliki font monospace khusus (`JetBrains_Mono`).
2. **Keamanan & Konfigurasi**:
   - `firebase-applet-config.json` berisi konfigurasi klien publik Firebase (`apiKey`, `projectId`, `appId`) yang memang bersifat publik di sisi browser (dilindungi oleh `firestore.rules` dan Authorized Domains), namun tetap wajib dicatat pada laporan akhir bersama status `GEMINI_API_KEY` yang harus dikonfigurasi via `.env.local` / server secrets.
   - `prefers-reduced-motion` dan `prefers-color-scheme` belum terhubung secara otomatis pada `MotionConfig` maupun initial theme sync.
