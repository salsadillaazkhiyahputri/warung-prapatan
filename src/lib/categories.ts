// Kategori produk: helper murni (tanpa akses database) yang dipakai API dan form Produk.
// Kategori boleh diketik bebas; daftar tetap di bawah hanya sebagai saran dasar yang selalu ada.
import { DEFAULT_CATEGORY } from '@/types';

// SATU-SATUNYA daftar kategori tetap. Selalu muncul sebagai saran, juga saat belum ada produk.
export const BASE_CATEGORIES: readonly string[] = ['Makanan', 'Minuman', 'Bumbu', 'Perlengkapan', 'Rokok', DEFAULT_CATEGORY];

export const CATEGORY_MAX_LENGTH = 40;

// Trim, buang karakter kontrol, spasi ganda jadi satu.
export function tidyCategory(value: string): string {
  return value.replace(/[\u0000-\u001F\u007F]/g, ' ').replace(/\s+/g, ' ').trim();
}

const key = (s: string) => s.toLocaleLowerCase('id');

// Huruf pertama tiap kata dikapitalisasi; sisa huruf dibiarkan seperti diketik (singkatan seperti "ATK" tetap).
export function capitalizeWords(value: string): string {
  return value.split(' ').map((w) => (w ? w.charAt(0).toLocaleUpperCase('id') + w.slice(1) : w)).join(' ');
}

// Urut abjad (bahasa Indonesia, tanpa beda huruf besar/kecil), "Lainnya" selalu terakhir.
export function sortCategories(list: string[]): string[] {
  return [...list].sort((a, b) =>
    a === DEFAULT_CATEGORY ? 1 : b === DEFAULT_CATEGORY ? -1 : a.localeCompare(b, 'id', { sensitivity: 'base' }));
}

// Gabungkan beberapa daftar tanpa duplikat (beda huruf besar/kecil dianggap sama; ejaan pertama yang menang).
export function uniqueCategories(...lists: (readonly (string | null | undefined)[])[]): string[] {
  const seen = new Map<string, string>();
  for (const list of lists) {
    for (const raw of list) {
      if (typeof raw !== 'string') continue;
      const c = tidyCategory(raw);
      if (c && !seen.has(key(c))) seen.set(key(c), c);
    }
  }
  return sortCategories([...seen.values()]);
}

// Daftar saran = daftar tetap + kategori yang sudah dipakai produk. Daftar tetap menang bila beda huruf.
export function buildCategorySuggestions(used: readonly (string | null | undefined)[]): string[] {
  return uniqueCategories(BASE_CATEGORIES, used);
}

export type CategoryCheck = { ok: true; value: string } | { ok: false; error: string };

// Rapikan kategori yang diketik pengguna. Bila sudah ada di `existing` (tanpa beda huruf besar/kecil),
// pakai ejaan yang ada; bila benar-benar baru, kapitalisasi huruf pertama tiap kata.
export function normalizeCategory(value: unknown, existing: readonly string[]): CategoryCheck {
  if (value !== undefined && value !== null && typeof value !== 'string') return { ok: false, error: 'Kategori tidak valid' };
  const tidy = tidyCategory(typeof value === 'string' ? value : '');
  if (!tidy) return { ok: false, error: 'Kategori wajib diisi' };
  if (tidy.length > CATEGORY_MAX_LENGTH) return { ok: false, error: `Kategori maksimal ${CATEGORY_MAX_LENGTH} karakter` };
  const match = existing.find((c) => key(tidyCategory(c)) === key(tidy));
  return { ok: true, value: match ? tidyCategory(match) : capitalizeWords(tidy) };
}
