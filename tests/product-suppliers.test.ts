// Supplier terakhir per produk (SQL 120, v_product_suppliers): pemetaan, pencarian, dan query getCatalog.
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  mergeProductSuppliers, matchesProductSearch, otherSuppliersLabel, splitSupplierNames, ProductSupplierRow
} from '@/lib/product-suppliers';
import { Product } from '@/types';

const product = (id: number, name: string): Product => ({
  id, name, category: 'Mie', unit: 'pcs', qty_per_karton: null, stock_current: 5, stock_minimum: 2, created_at: '2026-01-01T00:00:00Z'
});
const row = (r: Partial<ProductSupplierRow> & { product_id: number }): ProductSupplierRow => ({
  last_supplier_id: null, last_supplier_name: null, last_in_at: null, last_supplier_active: null,
  supplier_count: 0, supplier_names: null, ...r
});

describe('mergeProductSuppliers', () => {
  const products = [product(1, 'Indomie Goreng'), product(2, 'Royco'), product(3, 'Sabun Lux'), product(4, 'Kecap')];
  const rows = [
    row({ product_id: 2, last_supplier_id: 10, last_supplier_name: 'Indofood', last_in_at: '2026-11-15T03:00:00Z', last_supplier_active: true, supplier_count: 1, supplier_names: 'Indofood' }),
    row({ product_id: 3, last_supplier_id: 11, last_supplier_name: 'Unilever', last_in_at: '2026-11-10T03:00:00Z', last_supplier_active: true, supplier_count: '3', supplier_names: 'Unilever, Grosir Pak Joko ,Wings' }),
    row({ product_id: 4, last_supplier_id: 12, last_supplier_name: 'Toko Lama', last_in_at: '2026-10-01T03:00:00Z', last_supplier_active: false, supplier_count: 1, supplier_names: 'Toko Lama' }),
    // Baris untuk produk yang tidak ada di katalog (misalnya sudah dihapus) diabaikan.
    row({ product_id: 99, last_supplier_id: 10, last_supplier_name: 'Indofood', supplier_count: 1 })
  ];
  const merged = mergeProductSuppliers(products, rows);

  it('tanpa riwayat: supplier kosong, count 0', () => {
    expect(merged[0]).toMatchObject({ id: 1, last_supplier_id: null, last_supplier_name: null, last_in_at: null, supplier_count: 0, supplier_names: [] });
  });
  it('satu supplier: nama + tanggal, tanpa "+N lainnya"', () => {
    expect(merged[1]).toMatchObject({ last_supplier_name: 'Indofood', last_in_at: '2026-11-15T03:00:00Z', last_supplier_active: true, supplier_count: 1 });
    expect(otherSuppliersLabel(merged[1].supplier_count)).toBeNull();
  });
  it('banyak supplier: count dari string, nama dirapikan (terbaru dulu), "+2 lainnya"', () => {
    expect(merged[2].supplier_count).toBe(3);
    expect(merged[2].supplier_names).toEqual(['Unilever', 'Grosir Pak Joko', 'Wings']);
    expect(otherSuppliersLabel(merged[2].supplier_count)).toBe('+2 lainnya');
  });
  it('supplier terakhir nonaktif ditandai', () => {
    expect(merged[3]).toMatchObject({ last_supplier_name: 'Toko Lama', last_supplier_active: false });
  });
  it('urutan dan field produk tetap, jumlah baris = jumlah produk', () => {
    expect(merged.map((p) => p.id)).toEqual([1, 2, 3, 4]);
    expect(merged[0]).toMatchObject({ name: 'Indomie Goreng', stock_current: 5 });
  });
  it('splitSupplierNames: kosong -> []', () => {
    expect(splitSupplierNames(null)).toEqual([]);
    expect(splitSupplierNames(' , ')).toEqual([]);
  });
});

describe('matchesProductSearch', () => {
  const p = { name: 'Sabun Lux', last_supplier_name: 'Unilever' };
  it('cocok nama produk atau nama supplier terakhir, tanpa beda huruf besar/kecil', () => {
    expect(matchesProductSearch(p, 'lux')).toBe(true);
    expect(matchesProductSearch(p, 'UNILE')).toBe(true);
    expect(matchesProductSearch(p, 'wings')).toBe(false);
  });
  it('kata kunci kosong cocok semua; produk tanpa supplier hanya cocok lewat nama', () => {
    expect(matchesProductSearch(p, '')).toBe(true);
    expect(matchesProductSearch(p, '  ')).toBe(true);
    expect(matchesProductSearch({ name: 'Kecap', last_supplier_name: null }, 'indofood')).toBe(false);
    expect(matchesProductSearch({ name: 'Kecap' }, 'kec')).toBe(true);
  });
});

// ---- ProductService.getCatalog dengan Supabase di-mock ----
type Result = { data?: unknown; error?: unknown };
const fake = vi.hoisted(() => {
  const state = { results: {} as Record<string, Result>, tables: [] as string[] };
  const from = (table: string) => {
    state.tables.push(table);
    const builder: Record<string, unknown> = {};
    for (const op of ['select', 'eq', 'order', 'limit', 'ilike', 'in']) builder[op] = () => builder;
    builder.then = (resolve: (r: Result) => unknown) =>
      Promise.resolve({ data: null, error: null, ...(state.results[table] ?? {}) }).then(resolve);
    return builder;
  };
  return { state, client: { from } };
});
vi.mock('@/lib/supabase', () => ({ getSupabaseAdmin: () => fake.client }));

import { ProductService } from '@/lib/db';

describe('ProductService.getCatalog', () => {
  beforeEach(() => {
    fake.state.tables = [];
    fake.state.results = {
      v_products: { data: [product(1, 'Indomie Goreng'), product(3, 'Sabun Lux')] },
      v_product_suppliers: { data: [row({ product_id: 3, last_supplier_id: 11, last_supplier_name: 'Unilever', supplier_count: 2, supplier_names: 'Unilever, Wings' })] }
    };
    vi.spyOn(console, 'warn').mockImplementation(() => {});
  });

  it('tepat dua query (v_products + v_product_suppliers), bukan per baris', async () => {
    const list = await ProductService.getCatalog();
    expect(fake.state.tables.sort()).toEqual(['v_product_suppliers', 'v_products']);
    expect(list.find((p) => p.id === 3)).toMatchObject({ last_supplier_name: 'Unilever', supplier_count: 2 });
    expect(list.find((p) => p.id === 1)).toMatchObject({ last_supplier_name: null, supplier_count: 0 });
  });

  it('pencarian mencocokkan nama supplier terakhir', async () => {
    expect((await ProductService.getCatalog('unilever')).map((p) => p.id)).toEqual([3]);
    expect((await ProductService.getCatalog('indomie')).map((p) => p.id)).toEqual([1]);
  });

  it('view belum ada (SQL 120 belum dipasang): katalog tetap tampil tanpa supplier', async () => {
    fake.state.results.v_product_suppliers = { error: { code: 'PGRST205', message: 'Could not find the table' } };
    const list = await ProductService.getCatalog();
    expect(list).toHaveLength(2);
    expect(list.every((p) => p.supplier_count === 0)).toBe(true);
  });

  it('error lain dari view tetap dilempar', async () => {
    fake.state.results.v_product_suppliers = { error: { code: '42501', message: 'permission denied' } };
    await expect(ProductService.getCatalog()).rejects.toMatchObject({ code: '42501' });
  });
});
