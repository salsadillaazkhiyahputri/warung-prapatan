# Perubahan untuk menyambungkan dashboard ke database bot

## Yang diubah
- `src/lib/session.ts` (baru): cookie login sekarang JWT bertanda tangan (HS256, `SESSION_SECRET`). Sebelumnya cookie hanya base64 tanpa tanda tangan, sehingga bisa dipalsukan.
- `src/proxy.ts` (baru): semua halaman dan API wajib login, kecuali `/login` dan `/api/auth/login|logout`.
- `src/lib/auth.ts`: memakai session.ts, ada `unauthorized()`. Setiap route API juga memeriksa login sendiri (pertahanan berlapis).
- `src/lib/db.ts`: ditulis ulang. Hanya Supabase (tanpa fallback ke JSON lokal), hapus produk = nonaktifkan (`is_active=false`), stok tidak bisa diedit lewat produk, transaksi lewat fungsi database `fn_dashboard_record_movement`, tanggal memakai WIB, riwayat dibaca per halaman 1000 baris.
- `src/lib/supabase.ts`: hanya klien server dengan service_role; tidak lagi jatuh ke anon key.
- `api/auth/login`: pembatas 5 percobaan per 15 menit per IP dan username.
- Route produk, supplier, dan transaksi: pesan error aturan bisnis (409 nama ganda, stok tidak cukup) ditampilkan ke UI.
- `produk/page.tsx`: kolom stok di form Edit dikunci. `riwayat/page.tsx`: tombol Simpan dinonaktifkan saat proses dan setiap pembukaan form membawa kunci unik (anti catat ganda).
- `login/page.tsx`: username dan password bawaan serta kotak "Kredensial Login" dihapus.
- `produk/page.tsx`: kolom "Isi / karton", dan stok tampil "48 pcs" dengan konversi karton di bawahnya (hanya tampilan).
- `package.json`: tambah `jose`.
- `.env.example`: hanya 3 variabel. GROQ, TELEGRAM, dan NEXT_PUBLIC_APP_URL dihapus.

## Yang dihapus
- `src/app/api/bot/*` dan `src/lib/bot-nlp.ts`: bot kedua di dalam Next.js. Bot resmi adalah n8n. Webhook lama punya chat id bawaan `123456789` yang meloloskan siapa pun yang tahu angka itu.
- `data/warung_prapatan.json` dan `n8n/warung_prapatan_workflow.json`: data lokal dan workflow lama.

## Jangan dijalankan di database bot
`supabase/schema.sql` dan `supabase/seed.sql`. Trigger stok di dalamnya akan membuat stok bertambah dua kali dan seed berisi password bawaan `warung123`.

## Urutan pasang
1. SQL di Supabase: `110_dashboard_integration.sql` (setelah 000, 001, 002, 103).
2. Buat password pemilik: `node -e "console.log(require('bcryptjs').hashSync('PASSWORD_ANDA', 10))"` lalu
   `update public.users set password = '<hash>' where username = '<username pemilik>';`
3. Salin `.env.example` menjadi `.env.local` dan isi.
4. `npm install`, `npm run dev`.

## Update: supplier per produk (utama + cadangan)
- Produk punya `supplier_utama_id` (wajib) dan `supplier_cadangan_id` (opsional, beda dari utama).
- Stok masuk hanya boleh dari supplier utama/cadangan produk itu, atau "Koreksi Stok". Dijaga di database (bot dan dashboard), plus trigger di tabel transactions.
- Dashboard: form Tambah/Edit Produk punya 2 pilihan supplier; kolom Supplier di tabel produk; form Catat Manual hanya menampilkan supplier yang diizinkan; halaman Supplier punya tombol Tambah supplier.
- Bot tidak lagi membuat supplier baru otomatis: supplier harus didaftarkan di dashboard.
- SQL berurutan (staging): 103 -> 110 -> 111 (ulang selalu dari 103). Lalu 111b untuk review.

---

# Update: Tahap 1 (SQL 113) + Tahap 2 (SQL 114)

Semua kode ditulis mengikuti "kontrak database" di bawah. Kode ini **belum diuji terhadap database** (staging maupun produksi): tidak ada query atau migrasi yang dijalankan. Jalankan SQL 113 lalu 114 di staging, lalu uji manual.

## Tahap 1: jenis supplier, supplier produk dihapus, peringatan lunak
- `src/types/index.ts`: `Product` tanpa kolom supplier; `Supplier.jenis` (`'utama' | 'cadangan' | 'grosir' | null`); konstanta `SUPPLIER_JENIS`, `DEFAULT_CATEGORY` ("Lainnya"; daftar kategori tidak di-hardcode, lihat update menu di bawah). Tipe bot lama dihapus.
- `src/lib/errors.ts` (baru): `BusinessError` (sekarang punya `code`) dan `errorResponse()` untuk semua route. `db.ts` tetap mengekspor ulang `BusinessError`.
- `src/lib/validate.ts` (baru; sebelumnya belum ada): `readJson`, `cleanText`, `parseInteger`, `optionalId`, `requiredId`, `parseJenis`, `parseCategory`, `parseBoolean`, `dateRange`, `parseHistoryFilters`.
- `src/lib/stock-labels.ts` (baru, tanpa akses DB, dipakai server + UI): `classifyTransaction`, label jenis, `relativeDayLabel`, `isCountStale` (14 hari), `perDay`.
- `src/lib/db.ts`:
  - `ProductService`: tanpa embed/validasi supplier (`PRODUCT_SELECT`, `assertSupplierValid`, `toIdOrNull` dihapus). Produk baru selalu `unit = 'pcs'`; edit hanya nama, kategori, batas minimum (stok, satuan, isi karton tidak bisa diubah dari dashboard).
  - `SupplierService`: `getAll` membaca `jenis`; `create(name, jenis)` (nama ganda -> 409, tidak lagi "find or create"); `update(id, {name?, jenis?})` menolak supplier `is_adjustment` (403). `findOrCreate`/`updateName` dihapus.
  - `TransactionService`: kasus `SUPPLIER_NOT_ALLOWED`/`SUPPLIER_NOT_SET` dihapus; `isNewPair(productId, supplierId)` memanggil RPC `fn_pair_baru` (supplier "Koreksi Stok" selalu dianggap bukan pasangan baru; supplier tidak ada -> 404).
- API:
  - `POST /api/suppliers` wajib `jenis`; `PUT /api/suppliers/[id]` menerima `name` dan/atau `jenis`.
  - `POST/PUT /api/products`: field supplier dan karton diabaikan; `category` divalidasi ke kategori yang ada di tabel produk + "Lainnya", bawaan "Lainnya".
  - **Baru** `GET /api/transactions/pair-check?product_id=&supplier_id=` -> `{ is_new: boolean }`.
  - `POST /api/transactions`: field opsional `confirm_new_pair`. Untuk `in` dengan pasangan baru dan tanpa konfirmasi -> 409 `{ code: 'NEW_PAIR', error: 'Belum pernah masuk dari supplier ini. Lanjutkan?' }`, tidak menyimpan apa pun. Untuk `out`, catatan (alasan) wajib 3-200 karakter.
- UI:
  - Supplier: kolom "Jenis" (badge biru/oranye/ungu), pilihan Jenis wajib di form Tambah dan Ubah, "Koreksi Stok" tampil "Sistem" dan tanpa tombol ubah.
  - Produk: kolom Supplier, Satuan, Isi/karton dan konversi karton dihapus; stok tampil "N pcs"; form tanpa supplier/satuan/karton; pilihan kategori dari `/api/products/categories`.
  - Riwayat > Catat Manual: supplier = semua supplier non-sistem per jenis (`<optgroup>`) + "Koreksi Stok"; simpan stok masuk memanggil pair-check, bila baru muncul konfirmasi "<produk> belum pernah masuk dari <supplier>. Lanjutkan?" (Ya/Batal); Ya mengirim ulang dengan `confirm_new_pair: true` dan kunci idempotensi yang sama. Keluar manual punya isian "Alasan (wajib)". Mode karton dihapus.
  - Dashboard: hanya tampilan karton yang dihapus.
- Dihapus: `src/app/api/bot/*` dan `src/lib/bot-nlp.ts` (sudah tercatat "dihapus" di atas, tetapi ternyata masih ada dan membuat `tsc` gagal). `data/` dan `n8n/` tidak disentuh.

## Tahap 2: stok opname dan laporan
> Halaman/menu `/laporan` dan `GET /api/laporan` sudah **dihapus** lagi; isinya dipindah (lihat "Update: menu dirapikan menjadi 5" di bawah). Butir yang menyebut Laporan di bagian ini hanya sejarah.
- `OpnameService.list({startDate, endDate, productId})`, `OpnameService.detail(id)`; `ReportService.keluarPerHari(category)`, `ReportService.masukPerJenis(range)`. Semua tanggal lewat `dateRange` (YYYY-MM-DD, kalender WIB, maks 1 tahun).
- **Endpoint baru** (semua wajib login, hanya GET):
  - `GET /api/opname?startDate=&endDate=&productId=` -> daftar sesi (maks 300 terbaru).
  - `GET /api/opname/[id]` -> detail sesi + item.
  - `GET /api/laporan?startDate=&endDate=&category=` -> `{ keluar_per_hari, masuk_per_jenis, belum_dihitung, range }` (rentang bawaan 30 hari terakhir).
  - `GET /api/transactions` dan `/export` menerima `kind=masuk|keluar_opname|keluar_manual|koreksi` (parameter `type=in|out` lama tetap jalan).
- Halaman baru `/opname` (menu "Stok Opname"): daftar sesi, filter tanggal + produk, modal detail (produk, stok sistem, hitungan, keluar, keluar/hari, jenis). Tanpa tombol tambah; keterangan "Opname dicatat lewat Telegram".
- Halaman baru `/laporan` (menu "Laporan"): batang horizontal barang masuk per jenis supplier (tanpa library baru), tabel keluar per hari per produk (urut terbesar, filter kategori), daftar produk yang belum/lama tidak dihitung.
- Riwayat: badge Masuk / Keluar (opname) / Keluar (manual) / Koreksi, filter jenis, ekspor Excel/PDF memakai label yang sama.
- Produk: kolom "Terakhir dihitung" (relatif; merah bila belum pernah atau > 14 hari; tooltip tanggal + hitungan).

## Tes
- `npm test` (Vitest, `tests/`): 29 tes untuk `validate.ts` dan `stock-labels.ts`.
- `npx tsc --noEmit` bersih, `next build` sukses.

## Asumsi kontrak database yang dipakai
1. **Jenis transaksi di Riwayat** diturunkan di kode (`classifyTransaction`): `out` + `source='opname'` = Keluar (opname); `out` lainnya = Keluar (manual); `in` dari supplier `is_adjustment` **atau** `in` dengan `source='opname'` = Koreksi; `in` lainnya = Masuk. Kontrak tidak menyebut bagaimana koreksi opname tercatat di `transactions` (tipe `in` lewat "Koreksi Stok"? bisa `out`?). Bila koreksi bisa bernilai negatif (`out`), saat ini akan tampil sebagai Keluar (opname).
2. Filter `source` dilakukan di kode, bukan di query, sehingga Tahap 1 tetap jalan sebelum SQL 114 (kolom `source` belum ada -> dianggap `manual`).
3. (Tidak berlaku lagi, view tidak dipakai, lihat update di bawah.) `v_keluar_per_hari` diasumsikan punya kolom **`product_id`** (kontrak hanya menyebut "per produk" + `total_keluar, total_hari, rata_per_hari, terakhir_dihitung`). Nama/kategori produk digabung dari `products` di kode.
4. `v_opname_riwayat` **tidak dipakai**: nama kolomnya (nama produk, nama pengguna, id sesi) tidak disebut persis di kontrak. Riwayat opname dibaca dari `stock_opnames` + `stock_opname_items` + `products` + `users` dan digabung di kode (tanpa embed PostgREST, jadi tidak bergantung pada nama foreign key). `keluar_per_hari` item dihitung ulang = `keluar / hari` (null bila `hari` kosong/0).
5. Produk dibaca dari tabel `products` (bukan `v_products`) dengan `select('*')`; `last_counted_at`/`last_counted_qty` diasumsikan kolom di `products` sesuai kontrak. Sebelum SQL 114 keduanya kosong -> tampil "Belum pernah".
6. `fn_pair_baru` diasumsikan mengembalikan boolean murni. Pemeriksaan pair dilewati untuk supplier `is_adjustment`.
7. Masuk per jenis supplier: hanya transaksi `in` berjenis Masuk (koreksi tidak dihitung), dikelompokkan dari `suppliers.jenis`.
8. **Stok awal produk baru** masih ditulis lewat `INSERT products.stock_current` (bukan RPC), seperti sebelumnya. Ini bukan `UPDATE`, tetapi tidak meninggalkan jejak transaksi. Bila stok awal juga harus lewat RPC, perlu diputuskan (misalnya transaksi masuk otomatis dari "Koreksi Stok").

---

# Update: menu dirapikan menjadi 5

Menu sekarang: Dashboard, Produk, Supplier, Riwayat Transaksi, Stok Opname. Halaman `/laporan`, `src/app/api/laporan` dan `ReportService` dihapus; isinya dipindah:

1. **Rata-rata keluar per hari**: tab kedua di halaman Stok Opname (tab 1 = riwayat sesi). Ada filter tanggal (bawaan 30 hari terakhir) dan kategori.
   - Endpoint baru `GET /api/opname/keluar-per-hari?startDate=&endDate=&category=` -> `{ rows, range }`.
   - `OpnameService.keluarPerHari(range, category)`. Angkanya **dihitung dari `stock_opname_items`**, bukan dari `v_keluar_per_hari`, karena view itu tetap 30 hari terakhir dan tidak bisa disaring tanggal. Rumus (helper murni `aggregateKeluarPerHari` di `stock-labels.ts`): per produk, total `keluar` ÷ total `hari` dari item ber-`created_at` dalam rentang. Item `baseline` atau tanpa `hari` tidak dihitung; item `koreksi` ikut menambah hari. Hasilnya bisa sedikit berbeda dari `v_keluar_per_hari` bila definisi view lain; silakan cocokkan dengan SQL 114.
2. **Barang masuk per jenis supplier**: ringkasan kecil (3 kotak: Utama/Cadangan/Grosir, pcs + jumlah transaksi + batang tipis) di atas tabel halaman Supplier, 30 hari terakhir, tanpa koreksi stok.
   - Endpoint baru `GET /api/suppliers/masuk-per-jenis?startDate=&endDate=` -> `{ rows, range }`; logika dipindah ke `SupplierService.masukPerJenis`.
3. **Perlu dihitung**: kartu di Dashboard menggantikan "Transaksi Hari Ini". Isinya jumlah produk aktif yang belum pernah atau lebih dari 14 hari tidak dihitung; kartu bisa diklik ke halaman Produk (kolom "Terakhir dihitung"). `DashboardStats.today_transactions_count` diganti `perlu_dihitung_count`; query hitung transaksi hari ini dihapus.

## Kategori tidak di-hardcode
- `parseCategory(value, allowed)` di `validate.ts` sekarang menerima daftar sah dari luar. Daftar itu dari `ProductService.getCategories()`: semua kategori yang ada di tabel `products` (termasuk produk nonaktif) ditambah "Lainnya". Produk lama seperti "Makanan" atau "Perlengkapan" tetap bisa diedit tanpa error.
- Endpoint baru `GET /api/products/categories` dipakai dropdown di halaman Produk dan filter kategori di Stok Opname.
- Pencocokan persis (huruf besar/kecil berpengaruh). Filter kategori di endpoint baca (GET) hanya dirapikan dengan `cleanText`, tanpa query tambahan.
- Konsekuensi: kategori baru tidak bisa dibuat dari dashboard. Hanya kategori yang sudah dipakai produk + "Lainnya" yang muncul. Lima kategori standar (Mie, Sabun, Bumbu, Minuman, Sembako) hanya muncul bila sudah ada produk yang memakainya.

## Tes
- `npm test`: 33 tes (tambahan untuk `parseCategory` dinamis dan `aggregateKeluarPerHari`).
- `npx tsc --noEmit` bersih, `npx next build` sukses.


---

# Update: perbaikan hydration error di DashboardLayout

- **Penyebab:** `DashboardLayout` menentukan state awal lewat `useState(() => ...)` yang membaca `sessionStorage` dan cache modul `isGlobalAuthKnown`. Di server hasilnya selalu "loading" (spinner), di client yang sudah login langsung "siap" (layout lengkap dengan `<aside>`), sehingga HTML server dan render pertama client berbeda.
- **Perbaikan:**
  - State awal `isAuthReady = false` di server maupun client. Cache login dibaca di `useEffect` setelah mount: bila tab ini sudah terverifikasi, isi halaman langsung ditampilkan; `/api/auth/me` tetap diperiksa di latar belakang (gagal -> ke `/login`).
  - Cache dipindah ke `src/components/layout/auth-cache.ts` (`readAuthCache`, `writeAuthCache`, `clearAuthCache`; akses `sessionStorage` dibungkus try/catch). Komentar di file itu: hanya boleh dipanggil dari `useEffect` atau event handler. Sidebar memakai `clearAuthCache()` saat logout.
  - Tampilan loading sekarang berupa kerangka layout (Sidebar + Header) dengan spinner di area konten, bukan layar penuh. Saat pindah halaman yang hanya terlihat sekejap adalah area konten, bukan seluruh layar.
  - `Header`: tanggal tetap diformat di `useEffect` (zona WIB); fallback tanggal palsu "Senin, 26 Okt 2026" diganti spasi kosong.
  - `@keyframes spin` dipindah ke `globals.css` (sebelumnya hanya ada di blok style lokal layout).
  - Tidak memakai `suppressHydrationWarning`.
- **Tes:** `tests/hydration.test.tsx` (jsdom) merender /dashboard, /produk, /supplier, /riwayat, /opname dengan `renderToString` tanpa cache, lalu `hydrateRoot` dengan cache login terisi, dan gagal bila ada error hidrasi. Tes ini gagal 5/5 dengan `DashboardLayout` versi lama dan lulus 5/5 dengan versi baru. Ditambah devDependency `jsdom`.
- **Cek browser** (dev server lokal, sesi sudah login): kelima halaman dimuat penuh, konsol tanpa pesan hydration, error, atau warning.
- `npx tsc --noEmit` bersih, `npx next build` sukses, `npm test` 38 tes lulus.

---

# Update: SQL 116-119 (barang baru dari bot, batal catat, supplier nonaktif / hapus permanen)

## Barang baru dari bot (`needs_review`)
- `Product.needs_review` dibaca dari `products` (`select('*')`; kolom ada di staging, juga di `v_products`). Normalisasi `needs_review === true`.
- API produk **tidak pernah** menerima atau menulis `needs_review`: POST/PUT membangun patch eksplisit (nama, kategori, minimum). Tanda hilang lewat trigger database.
- Produk: lencana kuning "Perlu dilengkapi" di sebelah nama; kotak centang "Perlu dilengkapi (N)" di toolbar; bisa dibuka lewat `/produk?filter=perlu-dilengkapi` (URL dibaca di `useEffect`, aman untuk hidrasi).
- Form Ubah Produk untuk barang `needs_review` yang masih "Lainnya": kotak info, pilihan kategori mulai kosong ("-- Pilih kategori --") tanpa "Lainnya", wajib dipilih. Bila belum ada kategori lain sama sekali, "Lainnya" tetap boleh (kategori baru tidak bisa dibuat dari dashboard).
- Dashboard: baris kuning "N barang perlu dilengkapi" ke `/produk?filter=perlu-dilengkapi`, tersembunyi bila 0. `DashboardStats.needs_review_count` baru.

## Riwayat
- Jenis baru `stok_awal` ("Stok awal", lencana dan angka abu-abu): `source='opname'` dan note diawali "Stok awal". Di staging baris ini bertipe `out`; sebelumnya tampil "Keluar (opname)". Ikut di filter jenis dan ekspor Excel/PDF.
- Catat Manual > stok masuk: dropdown hanya supplier **aktif** non-sistem. "Koreksi Stok" dihapus dari pilihan.
- Catatan yang dibatalkan lewat bot hilang dari `transactions`; dashboard tidak perlu diubah (tidak ada fitur batal).

## Stok masuk ditolak: pesan jelas, bukan 500
- `assertSupplierForStockIn` (db.ts) dipanggil di `POST /api/transactions` dan pair-check: supplier tidak ada 404, "Koreksi Stok" 400 (`SUPPLIER_SISTEM`), nonaktif 409 (`SUPPLIER_NONAKTIF`, "Supplier ini sedang nonaktif. Aktifkan dulu di halaman Supplier.").
- Cadangan bila database tetap menolak (balapan): error RPC `23514` berisi `SUPPLIER_NONAKTIF` -> 409; `23514` lain pada stok masuk -> 400 pesan "Koreksi Stok"; kode hasil `SUPPLIER_NONAKTIF` -> 409. Setelah error nonaktif, UI memuat ulang daftar supplier.

## Supplier: nonaktif / aktif / hapus permanen
- `SupplierService`: `getAll` membaca `is_active` dari `v_supplier_stats`; `setActive(id, bool)`; `deletePermanent(id)`. Keduanya membaca baris dulu (404 / 403 "Koreksi Stok") **sebelum** UPDATE/DELETE, dan menulis dengan penjaga `.eq('is_adjustment', false)`.
- `PATCH /api/suppliers/[id]`: body harus persis `{ "is_active": boolean }` (field lain, termasuk `is_adjustment`, -> 400). 401 / 400 id / 403 sistem / 404 / 200 + baris terbaru. `23514` -> 403.
- `DELETE /api/suppliers/[id]`: sebelumnya selalu 403; sekarang DELETE langsung tanpa menghitung transaksi. `23503` -> 409 "Supplier ini sudah punya riwayat, jadi tidak bisa dihapus. Nonaktifkan saja."; 0 baris -> 404; sistem -> 403.
- Tambah supplier dengan nama milik supplier nonaktif -> 409 dengan petunjuk untuk mengaktifkannya.
- Halaman Supplier: "N Supplier Aktif · M nonaktif", centang "Tampilkan yang nonaktif" (bawaan mati), baris nonaktif redup + lencana "Nonaktif". Aksi: Ubah, Nonaktifkan (dialog sesuai teks prompt) / Aktifkan (tanpa dialog), ikon hapus hanya bila `transaction_count = 0`. "Koreksi Stok" hanya ikon gembok. Semua tombol aksi terkunci selama satu proses berjalan (`busyId`).
- Ringkasan "Barang masuk per jenis supplier" tetap menghitung supplier nonaktif (tidak ada filter `is_active`).

## Keamanan RPC (117)
- Diperiksa: `rpc(` hanya ada di `src/lib/db.ts` (server, klien `service_role` dari `src/lib/supabase.ts`). Tidak ada halaman `'use client'` yang mengimpor `db.ts`/`supabase.ts`, dan tidak ada kunci anon di kode atau `.env.example`. Tidak ada yang perlu dipindah.

## Tes dan pemeriksaan
- `npm test`: **70 tes lulus** (5 file). Baru: `tests/suppliers-route.test.ts` (26 tes: PATCH 200 nonaktif/aktif, 401, 400 id x4, 400 body x7 termasuk field tambahan, 403 sistem tanpa UPDATE, 404, 23514->403; DELETE 200 tanpa query transaksi, 401, 400 x3, 403 tanpa DELETE, 409 dari 23503 + pesan, 404 x2), `tests/stock-in-errors.test.ts` (5 tes), tambahan `stok_awal` di `stock-labels.test.ts`.
- `npx tsc --noEmit` bersih, `npx next build` sukses.
- Hidrasi: `tests/hydration.test.tsx` 5/5 lulus. Browser (dev server lokal ke staging, sesi login): /dashboard, /produk?filter=perlu-dilengkapi, /supplier, /riwayat, /opname tanpa error atau warning di konsol. Dilihat juga: label "Stok awal" pada baris staging, dropdown stok masuk tanpa "Koreksi Stok", ikon hapus hanya pada Indomarco (0 transaksi). Kolom `products.needs_review`, `v_products.needs_review`, `suppliers.is_active`, `v_supplier_stats.is_active` ada di staging (query baca saja).
- **Belum** dicoba di browser karena mengubah data staging: nonaktifkan/aktifkan, hapus permanen, stok masuk ke supplier nonaktif. Masuk checklist D26-D29.
- `npm audit`: 12 temuan (2 critical, 1 high, 9 moderate). Produksi (`--omit=dev`) hanya `xlsx` (high, belum ada perbaikan dari SheetJS, sudah diketahui). Sisanya rantai dev vitest (`tinypool`, `@vitest/mocker`, `minimatch`), tidak ikut ke produksi.
- `eslint`: error yang tersisa sudah ada sebelumnya (`no-explicit-any` lama di db.ts, `set-state-in-effect` di semua halaman). Pembacaan URL baru di Produk sengaja memakai pola yang sama (aman untuk hidrasi).

## Checklist lembar uji (tambahan)
| No | Uji | Hasil yang diharapkan |
|---|---|---|
| D21 | Daftarkan barang baru lewat bot, buka Produk | Lencana "Perlu dilengkapi"; centang filter hanya menampilkan barang itu |
| D22 | Buka Dashboard saat ada barang D21 | Baris "1 barang perlu dilengkapi"; klik -> Produk dengan filter aktif. Saat 0, baris tidak tampil |
| D23 | Ubah barang D21: pilih kategori nyata (+ minimum), simpan | Tidak bisa disimpan tanpa kategori; setelah simpan lencana hilang dan hitungan dashboard turun. Stok masuk/keluar tidak menghapus tanda |
| D24 | Riwayat setelah opname pertama | Baris "Stok awal (opname pertama)" berlabel "Stok awal" (abu-abu), bukan "Keluar"; filter jenis "Stok awal" dan ekspor memakai label yang sama |
| D25 | Catat lewat bot lalu batalkan lewat bot | Setelah Segarkan, baris hilang dari Riwayat (dan sesi opname terkait dari Stok Opname); stok produk kembali |
| D26 | Nonaktifkan supplier | Dialog muncul; setelah dikonfirmasi baris hilang dari daftar default, tampil redup + "Nonaktif" saat "Tampilkan yang nonaktif" dicentang; tidak ada di dropdown Catat Manual; transaksi lamanya tetap tampil dengan nama supplier di Riwayat dan tetap dihitung di ringkasan per jenis |
| D27 | Aktifkan lagi supplier D26 | Tanpa dialog; kembali ke daftar default dan dropdown stok masuk |
| D28 | "Koreksi Stok" | Hanya ikon gembok, tanpa Nonaktifkan/Hapus; `PATCH`/`DELETE` langsung ke API -> 403; tidak ada di dropdown stok masuk |
| D29 | Hapus permanen | Ikon hapus hanya pada supplier dengan 0 transaksi; dialog "tidak bisa dibatalkan"; berhasil -> hilang. `DELETE` ke supplier bertransaksi -> 409 "Supplier ini sudah punya riwayat, jadi tidak bisa dihapus. Nonaktifkan saja." |

## Asumsi
1. "Stok awal" dikenali dari `source='opname'` + note diawali "Stok awal" (huruf besar/kecil diabaikan). Bila bot mengubah teks note, label kembali ke Keluar/Koreksi (opname).
2. Pesan database untuk supplier nonaktif memuat teks `SUPPLIER_NONAKTIF` di `message`/`details`/`hint`. `23514` lain pada stok masuk dianggap "Koreksi Stok".
3. "403 sebelum menyentuh database" dibaca sebagai "sebelum UPDATE/DELETE". Untuk tahu sebuah id adalah "Koreksi Stok" tetap perlu satu SELECT (`is_adjustment`); nama tidak dicocokkan.

---

# Update: SQL 120 (supplier terakhir per produk)

## Yang diubah
- `src/lib/product-suppliers.ts` (baru, tanpa akses DB): `mergeProductSuppliers` (gabung per `product_id` lewat satu Map), `toSupplierInfo`, `splitSupplierNames` (`supplier_names` -> array, terbaru dulu), `matchesProductSearch` (nama produk ATAU supplier terakhir, huruf besar/kecil diabaikan), `otherSuppliersLabel` ("+N lainnya", N = jumlah supplier selain yang terakhir).
- `src/types/index.ts`: `Product` mendapat `last_supplier_id`, `last_supplier_name`, `last_in_at`, `last_supplier_active`, `supplier_count`, `supplier_names[]`; tipe `ProductSupplierInfo`.
- `ProductService.getCatalog(q, category)` (db.ts): dua query paralel, `v_products` (aktif, filter kategori) dan `v_product_suppliers`, lalu digabung di kode. Bukan satu query per baris. Pencarian dilakukan setelah penggabungan supaya nama supplier ikut dicocokkan. Bila view belum ada (`PGRST205`/`42P01`), katalog tetap tampil dengan kolom supplier "-" dan peringatan di log server; error lain tetap dilempar (500).
- `GET /api/products` memakai `getCatalog`. `getAll` lama (tabel `products`) tetap dipakai ringkasan dashboard, jadi tidak ada query tambahan di sana. View hanya dibaca dari server (service_role).
- Produk: kolom "Supplier terakhir" setelah Kategori, berisi nama, lencana "Nonaktif" bila `last_supplier_active = false`, lencana "+N lainnya" dengan tooltip `supplier_names`, dan tanggal masuk terakhir kecil abu-abu di bawahnya. Bila belum pernah masuk, tampil "-". Placeholder pencarian: "Cari produk atau supplier...".
- Supplier: judul kolom "Kali barang masuk" dan teks bantu di bawah tabel: "Angka ini dihitung dari seluruh riwayat stok masuk, termasuk barang yang sudah dihapus dari katalog."
- Bot dan database tidak diubah.

## Tes dan pemeriksaan
- `npm test`: **82 tes lulus** (6 file). Baru `tests/product-suppliers.test.ts` (12 tes): tanpa riwayat, satu supplier, banyak supplier (count string, nama dirapikan, "+2 lainnya"), supplier nonaktif, baris produk tak dikenal diabaikan, pencarian nama/supplier/kosong; `getCatalog` tepat dua query, pencarian lewat supplier, view belum ada -> tetap tampil, error lain dilempar.
- `npx tsc --noEmit` bersih, `npx next build` sukses, eslint bersih untuk file baru.
- Hidrasi: tes 5/5 lulus. Browser (dev server lokal ke staging): kelima halaman tanpa error atau warning di konsol. Data staging: Indomie Goreng tampil "Indofood +2 lainnya" dengan tooltip "Indofood, Unilever, Wings"; `?q=unilever` mengembalikan 4 produk yang supplier terakhirnya Unilever; `?q=indofood` mengembalikan Indomie Goreng dan Indomie Soto.
- `npm audit`: tidak berubah (12 temuan; produksi hanya `xlsx` high, sisanya rantai dev vitest).
- Catatan: saat dicek pertama kali, staging menjawab `v_product_suppliers` tidak ada (cache skema PostgREST). Beberapa saat kemudian view sudah terbaca. Fallback di atas menjaga halaman Produk tetap jalan dalam jeda seperti itu.

## Checklist lembar uji (tambahan)
| No | Uji | Hasil yang diharapkan |
|---|---|---|
| D30 | Catat stok masuk produk X dari supplier A, lalu dari supplier B | Kolom "Supplier terakhir" = B dengan tanggal hari ini, "+1 lainnya"; Kali barang masuk A dan B masing-masing bertambah |
| D31 | Produk baru (atau dari bot) yang belum pernah masuk | Kolom "Supplier terakhir" tampil "-" |
| D32 | Produk dengan lebih dari satu supplier | Lencana "+N lainnya" (N = jumlah supplier - 1); arahkan kursor -> tooltip semua nama, terbaru dulu. Cari nama supplier di kotak pencarian -> produk yang supplier terakhirnya cocok muncul |
| D33 | Nonaktifkan supplier terakhir sebuah produk | Lencana "Nonaktif" di samping nama supplier di kolom itu; aktifkan lagi -> lencana hilang |

## Asumsi
1. Pencarian hanya mencocokkan supplier **terakhir** (sesuai prompt), bukan semua `supplier_names`.
2. "+N lainnya" menghitung supplier selain yang terakhir (`supplier_count - 1`), jadi produk dengan 3 supplier tampil "+2 lainnya".
3. Tanggal masuk terakhir memakai `formatDateOnly` yang sama dengan kolom lain (zona waktu browser).

---

# Update: kategori produk jadi kolom ketik dengan saran

> Menggantikan aturan "Kategori tidak di-hardcode / kategori baru tidak bisa dibuat dari dashboard" (update menu) dan aturan "barang bot berkategori Lainnya wajib pilih kategori nyata" (update SQL 116-119). Database, bot, dan SQL tidak diubah.

## Yang diubah
- `src/lib/categories.ts` (baru, tanpa akses DB, dipakai API dan form):
  - `BASE_CATEGORIES` = Makanan, Minuman, Bumbu, Perlengkapan, Rokok, Lainnya. **Satu-satunya** tempat daftar tetap.
  - `normalizeCategory(value, existing)`: trim, karakter kontrol dan spasi ganda jadi satu spasi; kosong -> "Kategori wajib diisi"; lebih dari 40 karakter (setelah dirapikan) -> ditolak; bila sama dengan kategori yang sudah ada tanpa beda huruf besar/kecil, ejaan yang ada dipakai; bila baru, huruf pertama tiap kata dikapitalisasi.
  - `buildCategorySuggestions(used)` = daftar tetap + kategori terpakai, tanpa duplikat beda huruf (ejaan daftar tetap menang), urut abjad, "Lainnya" terakhir. `uniqueCategories` untuk filter.
- Server: `parseCategory` (validate.ts) memakai `normalizeCategory` dan melempar 400. Dipakai `POST /api/products` dan `PUT /api/products/[id]` dengan `existing` = `ProductService.getCategorySuggestions()`. **Perubahan perilaku:** kategori kosong di POST sekarang 400 (sebelumnya otomatis "Lainnya"); kategori baru diterima (sebelumnya 400 "Kategori tidak dikenal").
- `ProductService.getCategorySuggestions()` = daftar tetap + kategori semua produk (termasuk nonaktif, jadi kategori yang produknya dihapus tetap jadi saran). `getUsedCategories()` = kategori produk **aktif** saja. `getCategories()` lama dihapus.
- `GET /api/products/categories` tetap mengembalikan array saran (dipakai juga filter Stok Opname). `?scope=used` mengembalikan kategori produk aktif.
- Halaman Produk:
  - Form Tambah dan Ubah: `<select>` diganti `<input list>` + satu `<datalist>` bersama. Di bawah kolom tampil pratinjau, misalnya `Disimpan sebagai "Makanan"` atau `Disimpan sebagai "Kue Kering" (kategori baru)`. Aturan perapian sama dengan server, dan nilai yang dirapikan yang dikirim.
  - Filter kategori hanya berisi kategori produk aktif. Daftar dimuat ulang setelah tambah, ubah, atau hapus; bila kategori terpilih tidak punya produk lagi, filter kembali ke "Semua".
  - Barang bot berkategori "Lainnya" tidak lagi dipaksa memilih kategori lain. Teks info: "Periksa nama, kategori ("Lainnya" boleh), dan batas minimum."

## Tes dan pemeriksaan
- `npm test`: **92 tes lulus** (7 file). Baru `tests/categories.test.ts` (9 tes): huruf besar/kecil, spasi/tab/baris baru, kosong/null/bukan teks, batas 40, kategori baru dan kapitalisasi, saran tanpa produk, saran dengan produk, duplikat beda huruf, daftar filter. Tes `parseCategory` di `validate.test.ts` ditulis ulang untuk aturan baru.
- `npx tsc --noEmit` bersih, `npx next build` sukses, eslint bersih untuk file baru.
- Hidrasi: tes 5/5 lulus. Browser (dev server lokal ke staging): konsol halaman Produk tanpa error atau warning. Saat dicek, semua produk staging berkategori "Lainnya": filter hanya berisi "Lainnya", saran tetap 6 kategori dasar. Mengetik "makanan" menampilkan `Disimpan sebagai "Makanan"`, dan "  kue   kering " menampilkan `Disimpan sebagai "Kue Kering" (kategori baru)`. Tidak ada produk yang disimpan.
- `npm audit`: tidak berubah (12 temuan; produksi hanya `xlsx` high).

## Checklist lembar uji (tambahan)
| No | Uji | Hasil yang diharapkan |
|---|---|---|
| D34 | Tambah produk dengan kategori baru "kue kering" | Pratinjau "Kue Kering (kategori baru)"; tersimpan sebagai "Kue Kering", muncul di filter kategori dan di saran form. Hapus satu-satunya produk itu -> hilang dari filter, tetap ada di saran |
| D35 | Ubah atau tambah produk dengan kategori "makanan" atau " MAKANAN " saat "Makanan" sudah ada | Tersimpan "Makanan"; filter tetap satu entri "Makanan" (tidak pecah) |
| D36 | Setelah reset data (semua produk dihapus) buka form Tambah | Saran tetap berisi Bumbu, Makanan, Minuman, Perlengkapan, Rokok, Lainnya; filter hanya "Semua Kategori" |

## Asumsi
1. Kategori baru: hanya huruf pertama tiap kata yang diubah ke kapital; sisa huruf dibiarkan seperti diketik (singkatan "ATK" tetap, "kUE" menjadi "KUE").
2. Saran memuat kategori produk nonaktif (riwayat ejaan tetap konsisten). Bila produk dihapus permanen di database, kategorinya hilang dari saran kecuali termasuk daftar tetap.
3. Urutan "terurut" = abjad, dengan "Lainnya" tetap di akhir seperti sebelumnya.
4. Data lama yang sudah terlanjur berbeda huruf (misalnya "makanan" dan "Makanan" di tabel) tidak diubah di database. Di saran dan filter keduanya tampil sebagai satu entri, dan ketikan baru disamakan ke ejaan daftar tetap. Supaya filter itu tetap memuat kedua ejaan, filter kategori di `GET /api/products` sekarang mencocokkan tanpa beda huruf besar/kecil (`ilike` tanpa wildcard).
