# Panduan Push dan Merge

Panduan ini berlaku untuk perubahan aplikasi, database, dan tes. Branch utama proyek adalah `main`. Jangan mengembangkan perubahan langsung di `main`.

## 1. Mulai dari `main` terbaru

```bash
git switch main
git pull --ff-only origin main
git switch -c feat/nama-perubahan
```

Gunakan awalan branch yang sesuai, misalnya `feat/`, `fix/`, `docs/`, atau `chore/`.

## 2. Periksa perubahan sebelum push

Pasang dependensi dan jalankan pemeriksaan lokal:

```bash
npm ci
npm run lint
npm test
```

Build produksi dan E2E juga diperiksa CI. Build job menggunakan konfigurasi lokal khusus CI; jangan memakai URL atau kunci staging/production untuk menjalankan tes.

## 3. Commit dan push branch

```bash
git add <berkas-yang-diubah>
git commit -m "jelaskan perubahan"
git push -u origin feat/nama-perubahan
```

Jangan commit `.env.local`, service role key, password, atau secret lainnya. Jangan menjalankan fixture `supabase/ci-*.sql` terhadap staging/production. Job CI menjalankannya pada Supabase lokal disposable yang dibuat khusus untuk satu run.

## 4. Buat Pull Request ke `main`

Di GitHub, buat Pull Request dengan:

- **Base:** `main`
- **Compare:** branch kerja, misalnya `feat/nama-perubahan`
- Ringkasan perubahan dan cara pemeriksaannya.

Setiap push ke branch dan setiap Pull Request menjalankan workflow CI. Tunggu sampai dua job berikut berstatus **success**:

1. **Lint, unit tests, and production build**
2. **Supabase local database and browser E2E**

Job database membuat Supabase lokal disposable, menerapkan schema/fixture CI, menjalankan tes browser, lalu menghentikan stack. Job tersebut tidak memakai database staging maupun production.

Jika ada job gagal, buka detail job di tab **Checks** atau **Actions**, perbaiki penyebabnya, lalu push commit perbaikan ke branch Pull Request yang sama. CI akan berjalan kembali. Jangan merge saat ada check yang gagal atau masih berjalan.

## 5. Review dan merge

Setelah semua check sukses dan perubahan ditinjau, merge Pull Request ke `main` melalui GitHub. Hindari push langsung ke `main`. Setelah merge, sinkronkan salinan lokal dan hapus branch kerja bila sudah tidak diperlukan:

```bash
git switch main
git pull --ff-only origin main
git branch -d feat/nama-perubahan
```

## Pengaturan yang disarankan untuk pengelola repository

Aktifkan ruleset/proteksi branch `main` di GitHub agar Pull Request wajib melewati review dan kedua job CI di atas wajib sukses sebelum merge. Dengan begitu aturan ini ditegakkan GitHub, bukan hanya bergantung pada kebiasaan kontributor.
