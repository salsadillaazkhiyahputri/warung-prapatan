import { describe, it, expect } from 'vitest';
import {
  parseInteger,
  cleanText,
  validateCalendarDate,
  dateRange,
  neutralizeExcelFormula,
  validateSupplierJenis,
  validateCategory,
  getTransactionLabel,
  mapRpcError,
  BusinessError
} from '../src/lib/validate';
import { createSessionToken, decodeSessionToken } from '../src/lib/auth';

describe('1. Validasi Angka Bulat Ketat (parseInteger)', () => {
  it('berhasil mengurai bilangan bulat positif yang sah', () => {
    expect(parseInteger(10, 'Stok')).toBe(10);
    expect(parseInteger('25', 'Stok')).toBe(25);
    expect(parseInteger('0', 'Stok', 0)).toBe(0);
  });

  it('menolak bilangan pecahan atau desimal', () => {
    expect(() => parseInteger(12.5, 'Jumlah')).toThrow(BusinessError);
    expect(() => parseInteger('12.5', 'Jumlah')).toThrow(BusinessError);
  });

  it('menolak string yang mengandung huruf (seperti "5abc")', () => {
    expect(() => parseInteger('5abc', 'Jumlah')).toThrow(BusinessError);
    expect(() => parseInteger('abc5', 'Jumlah')).toThrow(BusinessError);
    expect(() => parseInteger('10 20', 'Jumlah')).toThrow(BusinessError);
  });

  it('menolak nilai di bawah batas minimum', () => {
    expect(() => parseInteger(0, 'Jumlah', 1, 100000)).toThrow(BusinessError);
    expect(() => parseInteger(-5, 'Jumlah', 0)).toThrow(BusinessError);
  });

  it('menolak nilai di atas batas maksimum', () => {
    expect(() => parseInteger(100001, 'Jumlah', 1, 100000)).toThrow(BusinessError);
  });

  it('menolak null, undefined, atau string kosong', () => {
    expect(() => parseInteger(null, 'Jumlah')).toThrow(BusinessError);
    expect(() => parseInteger(undefined, 'Jumlah')).toThrow(BusinessError);
    expect(() => parseInteger('', 'Jumlah')).toThrow(BusinessError);
  });
});

describe('2. Pembersihan Teks dan Batas Panjang (cleanText)', () => {
  it('memotong whitespace di awal dan akhir', () => {
    expect(cleanText('  Indomie Goreng  ', 'Nama')).toBe('Indomie Goreng');
  });

  it('menolak teks kosong jika wajib diisi', () => {
    expect(() => cleanText('', 'Nama', 100, 1)).toThrow(BusinessError);
    expect(() => cleanText('   ', 'Nama', 100, 1)).toThrow(BusinessError);
  });

  it('menolak teks yang melebihi batas panjang maksimum', () => {
    const longText = 'a'.repeat(101);
    expect(() => cleanText(longText, 'Nama', 100, 1)).toThrow(BusinessError);
  });

  it('mengizinkan teks kosong jika minLen adalah 0', () => {
    expect(cleanText('', 'Catatan', 200, 0)).toBe('');
    expect(cleanText('   ', 'Catatan', 200, 0)).toBe('');
  });
});

describe('3. Validasi Tanggal Kalender Nyata (validateCalendarDate & dateRange)', () => {
  it('menerima tanggal kalender yang valid (format YYYY-MM-DD)', () => {
    expect(validateCalendarDate('2026-11-15')).toBe('2026-11-15');
    expect(validateCalendarDate('2024-02-29')).toBe('2024-02-29'); // Tahun kabisat
  });

  it('menolak tanggal kalender fiktif/tidak sah seperti 2026-02-31', () => {
    expect(() => validateCalendarDate('2026-02-31')).toThrow(BusinessError);
    expect(() => validateCalendarDate('2026-04-31')).toThrow(BusinessError);
    expect(() => validateCalendarDate('2026-13-01')).toThrow(BusinessError);
  });

  it('menolak format tanggal yang salah', () => {
    expect(() => validateCalendarDate('15-11-2026')).toThrow(BusinessError);
    expect(() => validateCalendarDate('invalid-date')).toThrow(BusinessError);
  });

  it('menerima rentang tanggal yang benar dan menghasilkan format WIB', () => {
    const range = dateRange('2026-11-01', '2026-11-15');
    expect(range.startDateIso).toBe('2026-11-01T00:00:00+07:00');
    expect(range.endDateIso).toBe('2026-11-15T23:59:59.999+07:00');
  });

  it('menolak rentang tanggal terbalik (tanggal awal > tanggal akhir) dengan status 400', () => {
    try {
      dateRange('2026-11-20', '2026-11-10');
      expect.unreachable('Harus melempar BusinessError');
    } catch (err: any) {
      expect(err).toBeInstanceOf(BusinessError);
      expect(err.status).toBe(400);
      expect(err.message).toContain('tidak boleh melewati tanggal akhir');
    }
  });
});

describe('4. Penetral Formula Excel (neutralizeExcelFormula)', () => {
  it('menambahkan tanda petik tunggal jika teks diawali =, +, -, @', () => {
    expect(neutralizeExcelFormula('=SUM(A1:A10)')).toBe("'=SUM(A1:A10)");
    expect(neutralizeExcelFormula('+62812345678')).toBe("'+62812345678");
    expect(neutralizeExcelFormula('-5000')).toBe("'-5000");
    expect(neutralizeExcelFormula('@admin')).toBe("'@admin");
  });

  it('tidak mengubah teks normal yang aman', () => {
    expect(neutralizeExcelFormula('Indomie Goreng')).toBe('Indomie Goreng');
    expect(neutralizeExcelFormula('Grosir Jaya 123')).toBe('Grosir Jaya 123');
  });
});

describe('5. Validasi Jenis Supplier (validateSupplierJenis)', () => {
  it('menerima jenis supplier utama, cadangan, atau grosir', () => {
    expect(validateSupplierJenis('utama')).toBe('utama');
    expect(validateSupplierJenis('cadangan')).toBe('cadangan');
    expect(validateSupplierJenis('grosir')).toBe('grosir');
    expect(validateSupplierJenis('UTAMA')).toBe('utama'); // Case-insensitive
  });

  it('menolak jenis supplier di luar kontrak yang sah', () => {
    expect(() => validateSupplierJenis('distributor')).toThrow(BusinessError);
    expect(() => validateSupplierJenis('')).toThrow(BusinessError);
    expect(() => validateSupplierJenis('lainnya')).toThrow(BusinessError);
  });
});

describe('6. Validasi Kategori Produk (validateCategory)', () => {
  const existingCategories = ['Makanan', 'Perlengkapan', 'Mie', 'Sabun', 'Bumbu', 'Minuman', 'Sembako'];

  it('menerima kategori yang sudah ada di database', () => {
    expect(validateCategory('Makanan', existingCategories)).toBe('Makanan');
    expect(validateCategory('makanan', existingCategories)).toBe('Makanan');
    expect(validateCategory('Perlengkapan', existingCategories)).toBe('Perlengkapan');
  });

  it('menerima kategori baru yang lolos cleanText', () => {
    expect(validateCategory('Alat Tulis', existingCategories)).toBe('Alat Tulis');
  });

  it('menolak kategori kosong', () => {
    expect(() => validateCategory('', existingCategories)).toThrow(BusinessError);
  });
});

describe('7. Fungsi Pemberi Label Transaksi (getTransactionLabel)', () => {
  it('menghasilkan label "Masuk" untuk in + manual', () => {
    expect(getTransactionLabel('in', 'manual')).toBe('Masuk');
  });

  it('menghasilkan label "Keluar (manual)" untuk out + manual', () => {
    expect(getTransactionLabel('out', 'manual')).toBe('Keluar (manual)');
  });

  it('menghasilkan label "Keluar (opname)" untuk out + opname', () => {
    expect(getTransactionLabel('out', 'opname')).toBe('Keluar (opname)');
  });

  it('menghasilkan label "Koreksi (opname)" untuk in + opname', () => {
    expect(getTransactionLabel('in', 'opname')).toBe('Koreksi (opname)');
  });
});

describe('8. Pemetaan Kode Error RPC (mapRpcError)', () => {
  it('memetakan INSUFFICIENT_STOCK dengan menyebutkan sisa stok', () => {
    const res = mapRpcError('INSUFFICIENT_STOCK', { stock: 5, unit: 'pcs' });
    expect(res.status).toBe(400);
    expect(res.message).toBe('Stok tidak mencukupi. Sisa stok saat ini: 5 pcs');
  });

  it('memetakan SUPPLIER_REQUIRED dengan pesan jelas', () => {
    const res = mapRpcError('SUPPLIER_REQUIRED');
    expect(res.status).toBe(400);
    expect(res.message).toBe('Supplier wajib dipilih untuk transaksi stok masuk');
  });

  it('memetakan SUPPLIER_UNKNOWN', () => {
    const res = mapRpcError('SUPPLIER_UNKNOWN');
    expect(res.status).toBe(400);
    expect(res.message).toBe('Supplier tidak ditemukan atau tidak valid');
  });

  it('memetakan PRODUCT_NOT_FOUND dengan status 404', () => {
    const res = mapRpcError('PRODUCT_NOT_FOUND');
    expect(res.status).toBe(404);
    expect(res.message).toBe('Produk tidak ditemukan');
  });

  it('memetakan INVALID_IDEM_KEY', () => {
    const res = mapRpcError('INVALID_IDEM_KEY');
    expect(res.status).toBe(400);
    expect(res.message).toContain('Kunci idempotensi');
  });
});

describe('9. Pengujian Sesi Token & Kompatibilitas Mundur (decodeSessionToken)', () => {
  it('berhasil mendekode token HMAC-SHA256 modern 3-bagian', () => {
    const mockUser = {
      id: 'e1a9c1e0-827b-4573-b391-7f8f9e68c5b1',
      username: 'pemilik',
      password_hash: 'hash',
      created_at: new Date().toISOString()
    };
    const token = createSessionToken(mockUser);
    expect(token.split('.').length).toBe(3);

    const session = decodeSessionToken(token);
    expect(session).not.toBeNull();
    expect(session?.userId).toBe(mockUser.id);
    expect(session?.username).toBe('pemilik');
  });

  it('berhasil mendekode token sesi legacy (base64 JSON) untuk kompatibilitas browser', () => {
    const legacyPayload = {
      userId: 'e1a9c1e0-827b-4573-b391-7f8f9e68c5b1',
      username: 'pemilik',
      role: 'pemilik',
      expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000
    };
    const legacyToken = Buffer.from(JSON.stringify(legacyPayload)).toString('base64');
    expect(legacyToken.includes('.')).toBe(false);

    const session = decodeSessionToken(legacyToken);
    expect(session).not.toBeNull();
    expect(session?.userId).toBe(legacyPayload.userId);
    expect(session?.username).toBe('pemilik');
  });

  it('menolak token sesi legacy yang telah kedaluwarsa', () => {
    const expiredPayload = {
      userId: 'e1a9c1e0-827b-4573-b391-7f8f9e68c5b1',
      username: 'pemilik',
      role: 'pemilik',
      expiresAt: Date.now() - 10000 // sudah lewat
    };
    const expiredToken = Buffer.from(JSON.stringify(expiredPayload)).toString('base64');
    expect(decodeSessionToken(expiredToken)).toBeNull();
  });

  it('menolak token palsu atau bertanda tangan tidak cocok', () => {
    expect(decodeSessionToken('token.palsu.sembarangan')).toBeNull();
    expect(decodeSessionToken('')).toBeNull();
    expect(decodeSessionToken('not-a-token')).toBeNull();
  });
});


