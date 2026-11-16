import { describe, it, expect } from 'vitest';
import {
  classifyTransaction, daysSince, relativeDayLabel, isCountStale, perDay, isTransactionKind, aggregateKeluarPerHari
} from '@/lib/stock-labels';

describe('classifyTransaction', () => {
  it('membedakan empat jenis', () => {
    expect(classifyTransaction({ type: 'in', source: 'manual' })).toBe('masuk');
    expect(classifyTransaction({ type: 'in' })).toBe('masuk');
    expect(classifyTransaction({ type: 'in', supplierIsAdjustment: true })).toBe('koreksi');
    expect(classifyTransaction({ type: 'in', source: 'opname' })).toBe('koreksi');
    expect(classifyTransaction({ type: 'out', source: 'opname' })).toBe('keluar_opname');
    expect(classifyTransaction({ type: 'out', source: 'manual' })).toBe('keluar_manual');
    expect(classifyTransaction({ type: 'out' })).toBe('keluar_manual');
  });
  it('penyesuaian opname pertama = Stok awal (bukan Keluar), apa pun tipenya', () => {
    const note = 'Stok awal (opname pertama)';
    expect(classifyTransaction({ type: 'out', source: 'opname', note })).toBe('stok_awal');
    expect(classifyTransaction({ type: 'in', source: 'opname', note })).toBe('stok_awal');
    // Catatan "stok awal" dari input manual tidak ikut berubah label.
    expect(classifyTransaction({ type: 'out', source: 'manual', note })).toBe('keluar_manual');
    expect(classifyTransaction({ type: 'out', source: 'opname', note: 'Selisih hitung' })).toBe('keluar_opname');
    expect(isTransactionKind('stok_awal')).toBe(true);
  });
  it('isTransactionKind', () => {
    expect(isTransactionKind('koreksi')).toBe(true);
    expect(isTransactionKind('in')).toBe(false);
  });
});

describe('daysSince / relativeDayLabel (kalender WIB)', () => {
  const now = new Date('2026-11-11T10:00:00+07:00');
  it('null / tidak valid', () => {
    expect(daysSince(null, now)).toBeNull();
    expect(daysSince('bukan tanggal', now)).toBeNull();
    expect(relativeDayLabel(undefined, now)).toBe('Belum pernah');
  });
  it('hari ini, kemarin, N hari', () => {
    expect(relativeDayLabel('2026-11-11T00:30:00+07:00', now)).toBe('Hari ini');
    // 23:30 WIB kemarin = 16:30 UTC kemarin
    expect(relativeDayLabel('2026-11-10T16:30:00Z', now)).toBe('Kemarin');
    expect(relativeDayLabel('2026-11-01T09:00:00+07:00', now)).toBe('10 hari lalu');
  });
  it('batas 14 hari', () => {
    expect(isCountStale(null, now)).toBe(true);
    expect(isCountStale('2026-10-28T12:00:00+07:00', now)).toBe(false); // 14 hari
    expect(isCountStale('2026-10-27T12:00:00+07:00', now)).toBe(true); // 15 hari
  });
});

describe('perDay', () => {
  it('pembulatan satu desimal dan pembagi nol', () => {
    expect(perDay(10, 3)).toBe(3.3);
    expect(perDay(10, 0)).toBeNull();
    expect(perDay(10, null)).toBeNull();
  });
});

describe('aggregateKeluarPerHari', () => {
  it('menjumlah per produk, abaikan baseline, urut rata-rata terbesar', () => {
    const rows = aggregateKeluarPerHari([
      { product_id: 1, keluar: 0, hari: null, jenis: 'baseline', created_at: '2026-11-01T10:00:00Z' },
      { product_id: 1, keluar: 12, hari: 3, jenis: 'keluar', created_at: '2026-11-04T10:00:00Z' },
      { product_id: 1, keluar: '8', hari: '2', jenis: 'keluar', created_at: '2026-11-06T10:00:00Z' },
      { product_id: 2, keluar: 30, hari: 5, jenis: 'keluar', created_at: '2026-11-05T10:00:00Z' },
      { product_id: 3, keluar: 0, hari: null, jenis: 'baseline', created_at: '2026-11-05T10:00:00Z' }
    ]);
    expect(rows.map((r) => r.product_id)).toEqual([2, 1]); // produk 3 hanya baseline -> tidak ada rata-rata
    expect(rows[1]).toMatchObject({ total_keluar: 20, total_hari: 5, rata_per_hari: 4, terakhir_dihitung: '2026-11-06T10:00:00Z' });
    expect(rows[0].rata_per_hari).toBe(6);
  });
  it('item koreksi ikut menambah hari', () => {
    const [r] = aggregateKeluarPerHari([
      { product_id: 9, keluar: 10, hari: 2, jenis: 'keluar', created_at: '2026-11-02T00:00:00Z' },
      { product_id: 9, keluar: 0, hari: 2, jenis: 'koreksi', created_at: '2026-11-04T00:00:00Z' }
    ]);
    expect(r.rata_per_hari).toBe(2.5);
  });
});
