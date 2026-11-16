import bcrypt from 'bcryptjs';
import { getSupabaseAdmin } from './supabase';
import { BusinessError } from './errors';
import { DateRange } from './validate';
import { classifyTransaction, perDay, isCountStale, aggregateKeluarPerHari } from './stock-labels';
import { ProductSupplierRow, mergeProductSuppliers, matchesProductSearch } from './product-suppliers';
import { buildCategorySuggestions, uniqueCategories } from './categories';
import {
  User, Product, Supplier, SupplierJenis, Transaction, DashboardStats, TransactionType, TransactionKind,
  OpnameSession, OpnameDetail, OpnameItem, OpnameItemJenis, KeluarPerHariRow, MasukPerJenisRow, SUPPLIER_JENIS
} from '@/types';

export { BusinessError };

const PAGE_SIZE = 1000;
const MAX_ROWS = 20000;
const UNIQUE_VIOLATION = '23505';
const FOREIGN_KEY_VIOLATION = '23503';
const CHECK_VIOLATION = '23514';

export const SUPPLIER_NONAKTIF_MESSAGE = 'Supplier ini sedang nonaktif. Aktifkan dulu di halaman Supplier.';
export const KOREKSI_STOK_IN_MESSAGE = '"Koreksi Stok" tidak bisa dipakai untuk stok masuk. Pilih supplier yang mengirim barang.';
export const SUPPLIER_SISTEM_MESSAGE = 'Supplier sistem "Koreksi Stok" tidak bisa diubah, dinonaktifkan, atau dihapus';
export const SUPPLIER_PUNYA_RIWAYAT_MESSAGE = 'Supplier ini sudah punya riwayat, jadi tidak bisa dihapus. Nonaktifkan saja.';

const SUPPLIER_COLUMNS = 'id, name, jenis, created_at, is_adjustment, is_active';

interface SupplierRow {
  id: number;
  name: string;
  jenis?: unknown;
  created_at: string;
  is_adjustment?: boolean | null;
  is_active?: boolean | null;
  transaction_count?: number | string | null;
  last_restock_date?: string | null;
}

interface PgErrorLike {
  code?: string;
  message?: string;
  details?: string;
  hint?: string;
}

function normalizeSupplier(raw: SupplierRow): Supplier {
  return {
    id: raw.id,
    name: raw.name,
    jenis: normalizeJenis(raw.jenis),
    created_at: raw.created_at,
    is_adjustment: !!raw.is_adjustment,
    // Sebelum SQL 119 kolom belum ada -> dianggap aktif.
    is_active: raw.is_active !== false,
    ...(raw.transaction_count !== undefined ? { transaction_count: Number(raw.transaction_count) || 0 } : {}),
    ...(raw.last_restock_date !== undefined ? { last_restock_date: raw.last_restock_date ?? null } : {})
  };
}

// Error Postgres dari check constraint / trigger (diteruskan PostgREST).
function isCheckViolation(error: PgErrorLike | null | undefined): boolean {
  return error?.code === CHECK_VIOLATION;
}
function mentions(error: PgErrorLike | null | undefined, word: string): boolean {
  return [error?.message, error?.details, error?.hint].some((v) => typeof v === 'string' && v.includes(word));
}

// Dummy hash agar waktu respons login sama untuk username yang tidak ada.
const DUMMY_HASH = '$2b$10$CwTycUXWue0Thq9StjUM0uJ8.4v5vYb8o3fR0wq3m6h0ZkYkq3uyG';

function escapeLike(s: string): string {
  return s.replace(/[\\%_]/g, (c) => `\\${c}`);
}

// Tanggal kalender WIB (YYYY-MM-DD, sudah divalidasi lewat dateRange) -> batas waktu absolut.
// Server Vercel berjalan di UTC.
function wibStart(date: string): string {
  return `${date}T00:00:00+07:00`;
}
function wibEnd(date: string): string {
  return `${date}T23:59:59.999+07:00`;
}
export function wibToday(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date());
}
export function wibDaysAgo(days: number): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Jakarta' }).format(new Date(Date.now() - days * 86400000));
}

function num(v: unknown, fallback = 0): number {
  const n = Number(v);
  return Number.isFinite(n) ? n : fallback;
}

function normalizeProduct(raw: Product): Product {
  return {
    ...raw,
    qty_per_karton: raw.qty_per_karton ? Number(raw.qty_per_karton) : null,
    stock_current: num(raw.stock_current),
    stock_minimum: num(raw.stock_minimum, 10),
    last_counted_at: raw.last_counted_at ?? null,
    last_counted_qty: raw.last_counted_qty === null || raw.last_counted_qty === undefined ? null : num(raw.last_counted_qty),
    needs_review: raw.needs_review === true
  };
}

function normalizeTransaction(t: any): Transaction {
  const source = t.source === 'opname' ? 'opname' : 'manual';
  const supplier = t.suppliers ?? undefined;
  return {
    id: t.id,
    product_id: t.product_id,
    user_id: t.user_id,
    supplier_id: t.supplier_id,
    type: t.type,
    qty: t.qty,
    note: t.note,
    source,
    opname_id: t.opname_id ?? null,
    created_at: t.created_at,
    kind: classifyTransaction({ type: t.type, source, supplierIsAdjustment: !!supplier?.is_adjustment, note: t.note }),
    product: t.products ? normalizeProduct(t.products) : undefined,
    supplier
  };
}

function normalizeJenis(v: unknown): SupplierJenis | null {
  return typeof v === 'string' && (SUPPLIER_JENIS as readonly string[]).includes(v) ? (v as SupplierJenis) : null;
}

// ============================================================================
// AUTH
// ============================================================================
export const AuthService = {
  async login(username: string, passwordPlain: string): Promise<User | null> {
    const db = getSupabaseAdmin();
    const { data: user } = await db
      .from('users')
      .select('id, username, password, telegram_chat_id, created_at')
      .eq('username', username)
      .maybeSingle();

    const ok = await bcrypt.compare(passwordPlain, user?.password || DUMMY_HASH);
    if (!user || !user.password || !ok) return null;

    const { password: _password, ...safeUser } = user;
    return safeUser as User;
  },

  async getUserById(id: string): Promise<User | null> {
    const { data } = await getSupabaseAdmin()
      .from('users')
      .select('id, username, telegram_chat_id, created_at')
      .eq('id', id)
      .maybeSingle();
    return (data as User) ?? null;
  }
};

async function usernamesByIds(ids: string[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter(Boolean))];
  const map = new Map<string, string>();
  if (unique.length === 0) return map;
  const { data, error } = await getSupabaseAdmin().from('users').select('id, username').in('id', unique);
  if (error) throw error;
  for (const u of data ?? []) map.set(u.id, u.username);
  return map;
}

// ============================================================================
// PRODUK. "Hapus" = nonaktifkan (is_active = false) agar riwayat transaksi tetap utuh.
// Stok (stock_current) hanya berubah lewat transaksi / opname (RPC database), tidak lewat edit produk.
// ============================================================================
export const ProductService = {
  async getAll(query?: string, category?: string): Promise<Product[]> {
    let builder = getSupabaseAdmin().from('products').select('*').eq('is_active', true).order('name', { ascending: true });
    if (category && category !== 'Semua') builder = builder.eq('category', category);
    if (query) builder = builder.ilike('name', `%${escapeLike(query)}%`);
    const { data, error } = await builder;
    if (error) throw error;
    return (data as Product[]).map(normalizeProduct);
  },

  // Katalog untuk halaman Produk: v_products + supplier terakhir dari v_product_suppliers (SQL 120).
  // Tepat dua query (bukan satu per baris). Pencarian dilakukan setelah penggabungan karena juga
  // mencocokkan nama supplier terakhir.
  async getCatalog(query?: string, category?: string): Promise<Product[]> {
    const db = getSupabaseAdmin();
    let builder = db.from('v_products').select('*').eq('is_active', true).order('name', { ascending: true }).limit(MAX_ROWS);
    if (category && category !== 'Semua') {
      // Tanpa beda huruf besar/kecil (pola tanpa wildcard), sejalan dengan filter yang menggabungkan "makanan"/"Makanan".
      builder = builder.ilike('category', escapeLike(category));
    }

    const [productsRes, suppliersRes] = await Promise.all([
      builder,
      db.from('v_product_suppliers')
        .select('product_id, last_supplier_id, last_supplier_name, last_in_at, last_supplier_active, supplier_count, supplier_names')
        .limit(MAX_ROWS)
    ]);
    if (productsRes.error) throw productsRes.error;

    let supplierRows: ProductSupplierRow[] = [];
    if (suppliersRes.error) {
      // View belum ada (SQL 120 belum dipasang / cache skema belum dimuat ulang): katalog tetap tampil, kolom supplier "-".
      if (suppliersRes.error.code === 'PGRST205' || suppliersRes.error.code === '42P01') {
        console.warn('v_product_suppliers belum tersedia; kolom Supplier terakhir dikosongkan');
      } else {
        throw suppliersRes.error;
      }
    } else {
      supplierRows = (suppliersRes.data ?? []) as ProductSupplierRow[];
    }

    const products = ((productsRes.data ?? []) as Product[]).map(normalizeProduct);
    return mergeProductSuppliers(products, supplierRows).filter((p) => matchesProductSearch(p, query));
  },

  // Saran kategori untuk form: daftar tetap (BASE_CATEGORIES) + kategori yang pernah dipakai produk mana pun
  // (termasuk produk nonaktif), tanpa duplikat beda huruf. Tidak pernah kosong.
  async getCategorySuggestions(): Promise<string[]> {
    const { data, error } = await getSupabaseAdmin().from('products').select('category').limit(MAX_ROWS);
    if (error) throw error;
    return buildCategorySuggestions((data ?? []).map((r) => r.category));
  },

  // Kategori untuk filter halaman Produk: hanya yang dipakai produk aktif saat ini.
  async getUsedCategories(): Promise<string[]> {
    const { data, error } = await getSupabaseAdmin().from('products').select('category').eq('is_active', true).limit(MAX_ROWS);
    if (error) throw error;
    return uniqueCategories((data ?? []).map((r) => r.category));
  },

  async getById(id: number): Promise<Product | null> {
    const { data, error } = await getSupabaseAdmin().from('products').select('*').eq('id', id).eq('is_active', true).maybeSingle();
    if (error) throw error;
    return data ? normalizeProduct(data as Product) : null;
  },

  // stock_current di sini = saldo awal saat produk pertama kali dibuat (INSERT), bukan perubahan stok.
  async create(data: { name: string; category: string; stock_current: number; stock_minimum: number }): Promise<Product> {
    const { data: created, error } = await getSupabaseAdmin()
      .from('products')
      // needs_review tidak dikirim: produk dari dashboard memakai default database.
      .insert([{
        name: data.name,
        category: data.category,
        unit: 'pcs',
        stock_current: Math.max(0, data.stock_current),
        stock_minimum: data.stock_minimum
      }])
      .select('*')
      .single();
    if (error) {
      if (error.code === UNIQUE_VIOLATION) throw new BusinessError('Produk dengan nama itu sudah ada', 409);
      throw error;
    }
    return normalizeProduct(created as Product);
  },

  async update(id: number, data: { name?: string; category?: string; stock_minimum?: number }): Promise<Product | null> {
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.category !== undefined) patch.category = data.category;
    if (data.stock_minimum !== undefined) patch.stock_minimum = data.stock_minimum;
    // stock_current, unit, qty_per_karton sengaja tidak bisa diubah dari sini. needs_review juga tidak:
    // trigger database menghapusnya saat nama/kategori/minimum berubah.

    if (Object.keys(patch).length === 0) return this.getById(id);

    const { data: updated, error } = await getSupabaseAdmin()
      .from('products').update(patch).eq('id', id).eq('is_active', true).select('*').maybeSingle();
    if (error) {
      if (error.code === UNIQUE_VIOLATION) throw new BusinessError('Produk dengan nama itu sudah ada', 409);
      throw error;
    }
    return updated ? normalizeProduct(updated as Product) : null;
  },

  async delete(id: number): Promise<boolean> {
    const { data, error } = await getSupabaseAdmin()
      .from('products').update({ is_active: false }).eq('id', id).eq('is_active', true).select('id');
    if (error) throw error;
    return (data?.length ?? 0) > 0;
  }
};

// ============================================================================
// SUPPLIER. Cara utama menghentikan pemakaian supplier = nonaktifkan (is_active=false, SQL 119);
// riwayat dan laporan tetap utuh. Hapus permanen hanya untuk supplier yang belum pernah dipakai,
// dan yang memutuskan adalah foreign key database (23503), bukan hitungan di kode.
// Supplier sistem "Koreksi Stok" (is_adjustment) tidak punya jenis dan tidak bisa
// diubah, dinonaktifkan, atau dihapus.
// ============================================================================
export const SupplierService = {
  async getAll(): Promise<Supplier[]> {
    const { data, error } = await getSupabaseAdmin()
      .from('v_supplier_stats')
      .select('id, name, jenis, created_at, transaction_count, last_restock_date, is_adjustment, is_active')
      .order('name', { ascending: true });
    if (error) throw error;
    return ((data ?? []) as SupplierRow[]).map((s) => normalizeSupplier({
      ...s,
      transaction_count: s.transaction_count ?? 0,
      last_restock_date: s.last_restock_date ?? null
    }));
  },

  async getById(id: number): Promise<Supplier | null> {
    const { data, error } = await getSupabaseAdmin()
      .from('suppliers').select(SUPPLIER_COLUMNS).eq('id', id).maybeSingle();
    if (error) throw error;
    return data ? normalizeSupplier(data) : null;
  },

  async create(name: string, jenis: SupplierJenis): Promise<Supplier> {
    const db = getSupabaseAdmin();
    // Termasuk supplier nonaktif: namanya tetap terkunci, cukup diaktifkan lagi.
    const { data: dup, error: dupErr } = await db
      .from('suppliers').select('id, is_active').ilike('name', escapeLike(name)).limit(1);
    if (dupErr) throw dupErr;
    if (dup && dup.length > 0) {
      throw new BusinessError(
        dup[0].is_active === false
          ? 'Nama supplier sudah terdaftar tetapi nonaktif. Centang "Tampilkan yang nonaktif" lalu aktifkan.'
          : 'Nama supplier sudah terdaftar',
        409
      );
    }

    const { data: created, error } = await db
      .from('suppliers').insert([{ name, jenis }]).select(SUPPLIER_COLUMNS).single();
    if (error) {
      if (error.code === UNIQUE_VIOLATION) throw new BusinessError('Nama supplier sudah terdaftar', 409);
      throw error;
    }
    return normalizeSupplier(created);
  },

  // Ringkasan barang masuk (bukan koreksi) per jenis supplier untuk rentang tanggal WIB.
  // Supplier nonaktif tetap dihitung: transaksinya fakta masa lalu.
  async masukPerJenis(range: DateRange): Promise<MasukPerJenisRow[]> {
    const rows = await fetchTransactions('qty, source, note, suppliers(jenis, is_adjustment)', { ...range, type: 'in' });
    const totals = new Map<SupplierJenis, MasukPerJenisRow>(
      SUPPLIER_JENIS.map((j) => [j, { jenis: j, total_qty: 0, transaction_count: 0 }])
    );
    for (const r of rows) {
      const kind = classifyTransaction({
        type: 'in', source: r.source, supplierIsAdjustment: !!r.suppliers?.is_adjustment, note: r.note
      });
      if (kind !== 'masuk') continue;
      const jenis = normalizeJenis(r.suppliers?.jenis);
      if (!jenis) continue;
      const row = totals.get(jenis)!;
      row.total_qty += num(r.qty);
      row.transaction_count += 1;
    }
    return [...totals.values()];
  },

  async update(id: number, data: { name?: string; jenis?: SupplierJenis }): Promise<Supplier | null> {
    const current = await this.getById(id);
    if (!current) return null;
    if (current.is_adjustment) throw new BusinessError(SUPPLIER_SISTEM_MESSAGE, 403);
    const patch: Record<string, unknown> = {};
    if (data.name !== undefined) patch.name = data.name;
    if (data.jenis !== undefined) patch.jenis = data.jenis;
    if (Object.keys(patch).length === 0) return current;

    const { data: updated, error } = await getSupabaseAdmin()
      .from('suppliers').update(patch).eq('id', id).eq('is_adjustment', false)
      .select(SUPPLIER_COLUMNS).maybeSingle();
    if (error) {
      if (error.code === UNIQUE_VIOLATION) throw new BusinessError('Nama supplier sudah terdaftar', 409);
      if (isCheckViolation(error)) throw new BusinessError(SUPPLIER_SISTEM_MESSAGE, 403);
      throw error;
    }
    return updated ? normalizeSupplier(updated) : null;
  },

  // Aktifkan / nonaktifkan. null = tidak ada baris. "Koreksi Stok" ditolak sebelum UPDATE dijalankan.
  async setActive(id: number, isActive: boolean): Promise<Supplier | null> {
    const current = await this.getById(id);
    if (!current) return null;
    if (current.is_adjustment) throw new BusinessError(SUPPLIER_SISTEM_MESSAGE, 403);

    const { data: updated, error } = await getSupabaseAdmin()
      .from('suppliers').update({ is_active: isActive }).eq('id', id).eq('is_adjustment', false)
      .select(SUPPLIER_COLUMNS).maybeSingle();
    if (error) {
      if (isCheckViolation(error)) throw new BusinessError(SUPPLIER_SISTEM_MESSAGE, 403);
      throw error;
    }
    return updated ? normalizeSupplier(updated) : null;
  },

  // Hapus permanen. Sengaja TIDAK menghitung transaksi dulu (rawan balapan): DELETE langsung,
  // foreign key transactions -> suppliers menolak (23503) bila sudah ada riwayat.
  // false = tidak ada baris yang terhapus.
  async deletePermanent(id: number): Promise<boolean> {
    const current = await this.getById(id);
    if (!current) return false;
    if (current.is_adjustment) throw new BusinessError(SUPPLIER_SISTEM_MESSAGE, 403);

    const { data, error } = await getSupabaseAdmin()
      .from('suppliers').delete().eq('id', id).eq('is_adjustment', false).select('id');
    if (error) {
      if (error.code === FOREIGN_KEY_VIOLATION) {
        throw new BusinessError(SUPPLIER_PUNYA_RIWAYAT_MESSAGE, 409, 'HAS_TRANSACTIONS');
      }
      if (isCheckViolation(error)) throw new BusinessError(SUPPLIER_SISTEM_MESSAGE, 403);
      throw error;
    }
    return (data?.length ?? 0) > 0;
  }
};

// Supplier untuk stok masuk: harus ada, bukan "Koreksi Stok", dan aktif. Database tetap menjaga
// aturan yang sama (check_violation); ini supaya pesannya jelas dan pemeriksaan pasangan tidak sia-sia.
export async function assertSupplierForStockIn(supplierId: number): Promise<Supplier> {
  const supplier = await SupplierService.getById(supplierId);
  if (!supplier) throw new BusinessError('Supplier tidak terdaftar. Tambahkan dulu di halaman Supplier.', 404);
  if (supplier.is_adjustment) throw new BusinessError(KOREKSI_STOK_IN_MESSAGE, 400, 'SUPPLIER_SISTEM');
  if (!supplier.is_active) throw new BusinessError(SUPPLIER_NONAKTIF_MESSAGE, 409, 'SUPPLIER_NONAKTIF');
  return supplier;
}

// Ambil transaksi per halaman (maks MAX_ROWS) dengan filter dasar.
async function fetchTransactions(select: string, filters: DateRange & { productId?: number | null; type?: TransactionType }) {
  const db = getSupabaseAdmin();
  const rows: any[] = [];
  for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
    let builder = db
      .from('transactions')
      .select(select)
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .range(from, from + PAGE_SIZE - 1);
    if (filters.type) builder = builder.eq('type', filters.type);
    if (filters.productId) builder = builder.eq('product_id', filters.productId);
    if (filters.startDate) builder = builder.gte('created_at', wibStart(filters.startDate));
    if (filters.endDate) builder = builder.lte('created_at', wibEnd(filters.endDate));
    const { data, error } = await builder;
    if (error) throw error;
    rows.push(...(data ?? []));
    if (!data || data.length < PAGE_SIZE) break;
  }
  return rows;
}

// ============================================================================
// TRANSAKSI. Penulisan lewat fungsi database atomik (kunci baris, tolak stok negatif,
// kunci idempotensi), fungsi yang sama dengan yang dipakai bot Telegram.
// ============================================================================
export const TransactionService = {
  async getHistory(filters: DateRange & {
    productId?: number | null;
    type?: TransactionType | 'all';
    kind?: TransactionKind | 'all';
  } = {}): Promise<Transaction[]> {
    const kind = filters.kind && filters.kind !== 'all' ? filters.kind : null;
    // Saring tipe di database; jenis (opname/manual/koreksi) disaring setelah klasifikasi
    // supaya tetap jalan sebelum maupun sesudah kolom transactions.source ada.
    let type: TransactionType | undefined = filters.type && filters.type !== 'all' ? filters.type : undefined;
    if (kind) type = kind === 'stok_awal' ? undefined : kind === 'masuk' || kind === 'koreksi' ? 'in' : 'out';

    const rows = await fetchTransactions('*, products(*), suppliers(*)', { ...filters, type });
    const list = rows.map(normalizeTransaction);
    return kind ? list.filter((t) => t.kind === kind) : list;
  },

  // true bila produk ini belum pernah masuk dari supplier ini (RPC fn_pair_baru, SQL 113).
  // Supplier "Koreksi Stok" dan supplier nonaktif ditolak lebih dulu (lihat assertSupplierForStockIn).
  async isNewPair(productId: number, supplierId: number): Promise<boolean> {
    await assertSupplierForStockIn(supplierId);
    const { data, error } = await getSupabaseAdmin().rpc('fn_pair_baru', {
      p_product_id: productId,
      p_supplier_id: supplierId
    });
    if (error) throw error;
    return data === true;
  },

  async create(data: {
    product_id: number;
    user_id: string;
    supplier_id?: number | null;
    type: TransactionType;
    qty: number;
    note?: string | null;
    idempotency_key?: string;
  }) {
    const key = data.idempotency_key && /^[0-9a-f-]{36}$/i.test(data.idempotency_key)
      ? data.idempotency_key
      : crypto.randomUUID();
    const { data: result, error } = await getSupabaseAdmin().rpc('fn_dashboard_record_movement', {
      p_user_id: data.user_id,
      p_type: data.type,
      p_product_id: data.product_id,
      p_qty: data.qty,
      p_supplier_id: data.type === 'in' ? data.supplier_id ?? null : null,
      p_note: data.note ?? null,
      p_idem_key: `web:${key}`
    });
    if (error) {
      // SQL 116/119: stok masuk ke supplier nonaktif atau ke "Koreksi Stok" ditolak dengan check_violation.
      if (isCheckViolation(error)) {
        if (mentions(error, 'SUPPLIER_NONAKTIF')) throw new BusinessError(SUPPLIER_NONAKTIF_MESSAGE, 409, 'SUPPLIER_NONAKTIF');
        if (data.type === 'in') throw new BusinessError(KOREKSI_STOK_IN_MESSAGE, 400, 'SUPPLIER_SISTEM');
        throw new BusinessError('Transaksi ditolak oleh aturan database');
      }
      throw error;
    }

    if (!result?.ok) {
      switch (result?.code) {
        case 'INSUFFICIENT_STOCK':
          throw new BusinessError(`Stok tidak mencukupi. Stok saat ini: ${result.stock} ${result.unit ?? 'pcs'}`);
        case 'PRODUCT_NOT_FOUND':
          throw new BusinessError('Produk tidak ditemukan', 404);
        case 'SUPPLIER_UNKNOWN':
          throw new BusinessError('Supplier tidak terdaftar. Tambahkan dulu di halaman Supplier.');
        case 'SUPPLIER_NONAKTIF':
          throw new BusinessError(SUPPLIER_NONAKTIF_MESSAGE, 409, 'SUPPLIER_NONAKTIF');
        case 'SUPPLIER_REQUIRED':
          throw new BusinessError('Supplier wajib dipilih untuk transaksi stok masuk');
        default:
          throw new BusinessError('Transaksi ditolak oleh database');
      }
    }

    const item = result.items?.[0];
    return {
      success: true,
      type: data.type,
      qty: data.qty,
      product: item?.product,
      unit: item?.unit,
      stock_after: item?.stock,
      supplier: result.supplier ?? null
    };
  },

  async getDashboardSummary(): Promise<DashboardStats> {
    const db = getSupabaseAdmin();

    const [products, recent] = await Promise.all([
      ProductService.getAll(),
      db.from('transactions').select('*, products(*), suppliers(*)')
        .order('created_at', { ascending: false }).order('id', { ascending: false }).limit(5)
    ]);
    if (recent.error) throw recent.error;

    const low = products.filter((p) => p.stock_current <= p.stock_minimum);
    const now = new Date();

    return {
      total_products: products.length,
      perlu_dihitung_count: products.filter((p) => isCountStale(p.last_counted_at, now)).length,
      low_stock_count: low.length,
      needs_review_count: products.filter((p) => p.needs_review).length,
      low_stock_products: low.sort((a, b) => a.stock_current - b.stock_current),
      recent_transactions: (recent.data ?? []).map(normalizeTransaction)
    };
  }
};

// ============================================================================
// STOK OPNAME (Tahap 2, SQL 114). Hanya baca: opname dicatat lewat bot Telegram.
// Sengaja memakai tabel dasar + gabungan di kode (tanpa embed PostgREST) agar tidak
// bergantung pada nama foreign key.
// ============================================================================
const OPNAME_LIST_LIMIT = 300;
const OPNAME_JENIS: OpnameItemJenis[] = ['keluar', 'koreksi', 'baseline'];

async function productNames(ids: number[]): Promise<Map<number, { name: string; category: string | null }>> {
  const unique = [...new Set(ids)];
  const map = new Map<number, { name: string; category: string | null }>();
  for (let i = 0; i < unique.length; i += 500) {
    const chunk = unique.slice(i, i + 500);
    const { data, error } = await getSupabaseAdmin().from('products').select('id, name, category').in('id', chunk);
    if (error) throw error;
    for (const p of data ?? []) map.set(p.id, { name: p.name, category: p.category ?? null });
  }
  return map;
}

export const OpnameService = {
  async list(filters: DateRange & { productId?: number | null } = {}): Promise<OpnameSession[]> {
    const db = getSupabaseAdmin();
    let builder = db
      .from('stock_opnames')
      .select('id, user_id, created_at, note')
      .order('created_at', { ascending: false })
      .order('id', { ascending: false })
      .limit(OPNAME_LIST_LIMIT);
    if (filters.startDate) builder = builder.gte('created_at', wibStart(filters.startDate));
    if (filters.endDate) builder = builder.lte('created_at', wibEnd(filters.endDate));
    const { data: sessions, error } = await builder;
    if (error) throw error;
    if (!sessions || sessions.length === 0) return [];

    const ids = sessions.map((s) => s.id);
    const items: { opname_id: number; product_id: number }[] = [];
    for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
      const { data, error: itemErr } = await db
        .from('stock_opname_items').select('opname_id, product_id').in('opname_id', ids)
        .order('id', { ascending: true }).range(from, from + PAGE_SIZE - 1);
      if (itemErr) throw itemErr;
      items.push(...(data ?? []));
      if (!data || data.length < PAGE_SIZE) break;
    }

    const byOpname = new Map<number, number[]>();
    for (const it of items) {
      const arr = byOpname.get(it.opname_id) ?? [];
      arr.push(it.product_id);
      byOpname.set(it.opname_id, arr);
    }
    const users = await usernamesByIds(sessions.map((s) => s.user_id));

    return sessions
      .filter((s) => !filters.productId || (byOpname.get(s.id) ?? []).includes(filters.productId))
      .map((s) => ({
        id: s.id,
        created_at: s.created_at,
        note: s.note ?? null,
        user_id: s.user_id ?? null,
        username: s.user_id ? users.get(s.user_id) ?? null : null,
        item_count: byOpname.get(s.id)?.length ?? 0
      }));
  },

  // Rata-rata keluar per hari per produk untuk rentang tanggal (berdasarkan created_at item opname).
  // Dihitung dari stock_opname_items, bukan v_keluar_per_hari, karena view itu tetap 30 hari terakhir
  // dan tidak bisa disaring tanggal.
  async keluarPerHari(range: DateRange, category?: string | null): Promise<KeluarPerHariRow[]> {
    const db = getSupabaseAdmin();
    const items: { product_id: number; keluar: number; hari: number | null; jenis: string; created_at: string }[] = [];
    for (let from = 0; from < MAX_ROWS; from += PAGE_SIZE) {
      let builder = db
        .from('stock_opname_items')
        .select('product_id, keluar, hari, jenis, created_at')
        .order('id', { ascending: true })
        .range(from, from + PAGE_SIZE - 1);
      if (range.startDate) builder = builder.gte('created_at', wibStart(range.startDate));
      if (range.endDate) builder = builder.lte('created_at', wibEnd(range.endDate));
      const { data, error } = await builder;
      if (error) throw error;
      items.push(...(data ?? []));
      if (!data || data.length < PAGE_SIZE) break;
    }

    const agg = aggregateKeluarPerHari(items);
    const names = await productNames(agg.map((r) => r.product_id));
    return agg
      .map((r) => ({
        ...r,
        product_name: names.get(r.product_id)?.name ?? `Produk #${r.product_id}`,
        category: names.get(r.product_id)?.category ?? null
      }))
      .filter((r) => !category || r.category === category);
  },

  async detail(id: number): Promise<OpnameDetail | null> {
    const db = getSupabaseAdmin();
    const { data: s, error } = await db.from('stock_opnames').select('id, user_id, created_at, note').eq('id', id).maybeSingle();
    if (error) throw error;
    if (!s) return null;

    const { data: rawItems, error: itemErr } = await db
      .from('stock_opname_items')
      .select('id, opname_id, product_id, stok_sistem, hitungan, masuk_setelah_hitung, keluar, koreksi, jenis, hari, created_at')
      .eq('opname_id', id)
      .order('id', { ascending: true })
      .limit(MAX_ROWS);
    if (itemErr) throw itemErr;

    const names = await productNames((rawItems ?? []).map((r) => r.product_id));
    const users = await usernamesByIds(s.user_id ? [s.user_id] : []);

    const items: OpnameItem[] = (rawItems ?? []).map((r) => {
      const keluar = num(r.keluar);
      const hari = r.hari === null || r.hari === undefined ? null : num(r.hari);
      return {
        id: r.id,
        opname_id: r.opname_id,
        product_id: r.product_id,
        product_name: names.get(r.product_id)?.name ?? `Produk #${r.product_id}`,
        category: names.get(r.product_id)?.category ?? null,
        stok_sistem: num(r.stok_sistem),
        hitungan: num(r.hitungan),
        masuk_setelah_hitung: num(r.masuk_setelah_hitung),
        keluar,
        koreksi: num(r.koreksi),
        jenis: OPNAME_JENIS.includes(r.jenis) ? r.jenis : 'keluar',
        hari,
        keluar_per_hari: perDay(keluar, hari),
        created_at: r.created_at
      };
    });

    return {
      id: s.id,
      created_at: s.created_at,
      note: s.note ?? null,
      user_id: s.user_id ?? null,
      username: s.user_id ? users.get(s.user_id) ?? null : null,
      item_count: items.length,
      items
    };
  }
};
