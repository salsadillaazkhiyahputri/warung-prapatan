import { SupplierJenis, TransactionType, TransactionSource } from '@/types';

export class BusinessError extends Error {
  status: number;
  code?: string;
  extra?: Record<string, unknown>;

  constructor(message: string, status = 400, code?: string, extra?: Record<string, unknown>) {
    super(message);
    this.name = 'BusinessError';
    this.status = status;
    this.code = code;
    this.extra = extra;
  }
}

/**
 * Membaca body request JSON secara aman dengan validasi error.
 */
export async function readJson<T = Record<string, any>>(req: Request): Promise<T> {
  try {
    const text = await req.text();
    if (!text || !text.trim()) {
      throw new BusinessError('Data masukan tidak boleh kosong', 400, 'EMPTY_BODY');
    }
    return JSON.parse(text) as T;
  } catch (err: any) {
    if (err instanceof BusinessError) throw err;
    throw new BusinessError('Format JSON tidak valid', 400, 'INVALID_JSON');
  }
}

/**
 * Membersihkan teks masukan dan memvalidasi panjangnya.
 */
export function cleanText(
  val: unknown,
  fieldName: string,
  maxLen = 100,
  minLen = 1
): string {
  if (typeof val !== 'string') {
    if (minLen > 0) {
      throw new BusinessError(`${fieldName} wajib berupa teks`, 400, 'INVALID_TYPE');
    }
    return '';
  }

  const trimmed = val.trim();

  if (trimmed.length < minLen) {
    throw new BusinessError(`${fieldName} wajib diisi minimal ${minLen} karakter`, 400, 'REQUIRED');
  }

  if (trimmed.length > maxLen) {
    throw new BusinessError(`${fieldName} maksimal ${maxLen} karakter`, 400, 'MAX_LENGTH');
  }

  return trimmed;
}

/**
 * Memvalidasi dan mengurai angka bulat dengan batas min/max ketat.
 * Menolak desimal, string campur huruf seperti "5abc", atau NaN.
 */
export function parseInteger(
  val: unknown,
  fieldName: string,
  min?: number,
  max?: number
): number {
  if (val === null || val === undefined || val === '') {
    throw new BusinessError(`${fieldName} wajib diisi angka`, 400, 'REQUIRED');
  }

  let num: number;
  if (typeof val === 'number') {
    if (!Number.isFinite(val) || !Number.isInteger(val)) {
      throw new BusinessError(`${fieldName} harus berupa bilangan bulat`, 400, 'INVALID_INTEGER');
    }
    num = val;
  } else if (typeof val === 'string') {
    const trimmed = val.trim();
    // Strict integer regex: opsional tanda minus lalu digit murni
    if (!/^-?\d+$/.test(trimmed)) {
      throw new BusinessError(`${fieldName} harus berupa bilangan bulat murni`, 400, 'INVALID_INTEGER');
    }
    num = Number(trimmed);
  } else {
    throw new BusinessError(`${fieldName} harus berupa angka`, 400, 'INVALID_TYPE');
  }

  if (min !== undefined && num < min) {
    throw new BusinessError(`${fieldName} minimal ${min.toLocaleString('id-ID')}`, 400, 'MIN_VALUE');
  }

  if (max !== undefined && num > max) {
    throw new BusinessError(`${fieldName} maksimal ${max.toLocaleString('id-ID')}`, 400, 'MAX_VALUE');
  }

  return num;
}

/**
 * Memvalidasi ID relasi opsional (integer positif atau null).
 */
export function optionalId(val: unknown, fieldName: string): number | null {
  if (val === null || val === undefined || val === '' || val === 'all') {
    return null;
  }
  return parseInteger(val, fieldName, 1);
}

/**
 * Validasi ketat tanggal kalender (YYYY-MM-DD).
 * Memeriksa keabsahan tanggal kalender nyata (misal menolak 2026-02-31).
 */
export function validateCalendarDate(dateStr: string, fieldName = 'Tanggal'): string {
  const trimmed = dateStr.trim();
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(trimmed);
  if (!match) {
    throw new BusinessError(`Format ${fieldName} tidak valid (gunakan format YYYY-MM-DD)`, 400, 'INVALID_DATE');
  }

  const year = parseInt(match[1], 10);
  const month = parseInt(match[2], 10);
  const day = parseInt(match[3], 10);

  if (month < 1 || month > 12) {
    throw new BusinessError(`${fieldName}: bulan harus antara 01 sampai 12`, 400, 'INVALID_DATE');
  }

  // Cek jumlah hari dalam bulan tersebut
  const date = new Date(Date.UTC(year, month - 1, day));
  if (
    date.getUTCFullYear() !== year ||
    date.getUTCMonth() !== month - 1 ||
    date.getUTCDate() !== day
  ) {
    throw new BusinessError(`${fieldName}: tanggal kalender tidak sah`, 400, 'INVALID_DATE');
  }

  return trimmed;
}

/**
 * Validasi rentang tanggal kalender WIB.
 * Mengembalikan objek ISO string awal dan akhir hari WIB, atau null jika tidak diisi.
 */
export function dateRange(
  startDateStr?: string | null,
  endDateStr?: string | null
): { startDateIso?: string; endDateIso?: string; startDate?: string; endDate?: string } {
  const result: { startDateIso?: string; endDateIso?: string; startDate?: string; endDate?: string } = {};

  if (startDateStr && startDateStr.trim()) {
    const validStart = validateCalendarDate(startDateStr, 'Dari Tanggal');
    result.startDate = validStart;
    result.startDateIso = `${validStart}T00:00:00+07:00`;
  }

  if (endDateStr && endDateStr.trim()) {
    const validEnd = validateCalendarDate(endDateStr, 'Sampai Tanggal');
    result.endDate = validEnd;
    result.endDateIso = `${validEnd}T23:59:59.999+07:00`;
  }

  if (result.startDate && result.endDate) {
    if (result.startDate > result.endDate) {
      throw new BusinessError(
        'Rentang tanggal tidak valid: tanggal awal tidak boleh melewati tanggal akhir',
        400,
        'INVALID_DATE_RANGE'
      );
    }
  }

  return result;
}

/**
 * Mencegah formula injection pada ekspor Excel/CSV.
 * Menetralkan teks yang diawali '=', '+', '-', '@' dengan menambahkan tanda petik tunggal.
 */
export function neutralizeExcelFormula(val: unknown): string {
  if (val === null || val === undefined) return '';
  const str = String(val);
  if (/^[=+\-@]/.test(str)) {
    return `'${str}`;
  }
  return str;
}

/**
 * Validasi jenis supplier ('utama' | 'cadangan' | 'grosir').
 */
export function validateSupplierJenis(val: unknown): SupplierJenis {
  const clean = cleanText(val, 'Jenis supplier', 20, 1).toLowerCase();
  if (clean === 'utama' || clean === 'cadangan' || clean === 'grosir') {
    return clean as SupplierJenis;
  }
  throw new BusinessError(
    'Jenis supplier harus salah satu dari: utama, cadangan, atau grosir',
    400,
    'INVALID_SUPPLIER_JENIS'
  );
}

/**
 * Validasi kategori produk: boleh kategori yang sudah ada atau teks baru lolos cleanText (maks 50).
 */
export function validateCategory(val: unknown, existingCategories: string[] = []): string {
  const cleaned = cleanText(val, 'Kategori', 50, 1);
  const normalizedClean = cleaned.toLowerCase();
  const matched = existingCategories.find(c => c.toLowerCase() === normalizedClean);
  return matched || cleaned;
}

/**
 * Memberikan label jenis transaksi sesuai kontrak database bagian 4.
 */
export function getTransactionLabel(type: string, source?: string): string {
  const normType = (type || '').toLowerCase();
  const normSource = (source || 'manual').toLowerCase();

  if (normType === 'in' && normSource === 'manual') {
    return 'Masuk';
  }
  if (normType === 'out' && normSource === 'manual') {
    return 'Keluar (manual)';
  }
  if (normType === 'out' && normSource === 'opname') {
    return 'Keluar (opname)';
  }
  if (normType === 'in' && normSource === 'opname') {
    return 'Koreksi (opname)';
  }

  return normType === 'in' ? 'Masuk' : 'Keluar';
}

/**
 * Memetakan kode error dari RPC Supabase ke pesan bahasa Indonesia yang aman dan ramah awam.
 */
export function mapRpcError(
  code: string,
  extra?: { product?: string; unit?: string; stock?: number }
): { message: string; status: number } {
  switch (code) {
    case 'INSUFFICIENT_STOCK':
      return {
        message: `Stok tidak mencukupi. Sisa stok saat ini: ${extra?.stock ?? 0} ${extra?.unit || 'pcs'}`,
        status: 400
      };
    case 'SUPPLIER_REQUIRED':
      return {
        message: 'Supplier wajib dipilih untuk transaksi stok masuk',
        status: 400
      };
    case 'SUPPLIER_UNKNOWN':
      return {
        message: 'Supplier tidak ditemukan atau tidak valid',
        status: 400
      };
    case 'PRODUCT_NOT_FOUND':
      return {
        message: 'Produk tidak ditemukan',
        status: 404
      };
    case 'INVALID_TYPE':
      return {
        message: 'Tipe transaksi harus "in" atau "out"',
        status: 400
      };
    case 'INVALID_QTY':
      return {
        message: 'Jumlah barang harus antara 1 sampai 100.000',
        status: 400
      };
    case 'INVALID_IDEM_KEY':
      return {
        message: 'Kunci idempotensi transaksi tidak valid (harus web:<uuid>)',
        status: 400
      };
    case 'USER_NOT_FOUND':
      return {
        message: 'Sesi pengguna tidak ditemukan',
        status: 401
      };
    default:
      return {
        message: `Gagal mencatat transaksi: ${code || 'Kesalahan tidak diketahui'}`,
        status: 400
      };
  }
}

/**
 * Menghindari interpretasi karakter wildcard '%' dan '_' pada pencarian ILIKE PostgreSQL.
 */
export function escapeSearchQuery(q: string): string {
  return q.replace(/[%_\\]/g, '\\$&');
}

