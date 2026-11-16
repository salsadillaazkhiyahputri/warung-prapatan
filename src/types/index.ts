export type TransactionType = 'in' | 'out';
export type TransactionSource = 'manual' | 'opname';

export const SUPPLIER_JENIS = ['utama', 'cadangan', 'grosir'] as const;
export type SupplierJenis = (typeof SUPPLIER_JENIS)[number];

// Kategori tidak di-hardcode: daftar sah = kategori yang ada di tabel products + "Lainnya".
export const DEFAULT_CATEGORY = 'Lainnya';

// Jenis tampilan transaksi di Riwayat (turunan dari type + source + supplier).
// 'stok_awal' = penyesuaian dari opname pertama (source='opname', note "Stok awal (opname pertama)").
export type TransactionKind = 'masuk' | 'keluar_opname' | 'keluar_manual' | 'koreksi' | 'stok_awal';

export interface User {
  id: string; // uuid
  username: string;
  password?: string; // hashed
  telegram_chat_id: string;
  created_at: string;
}

export interface Product {
  is_active?: boolean;
  id: number;
  name: string;
  category: string;
  unit: string;
  // Kolom tetap ada di database, tetapi fitur karton disembunyikan dari UI.
  qty_per_karton: number | null;
  stock_current: number;
  stock_minimum: number;
  // Tahap 2 (SQL 114): null = belum pernah dihitung lewat opname.
  last_counted_at?: string | null;
  last_counted_qty?: number | null;
  // SQL 116: true untuk barang yang didaftarkan bot (kategori "Lainnya", stok 0). Hanya diubah database
  // (trigger menghapusnya saat nama/kategori/minimum/isi karton diubah); API tidak pernah menerimanya dari klien.
  needs_review?: boolean;
  created_at: string;
  // SQL 120 (v_product_suppliers): supplier TERAKHIR dari riwayat stok masuk. Hanya diisi oleh GET /api/products.
  last_supplier_id?: number | null;
  last_supplier_name?: string | null;
  last_in_at?: string | null;
  last_supplier_active?: boolean | null;
  supplier_count?: number;
  supplier_names?: string[];
}

export interface ProductSupplierInfo {
  last_supplier_id: number | null;
  last_supplier_name: string | null;
  last_in_at: string | null;
  last_supplier_active: boolean | null;
  supplier_count: number;
  // Terbaru dulu.
  supplier_names: string[];
}

export interface Supplier {
  id: number;
  name: string;
  // null hanya untuk supplier sistem is_adjustment ("Koreksi Stok").
  jenis: SupplierJenis | null;
  created_at: string;
  // Computed / aggregated fields for UI:
  transaction_count?: number;
  last_restock_date?: string | null;
  is_adjustment?: boolean;
  // SQL 119: supplier nonaktif tidak ditawarkan untuk stok masuk, riwayatnya tetap ada.
  is_active: boolean;
}

export interface Transaction {
  id: number;
  product_id: number;
  user_id: string;
  supplier_id: number | null;
  type: TransactionType;
  qty: number; // pcs
  note: string | null;
  source?: TransactionSource;
  opname_id?: number | null;
  created_at: string;
  kind?: TransactionKind;
  // Joined relation fields for UI:
  product?: Product;
  supplier?: Supplier;
  user?: Pick<User, 'id' | 'username'>;
}

export interface DashboardStats {
  total_products: number;
  // Produk aktif yang belum pernah dihitung atau > 14 hari tidak dihitung lewat opname.
  perlu_dihitung_count: number;
  low_stock_count: number;
  // Barang dari bot yang masih perlu dilengkapi (needs_review = true).
  needs_review_count: number;
  low_stock_products: Product[];
  recent_transactions: Transaction[];
}

// ===== Tahap 2: Stok opname (dicatat lewat bot Telegram, dashboard hanya membaca) =====
export type OpnameItemJenis = 'keluar' | 'koreksi' | 'baseline';

export interface OpnameSession {
  id: number;
  created_at: string;
  note: string | null;
  user_id: string | null;
  username: string | null;
  item_count: number;
}

export interface OpnameItem {
  id: number;
  opname_id: number;
  product_id: number;
  product_name: string;
  category: string | null;
  stok_sistem: number;
  hitungan: number;
  masuk_setelah_hitung: number;
  keluar: number;
  koreksi: number;
  jenis: OpnameItemJenis;
  hari: number | null;
  keluar_per_hari: number | null;
  created_at: string;
}

export interface OpnameDetail extends OpnameSession {
  items: OpnameItem[];
}

export interface KeluarPerHariRow {
  product_id: number;
  product_name: string;
  category: string | null;
  total_keluar: number;
  total_hari: number;
  rata_per_hari: number;
  terakhir_dihitung: string | null;
}

export interface MasukPerJenisRow {
  jenis: SupplierJenis;
  total_qty: number;
  transaction_count: number;
}
