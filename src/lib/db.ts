import fs from 'fs';
import path from 'path';
import bcrypt from 'bcryptjs';
import { supabaseAdmin, isSupabaseConfigured } from './supabase';
import { User, Product, Supplier, Transaction, DashboardStats, TransactionType } from '@/types';

const DATA_FILE_PATH = path.join(process.cwd(), 'data', 'warung_prapatan.json');
const DEFAULT_STOCK_MINIMUM = 10;

function normalizeProduct(product: Product): Product {
  return {
    ...product,
    qty_per_karton: product.qty_per_karton ? Number(product.qty_per_karton) : null,
    stock_minimum: Number(product.stock_minimum ?? DEFAULT_STOCK_MINIMUM)
  };
}

interface LocalDatabase {
  users: User[];
  suppliers: Supplier[];
  products: Product[];
  transactions: Transaction[];
}

// In-memory cache for speed with write-through file persistence
let memoryCache: LocalDatabase | null = null;

function readLocalDb(): LocalDatabase {
  try {
    if (memoryCache) return memoryCache;
    if (!fs.existsSync(DATA_FILE_PATH)) {
      const initial: LocalDatabase = { users: [], suppliers: [], products: [], transactions: [] };
      fs.mkdirSync(path.dirname(DATA_FILE_PATH), { recursive: true });
      fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(initial, null, 2), 'utf-8');
      memoryCache = initial;
      return initial;
    }
    const raw = fs.readFileSync(DATA_FILE_PATH, 'utf-8');
    memoryCache = JSON.parse(raw);
    return memoryCache!;
  } catch (error) {
    console.error('Gagal membaca database lokal:', error);
    return { users: [], suppliers: [], products: [], transactions: [] };
  }
}

function writeLocalDb(data: LocalDatabase): void {
  try {
    memoryCache = data;
    fs.mkdirSync(path.dirname(DATA_FILE_PATH), { recursive: true });
    fs.writeFileSync(DATA_FILE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (error) {
    console.error('Gagal menulis database lokal:', error);
  }
}

// ============================================================================
// AUTH SERVICE (Sesuai Class Diagram Bab 2.2.4)
// ============================================================================
export const AuthService = {
  async login(username: string, passwordPlain: string): Promise<User | null> {
    if (isSupabaseConfigured && supabaseAdmin) {
      try {
        const { data: user, error } = await supabaseAdmin
          .from('users')
          .select('*')
          .eq('username', username)
          .single();

        if (error || !user) {
          return null;
        }

        const isPasswordMatch = await bcrypt.compare(passwordPlain, user.password);
        if (!isPasswordMatch) return null;

        const { password: _, ...safeUser } = user;
        return safeUser as User;
      } catch (err) {
        console.warn('Fallback ke penyimpanan lokal karena Supabase:', err);
      }
    }

    const db = readLocalDb();
    const user = db.users.find(u => u.username.toLowerCase() === username.toLowerCase());
    if (!user) return null;

    const isMatch = await bcrypt.compare(passwordPlain, user.password || '');
    if (!isMatch) return null;

    const { password: _, ...safeUser } = user;
    return safeUser as User;
  },

  async getUserById(id: string): Promise<User | null> {
    if (isSupabaseConfigured && supabaseAdmin) {
      try {
        const { data: user } = await supabaseAdmin
          .from('users')
          .select('id, username, telegram_chat_id, created_at')
          .eq('id', id)
          .single();
        if (user) return user as User;
      } catch {
        // fallback
      }
    }
    const db = readLocalDb();
    const u = db.users.find(item => item.id === id);
    if (!u) return null;
    const { password: _, ...safeUser } = u;
    return safeUser as User;
  },

  async getUserByChatId(chatId: string): Promise<User | null> {
    if (isSupabaseConfigured && supabaseAdmin) {
      try {
        const { data: user } = await supabaseAdmin
          .from('users')
          .select('id, username, telegram_chat_id, created_at')
          .eq('telegram_chat_id', chatId)
          .single();
        if (user) return user as User;
      } catch {
        // fallback
      }
    }
    const db = readLocalDb();
    const u = db.users.find(item => String(item.telegram_chat_id) === String(chatId));
    if (!u) return null;
    const { password: _, ...safeUser } = u;
    return safeUser as User;
  }
};

// ============================================================================
// PRODUCT SERVICE (Sesuai Class Diagram Bab 2.2.4)
// ============================================================================
export const ProductService = {
  async getAll(query?: string, category?: string): Promise<Product[]> {
    if (isSupabaseConfigured && supabaseAdmin) {
      try {
        let builder = supabaseAdmin.from('products').select('*').order('name', { ascending: true });
        if (category && category !== 'Semua') {
          builder = builder.eq('category', category);
        }
        if (query) {
          builder = builder.ilike('name', `%${query}%`);
        }
        const { data, error } = await builder;
        if (!error && data) return (data as Product[]).map(normalizeProduct);
      } catch (err) {
        console.warn('Supabase query produk gagal, gunakan data lokal:', err);
      }
    }

    const db = readLocalDb();
    let list = [...db.products];
    if (category && category !== 'Semua') {
      list = list.filter(p => p.category.toLowerCase() === category.toLowerCase());
    }
    if (query) {
      const q = query.toLowerCase();
      list = list.filter(p => p.name.toLowerCase().includes(q) || p.category.toLowerCase().includes(q));
    }
    return list.map(normalizeProduct).sort((a, b) => a.name.localeCompare(b.name));
  },

  async getById(id: number): Promise<Product | null> {
    if (isSupabaseConfigured && supabaseAdmin) {
      try {
        const { data } = await supabaseAdmin.from('products').select('*').eq('id', id).single();
        if (data) return normalizeProduct(data as Product);
      } catch {
        // fallback
      }
    }
    const db = readLocalDb();
    return db.products.find(p => p.id === id) || null;
  },

  async findByName(name: string): Promise<Product | null> {
    const clean = name.trim().toLowerCase();
    const products = await this.getAll();
    // 1. Exact match
    const exact = products.find(p => p.name.toLowerCase() === clean);
    if (exact) return exact;

    // 2. Fuzzy / partial match (misal "indomie" mencakup "Indomie Goreng")
    const partial = products.find(p => 
      p.name.toLowerCase().includes(clean) || 
      clean.includes(p.name.toLowerCase())
    );
    return partial || null;
  },

  async create(data: Omit<Product, 'id' | 'created_at'>): Promise<Product> {
    if (isSupabaseConfigured && supabaseAdmin) {
      try {
        const { data: newProd, error } = await supabaseAdmin
          .from('products')
          .insert([{
            name: data.name,
            category: data.category,
            unit: data.unit || 'pcs',
            qty_per_karton: data.qty_per_karton ? Number(data.qty_per_karton) : null,
            stock_current: Number(data.stock_current) || 0,
            stock_minimum: Number(data.stock_minimum ?? DEFAULT_STOCK_MINIMUM)
          }])
          .select()
          .single();
        if (!error && newProd) return newProd as Product;
      } catch (err) {
        console.warn('Gagal buat produk di Supabase, simpan lokal:', err);
      }
    }

    const db = readLocalDb();
    const newId = db.products.length > 0 ? Math.max(...db.products.map(p => p.id)) + 1 : 1;
    const newProduct: Product = {
      id: newId,
      name: data.name.trim(),
      category: data.category.trim(),
      unit: (data.unit || 'pcs').trim(),
      qty_per_karton: data.qty_per_karton ? Number(data.qty_per_karton) : null,
      stock_current: Number(data.stock_current) || 0,
      stock_minimum: Number(data.stock_minimum ?? DEFAULT_STOCK_MINIMUM),
      created_at: new Date().toISOString()
    };
    db.products.push(newProduct);
    writeLocalDb(db);
    return newProduct;
  },

  async update(id: number, data: Partial<Omit<Product, 'id' | 'created_at'>>): Promise<Product | null> {
    if (isSupabaseConfigured && supabaseAdmin) {
      try {
        const { data: updated, error } = await supabaseAdmin
          .from('products')
          .update(data)
          .eq('id', id)
          .select()
          .single();
        if (!error && updated) return normalizeProduct(updated as Product);
      } catch (err) {
        console.warn('Gagal update produk di Supabase:', err);
      }
    }

    const db = readLocalDb();
    const index = db.products.findIndex(p => p.id === id);
    if (index === -1) return null;

    db.products[index] = {
      ...db.products[index],
      ...data,
      qty_per_karton: data.qty_per_karton !== undefined
        ? (data.qty_per_karton ? Number(data.qty_per_karton) : null)
        : (db.products[index].qty_per_karton || null),
      stock_current: data.stock_current !== undefined ? Number(data.stock_current) : db.products[index].stock_current,
      stock_minimum: data.stock_minimum !== undefined
        ? Number(data.stock_minimum)
        : Number(db.products[index].stock_minimum ?? DEFAULT_STOCK_MINIMUM)
    };
    writeLocalDb(db);
    return db.products[index];
  },

  async delete(id: number): Promise<boolean> {
    if (isSupabaseConfigured && supabaseAdmin) {
      try {
        const { error } = await supabaseAdmin.from('products').delete().eq('id', id);
        if (!error) return true;
      } catch (err) {
        console.warn('Gagal hapus produk di Supabase:', err);
      }
    }

    const db = readLocalDb();
    const initialLen = db.products.length;
    db.products = db.products.filter(p => p.id !== id);
    db.transactions = db.transactions.filter(t => t.product_id !== id);
    if (db.products.length !== initialLen) {
      writeLocalDb(db);
      return true;
    }
    return false;
  },

  async updateStock(id: number, delta: number): Promise<Product | null> {
    const prod = await this.getById(id);
    if (!prod) return null;
    const newStock = Math.max(0, prod.stock_current + delta);
    return await this.update(id, { stock_current: newStock });
  }
};

// ============================================================================
// SUPPLIER SERVICE (Sesuai Class Diagram Bab 2.2.4 & Gambar 21)
// ============================================================================
export const SupplierService = {
  async getAll(): Promise<Supplier[]> {
    let suppliers: Supplier[] = [];
    let transactions: Transaction[] = [];

    if (isSupabaseConfigured && supabaseAdmin) {
      try {
        const [supRes, trxRes] = await Promise.all([
          supabaseAdmin.from('suppliers').select('*').order('name', { ascending: true }),
          supabaseAdmin.from('transactions').select('supplier_id, created_at, type')
        ]);
        if (!supRes.error && supRes.data) suppliers = supRes.data as Supplier[];
        if (!trxRes.error && trxRes.data) transactions = trxRes.data as Transaction[];
      } catch (err) {
        console.warn('Supabase query supplier gagal:', err);
      }
    }

    if (suppliers.length === 0) {
      const db = readLocalDb();
      suppliers = [...db.suppliers];
      transactions = [...db.transactions];
    }

    // Hitung jumlah transaksi & tanggal terakhir masuk untuk setiap supplier
    return suppliers.map(sup => {
      const relatedTrx = transactions.filter(t => t.supplier_id === sup.id && t.type === 'in');
      const count = relatedTrx.length;
      let lastDate: string | null = null;
      if (relatedTrx.length > 0) {
        const sorted = [...relatedTrx].sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
        lastDate = sorted[0].created_at;
      }
      return {
        ...sup,
        transaction_count: count,
        last_restock_date: lastDate
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  },

  async getById(id: number): Promise<Supplier | null> {
    if (isSupabaseConfigured && supabaseAdmin) {
      try {
        const { data } = await supabaseAdmin.from('suppliers').select('*').eq('id', id).single();
        if (data) return data as Supplier;
      } catch {
        // fallback
      }
    }
    const db = readLocalDb();
    return db.suppliers.find(s => s.id === id) || null;
  },

  // Alias create ke findOrCreate
  async create(name: string): Promise<Supplier> {
    return this.findOrCreate(name);
  },

  // Fitur F2, F13: Penambahan supplier secara otomatis saat transaksi stok masuk dicatat via chatbot
  async findOrCreate(name: string): Promise<Supplier> {
    const cleanName = name.trim();
    if (isSupabaseConfigured && supabaseAdmin) {
      try {
        // Cari apakah supplier sudah ada
        const { data: existing } = await supabaseAdmin
          .from('suppliers')
          .select('*')
          .ilike('name', cleanName)
          .single();
        if (existing) return existing as Supplier;

        // Jika belum ada, otomatis daftarkan supplier baru dari chatbot
        const { data: created, error } = await supabaseAdmin
          .from('suppliers')
          .insert([{ name: cleanName }])
          .select()
          .single();
        if (!error && created) return created as Supplier;
      } catch (err) {
        console.warn('Gagal findOrCreate supplier di Supabase:', err);
      }
    }

    const db = readLocalDb();
    const existing = db.suppliers.find(s => s.name.toLowerCase() === cleanName.toLowerCase());
    if (existing) return existing;

    const newId = db.suppliers.length > 0 ? Math.max(...db.suppliers.map(s => s.id)) + 1 : 1;
    const newSupplier: Supplier = {
      id: newId,
      name: cleanName,
      created_at: new Date().toISOString()
    };
    db.suppliers.push(newSupplier);
    writeLocalDb(db);
    return newSupplier;
  },

  // Fitur F14: Pemilik dapat mengubah nama supplier melalui dashboard jika ada kesalahan penulisan
  async updateName(id: number, newName: string): Promise<Supplier | null> {
    const cleanName = newName.trim();
    if (!cleanName) return null;

    if (isSupabaseConfigured && supabaseAdmin) {
      try {
        const { data: updated, error } = await supabaseAdmin
          .from('suppliers')
          .update({ name: cleanName })
          .eq('id', id)
          .select()
          .single();
        if (!error && updated) return updated as Supplier;
      } catch (err) {
        console.warn('Gagal update supplier di Supabase:', err);
      }
    }

    const db = readLocalDb();
    const idx = db.suppliers.findIndex(s => s.id === id);
    if (idx === -1) return null;

    db.suppliers[idx].name = cleanName;
    writeLocalDb(db);
    return db.suppliers[idx];
  }
};

// ============================================================================
// TRANSACTION SERVICE (Sesuai Class Diagram Bab 2.2.4 & Gambar 22)
// ============================================================================
export const TransactionService = {
  async getHistory(filters?: {
    startDate?: string;
    endDate?: string;
    productId?: number;
    type?: TransactionType | 'all';
  }): Promise<Transaction[]> {
    let transactions: Transaction[] = [];
    const products = await ProductService.getAll();
    const suppliers = await SupplierService.getAll();

    if (isSupabaseConfigured && supabaseAdmin) {
      try {
        let builder = supabaseAdmin
          .from('transactions')
          .select('*, products(*), suppliers(*)')
          .order('created_at', { ascending: false });

        if (filters?.type && filters.type !== 'all') {
          builder = builder.eq('type', filters.type);
        }
        if (filters?.productId) {
          builder = builder.eq('product_id', filters.productId);
        }
        if (filters?.startDate) {
          builder = builder.gte('created_at', new Date(filters.startDate).toISOString());
        }
        if (filters?.endDate) {
          const end = new Date(filters.endDate);
          end.setHours(23, 59, 59, 999);
          builder = builder.lte('created_at', end.toISOString());
        }

        const { data, error } = await builder;
        if (!error && data) {
          return data.map((t: any) => ({
            id: t.id,
            product_id: t.product_id,
            user_id: t.user_id,
            supplier_id: t.supplier_id,
            type: t.type,
            qty: t.qty,
            note: t.note,
            created_at: t.created_at,
            product: t.products,
            supplier: t.suppliers
          }));
        }
      } catch (err) {
        console.warn('Gagal query transaksi di Supabase, fallback:', err);
      }
    }

    const db = readLocalDb();
    transactions = [...db.transactions];

    if (filters?.type && filters.type !== 'all') {
      transactions = transactions.filter(t => t.type === filters.type);
    }
    if (filters?.productId) {
      transactions = transactions.filter(t => t.product_id === filters.productId);
    }
    if (filters?.startDate) {
      const start = new Date(filters.startDate).getTime();
      transactions = transactions.filter(t => new Date(t.created_at).getTime() >= start);
    }
    if (filters?.endDate) {
      const end = new Date(filters.endDate);
      end.setHours(23, 59, 59, 999);
      const endTime = end.getTime();
      transactions = transactions.filter(t => new Date(t.created_at).getTime() <= endTime);
    }

    // Join dengan tabel products dan suppliers
    const joined = transactions.map(t => ({
      ...t,
      product: products.find(p => p.id === t.product_id),
      supplier: t.supplier_id ? suppliers.find(s => s.id === t.supplier_id) : undefined
    }));

    return joined.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  async create(data: {
    product_id: number;
    user_id?: string;
    supplier_id?: number | null;
    type: TransactionType;
    qty: number;
    note?: string | null;
  }): Promise<Transaction> {
    const userId = data.user_id || 'e1a9c1e0-827b-4573-b391-7f8f9e68c5b1';
    const delta = data.type === 'in' ? data.qty : -data.qty;

    if (isSupabaseConfigured && supabaseAdmin) {
      try {
        const { data: trx, error } = await supabaseAdmin
          .from('transactions')
          .insert([{
            product_id: data.product_id,
            user_id: userId,
            supplier_id: data.supplier_id || null,
            type: data.type,
            qty: data.qty,
            note: data.note || null
          }])
          .select()
          .single();

        if (!error && trx) {
          // Trigger Postgres akan otomatis mengupdate stock, tapi pastikan sinkron
          const [product, supplier] = await Promise.all([
            ProductService.getById(data.product_id),
            data.supplier_id ? SupplierService.getById(data.supplier_id) : Promise.resolve(null)
          ]);

          return {
            ...trx,
            product: product || undefined,
            supplier: supplier || undefined
          };
        }
      } catch (err) {
        console.warn('Gagal insert transaksi di Supabase, fallback lokal:', err);
      }
    }

    const db = readLocalDb();
    const newId = db.transactions.length > 0 ? Math.max(...db.transactions.map(t => t.id)) + 1 : 1;
    const newTrx: Transaction = {
      id: newId,
      product_id: data.product_id,
      user_id: userId,
      supplier_id: data.supplier_id || null,
      type: data.type,
      qty: data.qty,
      note: data.note || null,
      created_at: new Date().toISOString()
    };

    // Update stok produk secara otomatis
    const prodIndex = db.products.findIndex(p => p.id === data.product_id);
    if (prodIndex !== -1) {
      db.products[prodIndex].stock_current = Math.max(0, db.products[prodIndex].stock_current + delta);
    }

    db.transactions.push(newTrx);
    writeLocalDb(db);

    const [product, supplier] = await Promise.all([
      ProductService.getById(data.product_id),
      data.supplier_id ? SupplierService.getById(data.supplier_id) : Promise.resolve(null)
    ]);

    return {
      ...newTrx,
      product: product || undefined,
      supplier: supplier || undefined
    };
  },

  // Ringkasan untuk Dashboard Utama (Gambar 19 & F9)
  async getDashboardSummary(): Promise<DashboardStats> {
    const products = await ProductService.getAll();
    const allTransactions = await this.getHistory();

    // Hitung transaksi hari ini (waktu lokal hari ini 00:00:00)
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayTime = today.getTime();

    const todayTrx = allTransactions.filter(t => new Date(t.created_at).getTime() >= todayTime);

    const lowStockProducts = products.filter(p => p.stock_current <= p.stock_minimum);

    return {
      total_products: products.length,
      today_transactions_count: todayTrx.length,
      low_stock_count: lowStockProducts.length,
      low_stock_products: lowStockProducts.sort((a, b) => a.stock_current - b.stock_current),
      recent_transactions: allTransactions.slice(0, 5)
    };
  },

  // Rekap transaksi harian untuk Chatbot Telegram (Gambar 6, Gambar 27 & F6)
  async getDailyRecap(targetDate?: string) {
    const dateObj = targetDate ? new Date(targetDate) : new Date();
    dateObj.setHours(0, 0, 0, 0);
    const start = dateObj.getTime();
    dateObj.setHours(23, 59, 59, 999);
    const end = dateObj.getTime();

    const history = await this.getHistory();
    const dailyTrx = history.filter(t => {
      const tTime = new Date(t.created_at).getTime();
      return tTime >= start && tTime <= end;
    });

    const masukTrx = dailyTrx.filter(t => t.type === 'in');
    const keluarTrx = dailyTrx.filter(t => t.type === 'out');

    // Susun ringkasan per produk
    const details = dailyTrx.map(t => {
      const prodName = t.product?.name || `Produk #${t.product_id}`;
      const sign = t.type === 'in' ? '+' : '-';
      const supplierPart = t.type === 'in' && t.supplier?.name ? ` (${t.supplier.name})` : '';
      return `${sign} ${prodName} ${t.qty} ${t.product?.unit || 'pcs'}${supplierPart}`;
    });

    return {
      dateFormatted: new Intl.DateTimeFormat('id-ID', { dateStyle: 'long' }).format(dateObj),
      totalTransactions: dailyTrx.length,
      masukCount: masukTrx.length,
      keluarCount: keluarTrx.length,
      details,
      transactions: dailyTrx
    };
  }
};
