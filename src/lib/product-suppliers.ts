// Helper murni (tanpa akses database): gabungkan produk dengan supplier terakhir dari
// v_product_suppliers (SQL 120) dan pencarian produk. Dipakai server (ProductService) dan tes.
import { Product, ProductSupplierInfo } from '@/types';

export interface ProductSupplierRow {
  product_id: number;
  last_supplier_id: number | null;
  last_supplier_name: string | null;
  last_in_at: string | null;
  last_supplier_active: boolean | null;
  supplier_count: number | string | null;
  supplier_names: string | null;
}

export const NO_SUPPLIER: ProductSupplierInfo = {
  last_supplier_id: null,
  last_supplier_name: null,
  last_in_at: null,
  last_supplier_active: null,
  supplier_count: 0,
  supplier_names: []
};

// "Indofood, Wings , Mayora" -> ['Indofood', 'Wings', 'Mayora'] (urutan view: terbaru dulu).
export function splitSupplierNames(value: string | null | undefined): string[] {
  if (!value) return [];
  return value.split(',').map((s) => s.trim()).filter(Boolean);
}

export function toSupplierInfo(row: ProductSupplierRow | undefined): ProductSupplierInfo {
  if (!row || row.last_supplier_id === null || row.last_supplier_id === undefined) return { ...NO_SUPPLIER };
  const count = Number(row.supplier_count);
  return {
    last_supplier_id: row.last_supplier_id,
    last_supplier_name: row.last_supplier_name ?? null,
    last_in_at: row.last_in_at ?? null,
    last_supplier_active: row.last_supplier_active !== false,
    supplier_count: Number.isFinite(count) && count > 0 ? count : 1,
    supplier_names: splitSupplierNames(row.supplier_names)
  };
}

// Satu peta per product_id, lalu tempelkan ke setiap produk (tanpa query per baris).
export function mergeProductSuppliers<T extends Product>(products: T[], rows: ProductSupplierRow[]): (T & ProductSupplierInfo)[] {
  const byId = new Map<number, ProductSupplierRow>();
  for (const r of rows) byId.set(Number(r.product_id), r);
  return products.map((p) => ({ ...p, ...toSupplierInfo(byId.get(p.id)) }));
}

// Pencarian tanpa membedakan huruf besar/kecil: nama produk ATAU nama supplier terakhir.
export function matchesProductSearch(p: Pick<Product, 'name'> & Partial<ProductSupplierInfo>, query: string | null | undefined): boolean {
  const q = (query ?? '').trim().toLocaleLowerCase('id');
  if (!q) return true;
  return p.name.toLocaleLowerCase('id').includes(q)
    || (p.last_supplier_name ?? '').toLocaleLowerCase('id').includes(q);
}

// Teks lencana "+N lainnya" (N = supplier lain selain yang terakhir); null bila hanya satu.
export function otherSuppliersLabel(count: number): string | null {
  return count > 1 ? `+${count - 1} lainnya` : null;
}
