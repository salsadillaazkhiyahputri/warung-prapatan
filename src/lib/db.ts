import bcrypt from 'bcryptjs';
import { getSupabaseAdmin, isSupabaseConfigured } from './supabase';
import {
  User,
  Product,
  Supplier,
  Transaction,
  DashboardStats,
  SupplierJenis,
  StockOpnameSession,
  StockOpnameItem,
  KeluarPerHariItem
} from '@/types';
import { BusinessError, mapRpcError, escapeSearchQuery } from './validate';

const DEFAULT_STOCK_MINIMUM = 10;
const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

function normalizeProduct(p: any): Product {
  const stockMin = Number(p.stock_minimum ?? DEFAULT_STOCK_MINIMUM);
  const stockCur = Number(p.stock_current ?? 0);
  return {
    id: Number(p.id),
    name: p.name,
    category: p.category,
    unit: p.unit || 'pcs',
    qty_per_karton: p.qty_per_karton !== null && p.qty_per_karton !== undefined ? Number(p.qty_per_karton) : null,
    stock_current: stockCur,
    stock_minimum: stockMin,
    is_active: p.is_active !== false,
    is_low: p.is_low !== undefined ? Boolean(p.is_low) : stockCur <= stockMin,
    created_at: p.created_at,
    last_counted_at: p.last_counted_at || null,
    last_counted_qty: p.last_counted_qty !== null && p.last_counted_qty !== undefined ? Number(p.last_counted_qty) : null
  };
}

// ============================================================================
// AUTH SERVICE
// ============================================================================
export const AuthService = {
  async login(username: string, passwordPlain: string): Promise<User | null> {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        const { data: user, error } = await supabase
          .from('users')
          .select('id, username, password, telegram_chat_id, created_at')
          .ilike('username', username.trim())
          .single();

        if (error || !user) return null;

        const isPasswordMatch = await bcrypt.compare(passwordPlain, user.password);
        if (!isPasswordMatch) return null;

        const { password: _, ...safeUser } = user;
        return safeUser as User;
      } catch (err) {
        console.error('Error saat login Supabase:', err);
      }
    }
    return null;
  },

  async getUserById(id: string): Promise<User | null> {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        const { data: user } = await supabase
          .from('users')
          .select('id, username, telegram_chat_id, created_at')
          .eq('id', id)
          .single();
        if (user) return user as User;
      } catch (err) {
        console.error('Error getUserById:', err);
      }
    }
    return null;
  },

  async getUserByChatId(chatId: string): Promise<User | null> {
    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        const { data: user } = await supabase
          .from('users')
          .select('id, username, telegram_chat_id, created_at')
          .eq('telegram_chat_id', chatId)
          .single();
        if (user) return user as User;
      } catch (err) {
        console.error('Error getUserByChatId:', err);
      }
    }
    return null;
  }
};

// ============================================================================
// PRODUCT SERVICE
// ============================================================================
export const ProductService = {
  async getAll(query?: string, category?: string): Promise<Product[]> {
    const supabase = getSupabaseAdmin();
    if (!supabase) return [];

    let builder = supabase
      .from('v_products')
      .select('*')
      .eq('is_active', true)
      .order('name', { ascending: true });

    if (category && category !== 'Semua') {
      builder = builder.eq('category', category);
    }
    if (query && query.trim()) {
      const cleanQ = escapeSearchQuery(query.trim());
      builder = builder.ilike('name', `%${cleanQ}%`);
    }

    const { data, error } = await builder;
    if (error || !data) {
      console.error('Error getAll products:', error);
      return [];
    }

    return data.map(normalizeProduct);
  },

  async getCategories(): Promise<string[]> {
    const supabase = getSupabaseAdmin();
    if (!supabase) return ['Mie', 'Sabun', 'Bumbu', 'Minuman', 'Sembako', 'Makanan', 'Perlengkapan'];

    const { data, error } = await supabase
      .from('products')
      .select('category')
      .eq('is_active', true);

    if (error || !data) {
      return ['Mie', 'Sabun', 'Bumbu', 'Minuman', 'Sembako', 'Makanan', 'Perlengkapan'];
    }

    const set = new Set<string>();
    data.forEach(item => {
      if (item.category && item.category.trim()) {
        set.add(item.category.trim());
      }
    });

    const list = Array.from(set).sort((a, b) => a.localeCompare(b));
    return list;
  },

  async getById(id: number): Promise<Product | null> {
    const supabase = getSupabaseAdmin();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('v_products')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return normalizeProduct(data);
  },

  async findByName(name: string): Promise<Product | null> {
    const clean = name.trim().toLowerCase();
    const products = await this.getAll();
    const exact = products.find(p => p.name.toLowerCase() === clean);
    if (exact) return exact;
    const partial = products.find(p =>
      p.name.toLowerCase().includes(clean) || clean.includes(p.name.toLowerCase())
    );
    return partial || null;
  },

  async create(data: {
    name: string;
    category: string;
    unit?: string;
    qty_per_karton?: number | null;
    stock_current?: number;
    stock_minimum?: number;
  }): Promise<Product> {
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new BusinessError('Database tidak terhubung', 500);

    const cleanName = data.name.trim();

    // Cek duplikasi nama produk (case-insensitive)
    const { data: existing } = await supabase
      .from('products')
      .select('id, name')
      .ilike('name', cleanName)
      .single();

    if (existing) {
      throw new BusinessError(`Produk dengan nama "${cleanName}" sudah terdaftar`, 409, 'DUPLICATE_PRODUCT_NAME');
    }

    const { data: created, error } = await supabase
      .from('products')
      .insert([{
        name: cleanName,
        category: data.category.trim(),
        unit: data.unit?.trim() || 'pcs',
        qty_per_karton: data.qty_per_karton ? Number(data.qty_per_karton) : null,
        stock_current: Math.max(0, Number(data.stock_current) || 0),
        stock_minimum: Number(data.stock_minimum ?? DEFAULT_STOCK_MINIMUM),
        is_active: true
      }])
      .select()
      .single();

    if (error || !created) {
      console.error('Error create product:', error);
      throw new BusinessError('Gagal menambahkan produk ke basis data', 500);
    }

    return normalizeProduct(created);
  },

  /**
   * Mengubah data produk. Stok TIDAK BISA diubah lewat form ini!
   */
  async update(id: number, data: {
    name?: string;
    category?: string;
    stock_minimum?: number;
  }): Promise<Product> {
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new BusinessError('Database tidak terhubung', 500);

    const updatePayload: Record<string, any> = {};

    if (data.name !== undefined) {
      const cleanName = data.name.trim();
      // Cek duplikasi nama jika nama diubah
      const { data: existing } = await supabase
        .from('products')
        .select('id, name')
        .ilike('name', cleanName)
        .neq('id', id)
        .single();

      if (existing) {
        throw new BusinessError(`Produk dengan nama "${cleanName}" sudah digunakan`, 409, 'DUPLICATE_PRODUCT_NAME');
      }
      updatePayload.name = cleanName;
    }

    if (data.category !== undefined) {
      updatePayload.category = data.category.trim();
    }

    if (data.stock_minimum !== undefined) {
      updatePayload.stock_minimum = Number(data.stock_minimum);
    }

    const { data: updated, error } = await supabase
      .from('products')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error || !updated) {
      console.error('Error update product:', error);
      throw new BusinessError('Gagal memperbarui produk', 500);
    }

    return normalizeProduct(updated);
  },

  /**
   * Menghapus produk = menonaktifkan (is_active = false). Riwayat tetap utuh.
   */
  async delete(id: number): Promise<boolean> {
    const supabase = getSupabaseAdmin();
    if (!supabase) return false;

    const { error } = await supabase
      .from('products')
      .update({ is_active: false })
      .eq('id', id);

    if (error) {
      console.error('Error soft-deleting product:', error);
      return false;
    }
    return true;
  }
};

// ============================================================================
// SUPPLIER SERVICE
// ============================================================================
export const SupplierService = {
  async getAll(): Promise<Supplier[]> {
    const supabase = getSupabaseAdmin();
    if (!supabase) return [];

    const { data, error } = await supabase
      .from('v_supplier_stats')
      .select('*')
      .order('name', { ascending: true });

    if (error || !data) {
      console.error('Error getAll suppliers:', error);
      return [];
    }

    return data.map((s: any) => ({
      id: Number(s.id),
      name: s.name,
      phone: s.phone || null,
      created_at: s.created_at,
      is_adjustment: Boolean(s.is_adjustment),
      jenis: (s.jenis as SupplierJenis) || null,
      transaction_count: Number(s.transaction_count || 0),
      last_restock_date: s.last_restock_date || null
    }));
  },

  async getById(id: number): Promise<Supplier | null> {
    const supabase = getSupabaseAdmin();
    if (!supabase) return null;

    const { data, error } = await supabase
      .from('suppliers')
      .select('*')
      .eq('id', id)
      .single();

    if (error || !data) return null;
    return {
      id: Number(data.id),
      name: data.name,
      phone: data.phone || null,
      created_at: data.created_at,
      is_adjustment: Boolean(data.is_adjustment),
      jenis: (data.jenis as SupplierJenis) || null
    };
  },

  async findOrCreate(name: string, jenis: SupplierJenis = 'utama'): Promise<Supplier> {
    const cleanName = name.trim();
    const supabase = getSupabaseAdmin();
    if (supabase) {
      try {
        const { data: existing } = await supabase
          .from('suppliers')
          .select('*')
          .ilike('name', cleanName)
          .single();
        if (existing) {
          return {
            id: Number(existing.id),
            name: existing.name,
            phone: existing.phone || null,
            created_at: existing.created_at,
            is_adjustment: Boolean(existing.is_adjustment),
            jenis: existing.jenis as SupplierJenis
          };
        }
      } catch {}
    }
    return await this.create({ name: cleanName, jenis });
  },

  async create(data: { name: string; jenis: SupplierJenis; phone?: string | null }): Promise<Supplier> {
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new BusinessError('Database tidak terhubung', 500);

    const cleanName = data.name.trim();

    // Cek duplikasi nama supplier (case-insensitive)
    const { data: existing } = await supabase
      .from('suppliers')
      .select('id, name')
      .ilike('name', cleanName)
      .single();

    if (existing) {
      throw new BusinessError(`Supplier dengan nama "${cleanName}" sudah terdaftar`, 409, 'DUPLICATE_SUPPLIER_NAME');
    }

    const { data: created, error } = await supabase
      .from('suppliers')
      .insert([{
        name: cleanName,
        jenis: data.jenis,
        phone: data.phone?.trim() || null,
        is_adjustment: false
      }])
      .select()
      .single();

    if (error || !created) {
      console.error('Error create supplier:', error);
      throw new BusinessError('Gagal menambahkan supplier ke basis data', 500);
    }

    return {
      id: Number(created.id),
      name: created.name,
      phone: created.phone || null,
      created_at: created.created_at,
      is_adjustment: Boolean(created.is_adjustment),
      jenis: created.jenis as SupplierJenis
    };
  },

  async update(id: number, data: { name?: string; jenis?: SupplierJenis; phone?: string | null }): Promise<Supplier> {
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new BusinessError('Database tidak terhubung', 500);

    // Periksa apakah supplier adalah Koreksi Stok (is_adjustment = true)
    const current = await this.getById(id);
    if (!current) throw new BusinessError('Supplier tidak ditemukan', 404);

    if (current.is_adjustment || current.name.toLowerCase() === 'koreksi stok') {
      throw new BusinessError('Supplier sistem "Koreksi Stok" terkunci dan tidak dapat diubah', 403, 'LOCKED_SUPPLIER');
    }

    const updatePayload: Record<string, any> = {};

    if (data.name !== undefined) {
      const cleanName = data.name.trim();
      const { data: existing } = await supabase
        .from('suppliers')
        .select('id, name')
        .ilike('name', cleanName)
        .neq('id', id)
        .single();

      if (existing) {
        throw new BusinessError(`Supplier dengan nama "${cleanName}" sudah digunakan`, 409, 'DUPLICATE_SUPPLIER_NAME');
      }
      updatePayload.name = cleanName;
    }

    if (data.jenis !== undefined) {
      updatePayload.jenis = data.jenis;
    }

    if (data.phone !== undefined) {
      updatePayload.phone = data.phone?.trim() || null;
    }

    const { data: updated, error } = await supabase
      .from('suppliers')
      .update(updatePayload)
      .eq('id', id)
      .select()
      .single();

    if (error || !updated) {
      console.error('Error update supplier:', error);
      throw new BusinessError('Gagal memperbarui data supplier', 500);
    }

    return {
      id: Number(updated.id),
      name: updated.name,
      phone: updated.phone || null,
      created_at: updated.created_at,
      is_adjustment: Boolean(updated.is_adjustment),
      jenis: updated.jenis as SupplierJenis
    };
  }
};

// ============================================================================
// TRANSACTION SERVICE
// ============================================================================
export const TransactionService = {
  async getHistory(filters?: {
    startDate?: string;
    endDate?: string;
    productId?: number;
    type?: string;
  }): Promise<Transaction[]> {
    const supabase = getSupabaseAdmin();
    if (!supabase) return [];

    let builder = supabase
      .from('v_transactions')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.type && filters.type !== 'all') {
      builder = builder.eq('type', filters.type);
    }
    if (filters?.productId) {
      builder = builder.eq('product_id', filters.productId);
    }
    if (filters?.startDate) {
      builder = builder.gte('created_at', `${filters.startDate}T00:00:00+07:00`);
    }
    if (filters?.endDate) {
      builder = builder.lte('created_at', `${filters.endDate}T23:59:59.999+07:00`);
    }

    const { data, error } = await builder;
    if (error || !data) {
      console.error('Error getHistory transactions:', error);
      return [];
    }

    return data.map((t: any) => ({
      id: Number(t.id),
      product_id: Number(t.product_id),
      user_id: t.user_id,
      supplier_id: t.supplier_id ? Number(t.supplier_id) : null,
      type: t.type,
      qty: Number(t.qty),
      note: t.note || null,
      created_at: t.created_at,
      source: t.source || 'manual',
      opname_id: t.opname_id ? Number(t.opname_id) : null,
      tanggal_wib: t.tanggal_wib,
      product_name: t.product_name,
      category: t.category,
      supplier_name: t.supplier_name || null,
      supplier_jenis: t.supplier_jenis || null
    }));
  },

  /**
   * Cek apakah pasangan produk + supplier merupakan kombinasi baru lewat RPC fn_pair_baru.
   */
  async checkNewPair(productId: number, supplierId: number): Promise<boolean> {
    const supabase = getSupabaseAdmin();
    if (!supabase) return false;

    const { data, error } = await supabase.rpc('fn_pair_baru', {
      p_product_id: productId,
      p_supplier_id: supplierId
    });

    if (error) {
      console.error('Error checkNewPair RPC:', error);
      return false;
    }

    return Boolean(data);
  },

  /**
   * Mencatat pergerakan stok manual via RPC fn_dashboard_record_movement.
   * Stok TIDAK PERNAH diubah lewat update langsung!
   */
  async recordMovement(params: {
    userId: string;
    type: 'in' | 'out';
    productId: number;
    qty: number;
    supplierId: number | null;
    note?: string | null;
    idemKey: string;
  }): Promise<{ ok: boolean; duplicate?: boolean; items?: any[]; supplier?: any; code?: string }> {
    const supabase = getSupabaseAdmin();
    if (!supabase) throw new BusinessError('Database tidak terhubung', 500);

    const { data, error } = await supabase.rpc('fn_dashboard_record_movement', {
      p_user_id: params.userId,
      p_type: params.type,
      p_product_id: params.productId,
      p_qty: params.qty,
      p_supplier_id: params.supplierId,
      p_note: params.note || null,
      p_idem_key: params.idemKey
    });

    if (error) {
      console.error('Error fn_dashboard_record_movement:', error);
      throw new BusinessError(`Gagal menjalankan transaksi database: ${error.message}`, 500);
    }

    return data;
  },

  /**
   * Ringkasan KPI untuk Dashboard Utama (Sesuai Bagian 5).
   * Menampilkan Total Produk, Stok Menipis, dan Perlu Dihitung (threshold 14 hari).
   * Tidak ada kartu "Transaksi Hari Ini".
   */
  async getDashboardSummary(): Promise<DashboardStats> {
    const products = await ProductService.getAll();
    const now = Date.now();

    const lowStockProducts = products.filter(p => p.stock_current <= p.stock_minimum);

    // Produk yang belum pernah dihitung (last_counted_at null) atau terakhir dihitung > 14 hari
    const needsCountProducts = products.filter(p => {
      if (!p.last_counted_at) return true;
      const countTime = new Date(p.last_counted_at).getTime();
      return isNaN(countTime) || now - countTime > FOURTEEN_DAYS_MS;
    });

    const history = await this.getHistory();

    return {
      total_products: products.length,
      low_stock_count: lowStockProducts.length,
      needs_count_count: needsCountProducts.length,
      low_stock_products: lowStockProducts.sort((a, b) => a.stock_current - b.stock_current),
      needs_count_products: needsCountProducts.sort((a, b) => a.name.localeCompare(b.name)),
      recent_transactions: history.slice(0, 5)
    };
  },

  async create(data: {
    product_id: number;
    user_id?: string;
    supplier_id?: number | null;
    type: 'in' | 'out';
    qty: number;
    note?: string | null;
  }): Promise<Transaction> {
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });
    await this.recordMovement({
      userId: data.user_id || 'e1a9c1e0-827b-4573-b391-7f8f9e68c5b1',
      type: data.type,
      productId: data.product_id,
      qty: data.qty,
      supplierId: data.supplier_id || null,
      note: data.note || null,
      idemKey: `web:${uuid}`
    });
    const [product, supplier] = await Promise.all([
      ProductService.getById(data.product_id),
      data.supplier_id ? SupplierService.getById(data.supplier_id) : Promise.resolve(null)
    ]);
    return {
      id: 0,
      product_id: data.product_id,
      user_id: data.user_id,
      supplier_id: data.supplier_id || null,
      type: data.type,
      qty: data.qty,
      note: data.note || null,
      created_at: new Date().toISOString(),
      source: 'manual',
      opname_id: null,
      product: product || undefined,
      supplier: supplier || undefined
    };
  },

  async getDailyRecap(targetDate?: string) {
    const history = await this.getHistory();
    const todayStr = targetDate || new Date().toISOString().split('T')[0];
    const dailyTrx = history.filter(t => (t.created_at || '').startsWith(todayStr));
    const masukCount = dailyTrx.filter(t => t.type === 'in').length;
    const keluarCount = dailyTrx.filter(t => t.type === 'out').length;
    const details = dailyTrx.map(t => {
      const sign = t.type === 'in' ? '+' : '-';
      const sup = t.supplier_name ? ` (${t.supplier_name})` : '';
      return `${sign} ${t.product_name || `Produk #${t.product_id}`} ${t.qty} pcs${sup}`;
    });
    return {
      dateFormatted: todayStr,
      totalTransactions: dailyTrx.length,
      masukCount,
      keluarCount,
      details,
      transactions: dailyTrx
    };
  }
};

// ============================================================================
// OPNAME SERVICE (Sesuai View v_opname_riwayat dan v_keluar_per_hari)
// ============================================================================
export const OpnameService = {
  async getSessions(filters?: {
    startDate?: string;
    endDate?: string;
    productId?: number;
  }): Promise<{ sessions: StockOpnameSession[]; items: StockOpnameItem[] }> {
    const supabase = getSupabaseAdmin();
    if (!supabase) return { sessions: [], items: [] };

    let builder = supabase
      .from('v_opname_riwayat')
      .select('*')
      .order('created_at', { ascending: false });

    if (filters?.productId) {
      builder = builder.eq('product_id', filters.productId);
    }
    if (filters?.startDate) {
      builder = builder.gte('created_at', `${filters.startDate}T00:00:00+07:00`);
    }
    if (filters?.endDate) {
      builder = builder.lte('created_at', `${filters.endDate}T23:59:59.999+07:00`);
    }

    const { data, error } = await builder;
    if (error || !data) {
      console.error('Error v_opname_riwayat:', error);
      return { sessions: [], items: [] };
    }

    const items: StockOpnameItem[] = data.map((row: any) => ({
      id: Number(row.id),
      opname_id: Number(row.opname_id),
      product_id: Number(row.product_id),
      product_name: row.product_name,
      category: row.category,
      unit: row.unit || 'pcs',
      stok_sistem: Number(row.stok_sistem || 0),
      hitungan: Number(row.hitungan || 0),
      masuk_setelah_hitung: Number(row.masuk_setelah_hitung || 0),
      keluar: Number(row.keluar || 0),
      koreksi: Number(row.koreksi || 0),
      jenis: row.jenis,
      hari: Number(row.hari || 0),
      created_at: row.created_at,
      tanggal_wib: row.tanggal_wib,
      keluar_per_hari: row.keluar_per_hari !== null && row.keluar_per_hari !== undefined ? Number(row.keluar_per_hari) : null
    }));

    // Kelompokkan per opname_id menjadi sesi
    const sessionMap = new Map<number, StockOpnameSession>();
    items.forEach(item => {
      const existing = sessionMap.get(item.opname_id);
      if (!existing) {
        sessionMap.set(item.opname_id, {
          id: item.opname_id,
          created_at: item.created_at,
          tanggal_wib: item.tanggal_wib,
          note: null,
          item_count: 1,
          total_keluar: item.jenis === 'keluar' ? item.keluar : 0
        });
      } else {
        existing.item_count += 1;
        if (item.jenis === 'keluar') {
          existing.total_keluar += item.keluar;
        }
      }
    });

    const sessions = Array.from(sessionMap.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    return { sessions, items };
  },

  async getKeluarPerHari(category?: string): Promise<KeluarPerHariItem[]> {
    const supabase = getSupabaseAdmin();
    if (!supabase) return [];

    let builder = supabase
      .from('v_keluar_per_hari')
      .select('*')
      .order('total_keluar', { ascending: false });

    if (category && category !== 'Semua') {
      builder = builder.eq('category', category);
    }

    const { data, error } = await builder;
    if (error || !data) {
      console.error('Error v_keluar_per_hari:', error);
      return [];
    }

    return data.map((row: any) => ({
      product_id: Number(row.product_id),
      product_name: row.product_name,
      category: row.category,
      unit: row.unit || 'pcs',
      total_keluar: Number(row.total_keluar || 0),
      total_hari: Number(row.total_hari || 0),
      rata_per_hari: Number(row.rata_per_hari || 0),
      terakhir_dihitung: row.terakhir_dihitung || null
    }));
  }
};
