export type TransactionType = 'in' | 'out';

export interface User {
  id: string; // uuid
  username: string;
  password?: string; // hashed
  telegram_chat_id: string;
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
  created_at: string;
}

export interface Supplier {
  id: number;
  name: string;
  created_at: string;
  // Computed / aggregated fields for UI:
  transaction_count?: number;
  last_restock_date?: string | null;
}

export interface Transaction {
  id: number;
  product_id: number;
  user_id: string;
  supplier_id: number | null;
  type: TransactionType;
  qty: number; // in unit (pcs)
  note: string | null;
  created_at: string;
  // Joined relation fields for UI:
  product?: Product;
  supplier?: Supplier;
  user?: Pick<User, 'id' | 'username'>;
}

export interface DashboardStats {
  total_products: number;
  today_transactions_count: number;
  low_stock_count: number;
  low_stock_products: Product[];
  recent_transactions: Transaction[];
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
