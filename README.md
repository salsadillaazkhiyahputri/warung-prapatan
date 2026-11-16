# Sistem Informasi Pencatatan Stok Warung Prapatan
### Capstone Project 2 — Program Studi Teknologi Informasi, Universitas Muhammadiyah Yogyakarta (2026)

Aplikasi web full-stack terintegrasi yang menggabungkan **Dashboard Web Next.js**, **AI Agent Chatbot Telegram (Llama via Groq & n8n)**, dan basis data relasional **PostgreSQL / Supabase** untuk digitalisasi pencatatan stok barang pada UMKM Warung Prapatan.

---

## 👥 Tim Pengembang & Pembagian Tugas

**Dosen Pembimbing**: Muhammad Abdul Haq, S.Tr.T., M.Eng., Ph.D.

```text
ANGGOTA 1: Rizky Pratama Putra (20230140005)
DATABASE & INTEGRATION
│
├── Supabase
├── Database
├── Query
├── Authentication support
└── Integrasi dashboard ↔ chatbot


ANGGOTA 2: Salsa Dilla Azkhiyah Putri (20230140077)
DASHBOARD CORE
│
├── Login
├── Layout
├── Sidebar
├── Dashboard
├── Summary card
└── Transaksi terbaru


ANGGOTA 3: Refky Muhammad Syahrin (20230140050)
DASHBOARD MANAGEMENT
│
├── Produk
├── Supplier
├── Riwayat
├── Filter
└── Export Excel/PDF


ANGGOTA 4: Mannanta Brilian Citra (20230140228)
CHATBOT
│
├── Telegram
├── n8n
├── AI Agent
├── Groq + Llama
├── Stok masuk
├── Stok keluar
├── Cek stok
├── Rekap
└── Fallback
```

---

## 🎯 Pemetaan Fitur & Kebutuhan Fungsional (SRS)

| Kode SRS | Kebutuhan Fungsional | Status Implementasi | Modul Terkait |
|---|---|:---:|---|
| **F1** | Mencatat stok masuk via Telegram dengan bahasa sehari-hari | ✅ Selesai | `src/lib/bot-nlp.ts` & `/api/bot/*` |
| **F2** | Mencantumkan nama supplier asal barang saat stok masuk | ✅ Selesai | `src/lib/bot-nlp.ts` |
| **F3** | Bot otomatis menanyakan nama supplier jika tidak disebutkan | ✅ Selesai | `src/lib/bot-nlp.ts` (Conversation State) |
| **F4** | Mencatat stok keluar via Telegram dengan bahasa sehari-hari | ✅ Selesai | `src/lib/bot-nlp.ts` & validasi stok |
| **F5** | Mengecek jumlah stok barang via Telegram | ✅ Selesai | `src/lib/bot-nlp.ts` & konversi karton |
| **F6** | Meminta rekap transaksi harian via Telegram | ✅ Selesai | `src/lib/db.ts` (TransactionService.getDailyRecap) |
| **F7** | Balasan panduan otomatis untuk pesan yang tidak dikenali (fallback) | ✅ Selesai | `FALLBACK_MESSAGE` & pattern analyzer |
| **F8** | Login ke dashboard web menggunakan akun terdaftar (password hash) | ✅ Selesai | `src/app/login/page.tsx` & `/api/auth/login` |
| **F9** | Dashboard utama berisi ringkasan stok terkini & stok menipis | ✅ Selesai | `src/app/dashboard/page.tsx` |
| **F10** | Kelola data produk (tambah, ubah, hapus) melalui dashboard | ✅ Selesai | `src/app/produk/page.tsx` & `/api/products` |
| **F11** | Melihat & memfilter riwayat transaksi (tanggal, produk, jenis) | ✅ Selesai | `src/app/riwayat/page.tsx` |
| **F12** | Ekspor laporan transaksi ke format Excel (.xlsx) dan PDF (.pdf) | ✅ Selesai | `src/lib/export-utils.ts` |
| **F13** | Melihat daftar supplier terdaftar beserta riwayat transaksi | ✅ Selesai | `src/app/supplier/page.tsx` |
| **F14** | Mengubah nama supplier melalui dashboard untuk koreksi penulisan | ✅ Selesai | `src/app/supplier/page.tsx` |
| **F15** | Logout dari dashboard | ✅ Selesai | `/api/auth/logout` |

---

## 🚀 Panduan Memulai Cepat (Quick Start)

### 1. Prasyarat Sistem
- Node.js versi 18.x atau lebih baru (direkomendasikan v20 / v22)
- npm versi 9.x atau lebih baru

### 2. Instalasi Dependensi
```bash
npm install
```

### 3. Konfigurasi Lingkungan (.env.local)
Berkas konfigurasi default sudah disiapkan di `.env.local`. Aplikasi mendukung **Dual-Mode Persistence**:
- **Mode Lokal (Out-of-the-box)**: Menggunakan berkas JSON persisten lokal di `data/warung_prapatan.json`. Seluruh operasi CRUD, stok masuk/keluar, dan chatbot berfungsi 100% tanpa perlu akun cloud.
- **Mode Supabase Cloud**: Masukkan URL dan Key Supabase ke `.env.local` untuk mengaktifkan koneksi cloud PostgreSQL.

Jika memakai Supabase, jalankan `supabase/schema.sql` di SQL Editor setelah perubahan skema. Stok minimum produk disimpan per produk; kolom isi karton boleh dikosongkan untuk produk yang hanya menggunakan satuan utama.

### 4. Menjalankan Server Pengembangan
```bash
npm run dev
```
Buka peramban pada alamat [http://localhost:3000](http://localhost:3000).

---

## 🔐 Kredensial Login Pemilik (Default)
- **Halaman Login**: `/login`
- **Username**: `pemilik`
- **Password**: `warung123`

---

## 📁 Struktur Berkas Proyek

```
warung-prapatan/
├── n8n/                                # Konfigurasi otomasi n8n & Sumopod
│   ├── warung_prapatan_workflow.json   # Berkas workflow n8n siap impor
│   └── SETUP_GUIDE.md                  # Panduan deployment n8n & Telegram
├── supabase/                           # Skrip basis data PostgreSQL
│   ├── schema.sql                      # DDL tabel, constraint, dan trigger stok
│   └── seed.sql                        # Data awal Warung Prapatan
├── data/
│   └── warung_prapatan.json            # Database lokal persisten
├── src/
│   ├── app/                            # Halaman & API Next.js App Router
│   │   ├── api/                        # Route Handlers REST API
│   │   ├── dashboard/                  # Halaman Ringkasan Dashboard
│   │   ├── produk/                     # Halaman CRUD Produk
│   │   ├── supplier/                   # Halaman Kelola Supplier
│   │   ├── riwayat/                    # Halaman Riwayat & Ekspor
│   │   └── login/                      # Halaman Autentikasi Pemilik
│   ├── components/                     # Komponen UI Modular
│   ├── lib/                            # Service & Business Logic
│   └── types/                          # Definisi Tipe TypeScript
└── README.md                           # Dokumentasi utama proyek
```
