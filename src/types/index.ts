export type TransactionType = 'in' | 'out';
export type TransactionSource = 'manual' | 'opname';
export type SupplierJenis = 'utama' | 'cadangan' | 'grosir';
export type OpnameItemJenis = 'keluar' | 'koreksi' | 'baseline';

export interface User {
  id: string; // uuid
  username: string;
  password?: string; // hashed
  telegram_chat_id?: string | null;
  created_at: string;
}

export interface Product {
  id: number;
  name: string;
  category: string;
  unit: string;
  qty_per_karton: number | null;
  stock_current: number;
  stock_minimum: number;
  is_active: boolean;
  is_low?: boolean;
  created_at: string;
  last_counted_at?: string | null;
  last_counted_qty?: number | null;
}

export interface Supplier {
  id: number;
  name: string;
  phone?: string | null;
  created_at: string;
  is_adjustment: boolean;
  jenis: SupplierJenis | null;
  transaction_count?: number;
  last_restock_date?: string | null;
}

export interface Transaction {
  id: number;
  product_id: number;
  user_id?: string | null;
  supplier_id: number | null;
  type: TransactionType;
  qty: number;
  note: string | null;
  created_at: string;
  source: TransactionSource;
  opname_id: number | null;
  // Joined / view fields:
  tanggal_wib?: string;
  product_name?: string;
  category?: string;
  supplier_name?: string | null;
  supplier_jenis?: string | null;
  product?: Product;
  supplier?: Supplier;
  user?: Pick<User, 'id' | 'username'>;
}

export interface DashboardStats {
  total_products: number;
  low_stock_count: number;
  needs_count_count: number;
  low_stock_products: Product[];
  needs_count_products: Product[];
  recent_transactions: Transaction[];
}

export interface StockOpnameSession {
  id: number;
  created_at: string;
  tanggal_wib?: string;
  user_id?: string | null;
  username?: string | null;
  note?: string | null;
  item_count: number;
  total_keluar: number;
}

export interface StockOpnameItem {
  id: number;
  opname_id: number;
  product_id: number;
  product_name?: string;
  category?: string;
  unit?: string;
  stok_sistem: number;
  hitungan: number;
  masuk_setelah_hitung: number;
  keluar: number;
  koreksi: number;
  jenis: OpnameItemJenis;
  hari: number;
  created_at: string;
  tanggal_wib?: string;
  keluar_per_hari?: number | null;
}

export interface KeluarPerHariItem {
  product_id: number;
  product_name: string;
  category: string;
  unit: string;
  total_keluar: number;
  total_hari: number;
  rata_per_hari: number;
  terakhir_dihitung: string | null;
}

export interface BotParseResult {
  success: boolean;
  intent: 'stok_masuk' | 'stok_keluar' | 'cek_stok' | 'rekap_harian' | 'bantuan' | 'unknown' | 'tanya_supplier';
  replyText: string;
  data?: {
    product_name?: string;
    product_id?: number;
    qty?: number;
    unit?: string;
    supplier_name?: string;
    supplier_id?: number | null;
    stock_before?: number;
    stock_after?: number;
    requires_supplier?: boolean;
    pending_data?: Record<string, unknown>;
  };
}

export interface BotConversationState {
  chat_id: string;
  awaiting: 'supplier' | null;
  pending_action?: {
    product_name: string;
    qty: number;
    unit: string;
    original_text: string;
  };
  last_updated: number;
}
