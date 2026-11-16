# ASSETS_NEEDED.md — FitForge Asset & Fallback Documentation

Dokumen ini mencatat aset eksternal opsional yang memiliki **fallback prosedural aktif** di dalam kode sehingga aplikasi berjalan 100% tanpa error atau *crash* meskipun file eksternal belum dimasukkan.

## 1. Model Karakter 3D (`/public/models/trainer.glb`)
- **Status Saat Ini:** Menggunakan **Composite 12-Part Articulated Procedural Anatomical Mannequin (`THREE.Group`)** dengan kinematic bone hierarchy lengkap (Torso, Chest/Pectorals, Latissimus, Deltoids, Biceps, Triceps, Forearms, Abs, Glutes, Quadriceps, Hamstrings, Calves) dan shader PBR `onBeforeCompile` + `RoomEnvironment` PMREM.
- **Cara Mengganti dengan GLB Mixamo Asli:**
  1. Unduh karakter stok dari Adobe Mixamo (pose T) beserta animasi (`pushup`, `squat`, `lunge`, `plank`, `burpee`, `mountain_climber`, `crunch`, `glute_bridge`, `stretch_flow`, `idle`, `jog`).
  2. Gabungkan track animasi di Blender dan ekspor sebagai `/public/models/trainer.glb` (kompresi Draco/meshopt opsional).
  3. Studio 3D (`/workout`) otomatis mendeteksi keberadaan `/public/models/trainer.glb` melalui `manifest.json`. Jika file `.glb` belum tersedia di `/public/models/trainer.glb`, engine secara mulus merender Manekin Anatomi Prosedural 12-bagian dengan animasi kinematik penuh untuk seluruh 11 klip gerakan dan sorotan otot real-time.
- **Catatan Presisi Otot:** Sorotan otot pada karakter GLB tanpa mask tekstur menggunakan bobot tulang (`skinIndex`/`skinWeight`) dan arah normal vertex. Kualitas anatomi dapat ditingkatkan lebih jauh jika menggunakan model dengan *vertex color mask* atau mesh otot terpisah.

## 2. Pemetaan Klip Animasi Perkiraan (`exerciseClipMap.ts`)
Beberapa latihan kalistenik dan beban menggunakan klip gerakan terdekat dengan label **"Peragaan perkiraan"** pada UI Studio 3D:
- `decline_pushup`, `close_grip_pushup`, `bench_press`, `incline_dumbbell_press`, `chest_fly` → memakai variasi biomekanik dari `pushup`.
- `doorframe_row`, `pull_up`, `lat_pulldown`, `barbell_row`, `seated_cable_row` → memakai variasi tarikan punggung berbasis `stretch_flow` / `pull` kinematics.
- `romanian_deadlift`, `leg_press`, `leg_curl` → memakai variasi `squat` / `glute_bridge`.

## 3. Konfigurasi Backend Opsional (`.env`)
- `NEXT_PUBLIC_SUPABASE_URL` & `NEXT_PUBLIC_SUPABASE_ANON_KEY`: Jika kosong, aplikasi otomatis berjalan menggunakan penyimpanan lokal persisten (`Zustand` + `IndexedDB` + `localStorage`) yang sudah diisi dengan **Seed Data Demo Realistis 4 Minggu Terakhir**.
- `VAPID_PUBLIC_KEY` & `VAPID_PRIVATE_KEY`: Jika kosong, pengingat Sholat & Hidrasi (Mode B) menggunakan Web Notifications API lokal & Service Worker registration.
