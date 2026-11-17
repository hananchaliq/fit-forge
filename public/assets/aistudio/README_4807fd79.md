# Fitness 3D Blueprint Pack

Paket ini berisi spesifikasi terstruktur untuk membangun **3 model gerakan**: push-up, bodyweight squat, dan pull-up.

## Isi paket
- `models/01_push_up.json` — anatomi, rig, keyframe, kamera, dan pemeriksaan gerak push-up.
- `models/02_squat.json` — spesifikasi bodyweight squat.
- `models/03_pull_up.json` — spesifikasi pull-up.
- `prompts/AI_BUILD_PROMPT.md` — prompt induk untuk AI 3D / AI coding agent.
- `reference_blueprint.png` — gambar blueprint visual referensi.

## Cara pakai
1. Unggah ZIP ini ke AI 3D atau AI agent yang dapat membuat mesh, rig, dan animasi.
2. Minta AI membaca `prompts/AI_BUILD_PROMPT.md` terlebih dahulu.
3. Minta AI memproses setiap JSON di folder `models/` sebagai spesifikasi terpisah.
4. Minta hasil ekspor `.glb` dan `.fbx`, beserta file proyek native jika didukung.
5. Periksa hasil rig, kontak tangan/kaki, deformasi sendi, dan kelancaran loop sebelum dipakai.

## Catatan penting
File JSON adalah **spesifikasi blueprint**, bukan mesh 3D jadi. Paket ini belum berisi file `.glb`, `.fbx`, atau skeleton yang sudah dirig. AI 3D masih harus membangun aset tersebut dari spesifikasi ini.

Dimensi tubuh pada poster referensi tidak dipakai sebagai ukuran wajib. Gunakan proporsi anatomi netral dan konsisten. Untuk pull-up, gunakan hanya palang yang terpasang dengan benar dan memiliki rating beban yang sesuai.
