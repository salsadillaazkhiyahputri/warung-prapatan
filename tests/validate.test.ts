import { describe, it, expect } from 'vitest';
import {
  readJson, cleanText, parseInteger, optionalId, requiredId, parseJenis, parseCategory,
  parseBoolean, dateRange, parseHistoryFilters
} from '@/lib/validate';
import { BusinessError } from '@/lib/errors';

const req = (body: string) => new Request('http://x/api', { method: 'POST', body });

describe('readJson', () => {
  it('membaca objek JSON', async () => {
    expect(await readJson(req('{"a":1}'))).toEqual({ a: 1 });
  });
  it('menolak JSON rusak, array, dan null', async () => {
    await expect(readJson(req('{oops'))).rejects.toBeInstanceOf(BusinessError);
    await expect(readJson(req('[1,2]'))).rejects.toThrow('Format data tidak valid');
    await expect(readJson(req('null'))).rejects.toThrow('Format data tidak valid');
  });
  it('menolak body terlalu besar', async () => {
    await expect(readJson(req(JSON.stringify({ a: 'x'.repeat(40000) })))).rejects.toMatchObject({ status: 413 });
  });
});

describe('cleanText', () => {
  it('merapikan spasi dan karakter kontrol', () => {
    expect(cleanText('  Indomie\n\tGoreng  ', { field: 'Nama' })).toBe('Indomie Goreng');
  });
  it('kosong -> null bila tidak wajib, error bila wajib', () => {
    expect(cleanText('   ', { field: 'Catatan' })).toBeNull();
    expect(cleanText(undefined, { field: 'Catatan' })).toBeNull();
    expect(() => cleanText('', { field: 'Nama', required: true })).toThrow('Nama wajib diisi');
  });
  it('memeriksa panjang minimal dan maksimal', () => {
    expect(() => cleanText('ab', { field: 'Alasan', min: 3 })).toThrow('Alasan minimal 3 karakter');
    expect(cleanText('abc', { field: 'Alasan', min: 3 })).toBe('abc');
    expect(() => cleanText('x'.repeat(201), { field: 'Catatan', max: 200 })).toThrow('maksimal 200');
  });
  it('menolak objek', () => {
    expect(() => cleanText({}, { field: 'Nama' })).toThrow('Nama tidak valid');
  });
});

describe('parseInteger', () => {
  it('menerima number dan string angka', () => {
    expect(parseInteger(5, { field: 'Jumlah' })).toBe(5);
    expect(parseInteger(' 12 ', { field: 'Jumlah' })).toBe(12);
  });
  it('menolak pecahan, teks campuran, boolean', () => {
    expect(() => parseInteger(1.5, { field: 'Jumlah' })).toThrow('angka bulat');
    expect(() => parseInteger('12abc', { field: 'Jumlah' })).toThrow('angka bulat');
    expect(() => parseInteger(true, { field: 'Jumlah' })).toThrow('angka bulat');
  });
  it('memeriksa batas', () => {
    expect(() => parseInteger(0, { field: 'Jumlah', min: 1 })).toThrow('Jumlah minimal 1');
    expect(() => parseInteger(11, { field: 'Jumlah', max: 10 })).toThrow('Jumlah maksimal 10');
  });
  it('kosong -> null atau error bila wajib', () => {
    expect(parseInteger('', { field: 'Jumlah' })).toBeNull();
    expect(() => parseInteger(null, { field: 'Jumlah', required: true })).toThrow('Jumlah wajib diisi');
  });
});

describe('optionalId / requiredId', () => {
  it('kosong dan "all" -> null', () => {
    expect(optionalId('', 'Produk')).toBeNull();
    expect(optionalId('all', 'Produk')).toBeNull();
    expect(optionalId(null, 'Produk')).toBeNull();
  });
  it('id positif', () => {
    expect(optionalId('7', 'Produk')).toBe(7);
    expect(() => optionalId('0', 'Produk')).toThrow('Produk minimal 1');
    expect(() => optionalId('-3', 'Produk')).toThrow();
    expect(() => optionalId('1 OR 1=1', 'Produk')).toThrow('angka bulat');
  });
  it('requiredId wajib ada', () => {
    expect(() => requiredId('', 'Supplier')).toThrow('Supplier wajib diisi');
    expect(requiredId(3, 'Supplier')).toBe(3);
  });
});

describe('parseJenis', () => {
  it('hanya tiga nilai', () => {
    expect(parseJenis('utama')).toBe('utama');
    expect(parseJenis('cadangan')).toBe('cadangan');
    expect(parseJenis('grosir')).toBe('grosir');
    for (const bad of ['Utama', '', null, undefined, 'koreksi', 1]) {
      expect(() => parseJenis(bad)).toThrow(BusinessError);
    }
  });
});

describe('parseCategory (API, kategori boleh diketik)', () => {
  const existing = ['Makanan', 'Mie', 'Perlengkapan', 'Lainnya'];
  it('kosong ditolak (400)', () => {
    expect(() => parseCategory(undefined, existing)).toThrow('Kategori wajib diisi');
    expect(() => parseCategory('', existing)).toThrow('Kategori wajib diisi');
    expect(() => parseCategory('   ', existing)).toThrow('Kategori wajib diisi');
    expect(() => parseCategory('', existing)).toThrow(BusinessError);
  });
  it('menyamakan ejaan kategori yang sudah ada, termasuk "Lainnya"', () => {
    expect(parseCategory('makanan', existing)).toBe('Makanan');
    expect(parseCategory(' Perlengkapan ', existing)).toBe('Perlengkapan');
    expect(parseCategory('lainnya', existing)).toBe('Lainnya');
  });
  it('kategori baru diterima dan dikapitalisasi', () => {
    expect(parseCategory('rokok', existing)).toBe('Rokok');
  });
  it('bukan teks / terlalu panjang ditolak', () => {
    expect(() => parseCategory({}, existing)).toThrow('Kategori tidak valid');
    expect(() => parseCategory('x'.repeat(41), existing)).toThrow('maksimal 40');
  });
});

describe('parseBoolean', () => {
  it('hanya true yang true', () => {
    expect(parseBoolean(true)).toBe(true);
    expect(parseBoolean('true')).toBe(false);
    expect(parseBoolean(1)).toBe(false);
  });
});

describe('dateRange', () => {
  it('kosong -> objek kosong', () => {
    expect(dateRange(null, '')).toEqual({});
  });
  it('rentang valid', () => {
    expect(dateRange('2026-01-01', '2026-01-31')).toEqual({ startDate: '2026-01-01', endDate: '2026-01-31' });
    expect(dateRange('2026-02-28', null)).toEqual({ startDate: '2026-02-28' });
  });
  it('menolak format dan tanggal tidak ada', () => {
    expect(() => dateRange('01/02/2026', null)).toThrow('YYYY-MM-DD');
    expect(() => dateRange('2026-02-30', null)).toThrow('bukan tanggal yang valid');
    expect(() => dateRange("2026-01-01'; drop", null)).toThrow();
  });
  it('awal setelah akhir dan rentang terlalu panjang', () => {
    expect(() => dateRange('2026-02-01', '2026-01-01')).toThrow('tidak boleh setelah');
    expect(() => dateRange('2024-01-01', '2026-01-01')).toThrow('maksimal 1 tahun');
  });
});

describe('parseHistoryFilters', () => {
  it('membaca kind, type, produk, tanggal', () => {
    const f = parseHistoryFilters(new URLSearchParams('kind=keluar_opname&productId=4&startDate=2026-01-01'));
    expect(f).toEqual({ startDate: '2026-01-01', productId: 4, type: 'all', kind: 'keluar_opname' });
    expect(parseHistoryFilters(new URLSearchParams('type=in')).type).toBe('in');
  });
  it('menolak nilai asing', () => {
    expect(() => parseHistoryFilters(new URLSearchParams('kind=hapus'))).toThrow('Jenis transaksi tidak valid');
    expect(() => parseHistoryFilters(new URLSearchParams('type=x'))).toThrow('Tipe transaksi tidak valid');
  });
});
