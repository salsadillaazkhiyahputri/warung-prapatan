# Catatan Perubahan: Audit & Penyesuaian Dashboard Stok Prapatan

Dokumen ini mencatat seluruh pembaruan pada dashboard "Stok Prapatan" (Warung Prapatan) sesuai dengan aturan kerja, kontrak basis data staging, dan spesifikasi fungsional.

---

## 1. Ringkasan Perubahan

### A. Arsitektur, Validasi, & Autentikasi
1. **Validasi Bersama (`src/lib/validate.ts`)**:
   - Dibuat helper validasi ketat: `readJson`, `cleanText`, `parseInteger`, `optionalId`, `validateCalendarDate`, `dateRange`, `neutralizeExcelFormula`, `validateSupplierJenis`, `validateCategory`, `getTransactionLabel`, `mapRpcError`, dan `escapeSearchQuery`.
   - Menggunakan kelas `BusinessError` untuk melempar pesan kesalahan yang aman dan berbahasa Indonesia.
2. **Keamanan Sesi JWT & Rate Limiting (`src/lib/auth.ts`)**:
   - Token sesi JWT kini ditandatangani secara kriptografis menggunakan algoritma `HMAC-SHA256` dengan `crypto.timingSafeEqual` untuk mencegah manipulasi/pemalsuan token. Token yang tidak sah atau kedaluwarsa otomatis ditolak (`null`).
   - Penambahan `LoginRateLimiter`: membatasi maksimal 5 kali kegagalan login per username dalam 15 menit (HTTP 429).
   - Opsi cookie: `HttpOnly`, `SameSite: 'lax'`, dan `Secure` pada mode produksi.
3. **Boundary Proxy (`src/proxy.ts`)**:
   - Mengimplementasikan `proxy(request)` resmi Next.js 16 untuk memproteksi halaman (`/dashboard`, `/produk`, `/supplier`, `/riwayat`, `/opname`) dan endpoint `/api/**`.
   - Mengalihkan pengguna tanpa sesi ke `/login` dan mengalihkan pengguna yang sudah login ke `/dashboard`.
4. **Koneksi Supabase Service Role (`src/lib/supabase.ts`)**:
   - Menyediakan `getSupabaseAdmin()` (singleton) yang hanya diimpor dari kode server (`src/lib/db.ts`). Kunci service role tidak pernah bocor ke client bundle.

### B. Perbaikan Bug & Ketidakcocokan
1. **Hydration Error pada `DashboardLayout`**:
   - Menghapus inisialisasi state berbasis `window` / `sessionStorage` yang menyebabkan server merender spinner sedangkan browser langsung merender layout.
   - Initial state kini seragam antara SSR dan CSR, verifikasi token dilakukan secara asinkron di dalam `useEffect`. Peringatan hydration hilang total.
2. **Kategori Dinamis**:
   - Menghapus pembatasan statis 6 kategori di `ProdukPage`.
   - Dibuat endpoint `/api/categories` yang membaca daftar kategori aktif dari tabel `products` (termasuk "Makanan" dan "Perlengkapan"), serta opsi penambahan kategori baru.
3. **Pemberian Label Transaksi**:
   - Menerapkan pemetaan 4 label:
     - `in` + `manual` -> `Masuk`
     - `out` + `manual` -> `Keluar (manual)`
     - `out` + `opname` -> `Keluar (opname)`
     - `in` + `opname` -> `Koreksi (opname)`
   - Transaksi opname baseline menampilkan catatan "Stok awal (opname pertama)" apa adanya.

### C. Fungsionalitas Halaman & API
1. **Dashboard (`src/app/dashboard/page.tsx`)**:
   - Menghapus kartu "Transaksi hari ini".
   - Menampilkan 3 kartu: Total Produk, Stok Menipis, dan "Perlu Dihitung" (produk belum pernah dihitung atau terakhir dihitung > 14 hari berdasarkan `last_counted_at`).
   - Menyediakan daftar produk stok menipis dan daftar produk perlu dihitung.
2. **Produk (`src/app/produk/page.tsx` & `/api/products`)**:
   - Menghapus field supplier dan karton dari modal tambah/ubah produk. Semua satuan menggunakan `pcs`.
   - Menonaktifkan pengubahan stok pada modal ubah produk (stok terkunci).
   - Menghapus produk diubah menjadi soft-delete (`is_active = false`), riwayat tetap ada.
   - Pengecekan nama kembar menghasilkan error 409 `DUPLICATE_PRODUCT_NAME`.
3. **Supplier (`src/app/supplier/page.tsx` & `/api/suppliers`)**:
   - Menambahkan ringkasan KPI "Barang masuk per jenis supplier" (Utama, Cadangan, Grosir).
   - Tabel menampilkan badge Jenis Supplier dan tombol Aksi.
   - Modal Tambah dan Ubah mendukung penetapan Nama dan Jenis Supplier (`utama` | `cadangan` | `grosir`).
   - Mengunci supplier sistem "Koreksi Stok" (`is_adjustment = true`), baik di UI maupun di API (HTTP 403).
   - Nama kembar ditolak dengan HTTP 409.
4. **Riwayat Transaksi (`src/app/riwayat/page.tsx` & `/api/transactions`)**:
   - Filter tanggal kalender WIB dengan validasi ketat `dateRange` (rentang terbalik ditolak HTTP 400).
   - Catat manual stok masuk mengelompokkan supplier berdasarkan jenis dan mengecek `fn_pair_baru`. Jika pasangan baru terdeteksi, muncul dialog peringatan lunak "X belum pernah masuk dari Y. Lanjutkan?", yang jika dikonfirmasi mengirim ulang dengan `confirm_new_pair: true` dan idempotency key (`web:<uuid>`) yang sama.
   - Catat manual stok keluar mewajibkan alasan minimal 3 karakter. Stok tidak cukup ditolak dengan pesan yang menampilkan sisa stok saat ini.
   - Perubahan stok dicatat secara eksklusif lewat RPC `fn_dashboard_record_movement`, tidak pernah menggunakan UPDATE langsung.
   - Ekspor Excel dan PDF menetralkan formula injection (`=`, `+`, `-`, `@`) dan menerapkan label transaksi yang sesuai.
5. **Stok Opname (`src/app/opname/page.tsx` & `/api/opname`)**:
   - Halaman read-only dengan pemberitahuan "Opname dicatat lewat Telegram".
   - Tab 1: "Riwayat sesi" menampilkan daftar sesi dan rincian item. Item `baseline` diberi label "Hitung awal" dan menampilkan nilai koreksinya (bukan barang keluar).
   - Tab 2: "Rata-rata keluar per hari" membaca `v_keluar_per_hari` dengan filter kategori.
6. **Sidebar (`src/components/layout/Sidebar.tsx`)**:
   - Tepat lima menu: Dashboard, Produk, Supplier, Riwayat Transaksi, Stok Opname.
   - Menghilangkan badge `• Aktif` pada Header sesuai instruksi.

---

## 2. Cara Menguji (Testing Guide)

### A. Pengujian Otomatis (Unit Test)
Jalankan perintah:
```bash
npm test
```
Hasil: 34 pengujian unit pada `tests/validate.test.ts` dan `tests/rpc.test.ts` lulus 100%, mencakup validasi angka bulat, panjang teks, validitas kalender (termasuk 2026-02-31), penetral formula Excel, jenis supplier, kategori dinamis, label transaksi, dan pemetaan kode error RPC.

### B. Pemeriksaan Tipe & Build
Jalankan perintah:
```bash
npx tsc --noEmit
npm run build
```
Hasil: Kompilasi TypeScript bersih tanpa error (`exit code 0`), dan build Next.js (Turbopack) sukses menghasilkan bundle produksi untuk seluruh halaman dan API route.

---

## 3. Laporan Status Pekerjaan (Jujur & Transparan)

### 1. Yang sudah diperbaiki dan dibuktikan dengan tes atau build:
- [x] Helper validasi `src/lib/validate.ts` dan pemetaan error RPC (dibuktikan dengan 34 unit test lulus).
- [x] Deteksi tanggal tidak sah (misal 2026-02-31) dan rentang tanggal terbalik menghasilkan HTTP 400 (dibuktikan dengan unit test).
- [x] Penetral formula Excel untuk teks yang diawali `=`, `+`, `-`, `@` (dibuktikan dengan unit test).
- [x] Pembatasan jenis supplier (`utama`, `cadangan`, `grosir`) dan kategori dinamis (dibuktikan dengan unit test).
- [x] Keempat label transaksi (Masuk, Keluar (manual), Keluar (opname), Koreksi (opname)) (dibuktikan dengan unit test).
- [x] Pemetaan RPC `INSUFFICIENT_STOCK`, `SUPPLIER_REQUIRED`, `PRODUCT_NOT_FOUND`, dan duplikasi idempotensi (dibuktikan dengan unit test).
- [x] Kompilasi TypeScript `npx tsc --noEmit` lolos bersih tanpa kesalahan tipe.
- [x] Build produksi `npm run build` sukses mengompilasi seluruh 22 rute dan middleware proxy.

### 2. Yang diubah tetapi membutuhkan verifikasi langsung di browser terhadap database staging:
- [ ] Pengalihan otomatis middleware `proxy.ts` ketika cookie `warung_session` dihapus di browser sungguhan.
- [ ] Dialog peringatan lunak `fn_pair_baru` saat kombinasi produk dan supplier baru pertama kali dimasukkan dari antarmuka web.
- [ ] Responsivitas klik tombol ekspor Excel dan PDF di browser client untuk mengunduh berkas laporan biner.
- [ ] Tampilan data riwayat sesi stok opname riil dari database Supabase staging.

### 3. Yang tidak cocok dengan kontrak database atau butuh keputusan manusia:
- **Tabel `xlsx` pada dependensi**: Hasil `npm audit` melaporkan 1 temuan tingkat tinggi (High Severity) pada library `xlsx` terkait Prototype Pollution & ReDoS. Karena ekspor file spreadsheet di aplikasi ini menggunakan library `exceljs` yang lebih modern dan aman, paket `xlsx` dapat dipertimbangkan untuk di-uninstall jika bot Telegram atau script lain tidak menggunakannya.
