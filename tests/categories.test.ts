// Kategori produk: perapian ketikan pengguna dan pembentukan daftar saran.
import { describe, it, expect } from 'vitest';
import {
  BASE_CATEGORIES, normalizeCategory, buildCategorySuggestions, uniqueCategories, capitalizeWords, tidyCategory
} from '@/lib/categories';

const ok = (value: unknown, existing: readonly string[]) => {
  const r = normalizeCategory(value, existing);
  if (!r.ok) throw new Error(`diharapkan sah: ${r.error}`);
  return r.value;
};
const err = (value: unknown, existing: readonly string[] = []) => {
  const r = normalizeCategory(value, existing);
  if (r.ok) throw new Error(`diharapkan ditolak, dapat "${r.value}"`);
  return r.error;
};

describe('normalizeCategory', () => {
  const existing = buildCategorySuggestions(['Mie', 'Snack Ringan']);

  it('huruf besar/kecil: memakai ejaan yang sudah ada', () => {
    expect(ok('makanan', existing)).toBe('Makanan');
    expect(ok('MAKANAN', existing)).toBe('Makanan');
    expect(ok('snack ringan', existing)).toBe('Snack Ringan');
    expect(ok('lainnya', existing)).toBe('Lainnya');
  });

  it('spasi: trim, spasi ganda/tab/baris baru jadi satu spasi', () => {
    expect(ok('  Makanan  ', existing)).toBe('Makanan');
    expect(ok('snack   \t ringan', existing)).toBe('Snack Ringan');
    expect(ok('kue\n kering', existing)).toBe('Kue Kering');
    expect(tidyCategory('  a   b  ')).toBe('a b');
  });

  it('kosong ditolak', () => {
    expect(err('')).toBe('Kategori wajib diisi');
    expect(err('    ')).toBe('Kategori wajib diisi');
    expect(err(undefined)).toBe('Kategori wajib diisi');
    expect(err(null)).toBe('Kategori wajib diisi');
    expect(err(12)).toBe('Kategori tidak valid');
  });

  it('terlalu panjang ditolak (maks 40 setelah dirapikan)', () => {
    expect(ok('a'.repeat(40), [])).toBe('A' + 'a'.repeat(39));
    expect(err('a'.repeat(41))).toBe('Kategori maksimal 40 karakter');
    // Spasi berlebih tidak dihitung karena dirapikan dulu.
    expect(ok(`  ${'b'.repeat(40)}   `, [])).toHaveLength(40);
  });

  it('kategori baru: huruf pertama tiap kata kapital, sisanya dibiarkan', () => {
    expect(ok('kue kering', existing)).toBe('Kue Kering');
    expect(ok('alat tulis ATK', existing)).toBe('Alat Tulis ATK');
    expect(capitalizeWords('es batu')).toBe('Es Batu');
  });
});

describe('buildCategorySuggestions', () => {
  it('tanpa produk: daftar tetap saja, tidak pernah kosong, "Lainnya" terakhir', () => {
    const list = buildCategorySuggestions([]);
    expect(list).toEqual(['Bumbu', 'Makanan', 'Minuman', 'Perlengkapan', 'Rokok', 'Lainnya']);
    expect(list).toHaveLength(BASE_CATEGORIES.length);
  });

  it('dengan produk: kategori terpakai ikut, terurut abjad', () => {
    expect(buildCategorySuggestions(['Mie', 'Sabun', 'Makanan', null, '  '])).toEqual(
      ['Bumbu', 'Makanan', 'Mie', 'Minuman', 'Perlengkapan', 'Rokok', 'Sabun', 'Lainnya']
    );
  });

  it('duplikat beda huruf digabung; ejaan daftar tetap menang', () => {
    const list = buildCategorySuggestions(['makanan', 'MINUMAN', 'Sabun', 'sabun', ' Sabun  ']);
    expect(list.filter((c) => c.toLowerCase() === 'makanan')).toEqual(['Makanan']);
    expect(list.filter((c) => c.toLowerCase() === 'minuman')).toEqual(['Minuman']);
    expect(list.filter((c) => c.toLowerCase() === 'sabun')).toEqual(['Sabun']);
  });

  it('uniqueCategories untuk filter: hanya yang dipakai, tanpa daftar tetap', () => {
    expect(uniqueCategories(['Mie', 'mie', 'Bumbu'])).toEqual(['Bumbu', 'Mie']);
    expect(uniqueCategories([])).toEqual([]);
  });
});
