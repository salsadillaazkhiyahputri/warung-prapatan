// Validasi input bersama untuk semua route API (lapisan kedua setelah UI, sebelum database).
// Setiap helper melempar BusinessError (400) dengan pesan berbahasa Indonesia yang aman ditampilkan.
import { BusinessError } from './errors';
import { SupplierJenis, SUPPLIER_JENIS, TransactionKind } from '@/types';
import { normalizeCategory } from './categories';
import { isTransactionKind } from './stock-labels';

const MAX_BODY_BYTES = 32 * 1024;

export async function readJson(req: Request): Promise<Record<string, unknown>> {
  let text: string;
  try {
    text = await req.text();
  } catch {
    throw new BusinessError('Data permintaan tidak bisa dibaca');
  }
  if (text.length > MAX_BODY_BYTES) throw new BusinessError('Data permintaan terlalu besar', 413);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new BusinessError('Format data tidak valid');
  }
  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new BusinessError('Format data tidak valid');
  }
  return parsed as Record<string, unknown>;
}

interface TextOptions {
  field: string;
  required?: boolean;
  min?: number;
  max?: number;
}

// Rapikan teks: buang karakter kontrol, satukan spasi, batasi panjang.
// Hasil null bila kosong dan tidak wajib.
export function cleanText(value: unknown, opts: TextOptions): string | null {
  const { field, required = false, min = 1, max = 200 } = opts;
  if (value === undefined || value === null) {
    if (required) throw new BusinessError(`${field} wajib diisi`);
    return null;
  }
  if (typeof value !== 'string' && typeof value !== 'number') {
    throw new BusinessError(`${field} tidak valid`);
  }
  // eslint-disable-next-line no-control-regex
  const cleaned = String(value).replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
  if (!cleaned) {
    if (required) throw new BusinessError(`${field} wajib diisi`);
    return null;
  }
  if (cleaned.length < min) throw new BusinessError(`${field} minimal ${min} karakter`);
  if (cleaned.length > max) throw new BusinessError(`${field} maksimal ${max} karakter`);
  return cleaned;
}

interface IntOptions {
  field: string;
  required?: boolean;
  min?: number;
  max?: number;
}

// Bilangan bulat dari number atau string angka murni ("12"). "12abc", 1.5, true ditolak.
export function parseInteger(value: unknown, opts: IntOptions & { required: true }): number;
export function parseInteger(value: unknown, opts: IntOptions): number | null;
export function parseInteger(value: unknown, opts: IntOptions): number | null {
  const { field, required = false, min = Number.MIN_SAFE_INTEGER, max = Number.MAX_SAFE_INTEGER } = opts;
  if (value === undefined || value === null || value === '') {
    if (required) throw new BusinessError(`${field} wajib diisi`);
    return null;
  }
  let n: number;
  if (typeof value === 'number') n = value;
  else if (typeof value === 'string' && /^-?\d+$/.test(value.trim())) n = Number(value.trim());
  else throw new BusinessError(`${field} harus berupa angka bulat`);
  if (!Number.isSafeInteger(n)) throw new BusinessError(`${field} harus berupa angka bulat`);
  if (n < min) throw new BusinessError(`${field} minimal ${min}`);
  if (n > max) throw new BusinessError(`${field} maksimal ${max}`);
  return n;
}

// ID opsional: kosong / null / "all" -> null, selain itu wajib bilangan bulat positif.
export function optionalId(value: unknown, field: string): number | null {
  if (value === undefined || value === null || value === '' || value === 'all') return null;
  return parseInteger(value, { field, min: 1, max: 2147483647 });
}

export function requiredId(value: unknown, field: string): number {
  const id = optionalId(value, field);
  if (id === null) throw new BusinessError(`${field} wajib diisi`);
  return id;
}

export function parseJenis(value: unknown): SupplierJenis {
  if (typeof value === 'string' && (SUPPLIER_JENIS as readonly string[]).includes(value)) {
    return value as SupplierJenis;
  }
  throw new BusinessError('Jenis supplier harus salah satu dari: utama, cadangan, grosir');
}

// Kategori boleh diketik bebas (wajib, maks 40 karakter). Dirapikan: trim, spasi ganda jadi satu,
// disamakan dengan ejaan kategori yang sudah ada tanpa beda huruf besar/kecil (`existing` = daftar saran,
// lihat ProductService.getCategorySuggestions); kategori baru dikapitalisasi per kata.
export function parseCategory(value: unknown, existing: readonly string[]): string {
  const r = normalizeCategory(value, existing);
  if (!r.ok) throw new BusinessError(r.error);
  return r.value;
}

export function parseBoolean(value: unknown): boolean {
  return value === true;
}

const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function parseDate(value: unknown, field: string): string | null {
  if (value === undefined || value === null || value === '') return null;
  if (typeof value !== 'string') throw new BusinessError(`${field} tidak valid`);
  const m = DATE_RE.exec(value);
  if (!m) throw new BusinessError(`${field} harus berformat YYYY-MM-DD`);
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])];
  const dt = new Date(Date.UTC(y, mo - 1, d));
  if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== d || y < 2000 || y > 2100) {
    throw new BusinessError(`${field} bukan tanggal yang valid`);
  }
  return value;
}

// Filter riwayat transaksi (dipakai GET /api/transactions dan ekspor).
// `kind` = masuk | keluar_opname | keluar_manual | koreksi; `type` (in/out) tetap diterima untuk kompatibilitas.
export function parseHistoryFilters(params: URLSearchParams) {
  const range = dateRange(params.get('startDate'), params.get('endDate'));
  const productId = optionalId(params.get('productId'), 'Produk');
  const rawType = params.get('type');
  const rawKind = params.get('kind');
  let type: 'in' | 'out' | 'all' = 'all';
  if (rawType && rawType !== 'all') {
    if (rawType !== 'in' && rawType !== 'out') throw new BusinessError('Tipe transaksi tidak valid');
    type = rawType;
  }
  let kind: TransactionKind | 'all' = 'all';
  if (rawKind && rawKind !== 'all') {
    if (!isTransactionKind(rawKind)) throw new BusinessError('Jenis transaksi tidak valid');
    kind = rawKind;
  }
  return { ...range, productId, type, kind };
}

export interface DateRange {
  startDate?: string; // YYYY-MM-DD (kalender WIB)
  endDate?: string;
}

// Rentang tanggal kalender WIB. Keduanya opsional; bila keduanya ada, awal <= akhir dan maksimal 366 hari.
export function dateRange(start: unknown, end: unknown): DateRange {
  const s = parseDate(start, 'Tanggal awal');
  const e = parseDate(end, 'Tanggal akhir');
  if (s && e) {
    if (s > e) throw new BusinessError('Tanggal awal tidak boleh setelah tanggal akhir');
    const days = (Date.parse(`${e}T00:00:00Z`) - Date.parse(`${s}T00:00:00Z`)) / 86400000;
    if (days > 366) throw new BusinessError('Rentang tanggal maksimal 1 tahun');
  }
  return { ...(s ? { startDate: s } : {}), ...(e ? { endDate: e } : {}) };
}
