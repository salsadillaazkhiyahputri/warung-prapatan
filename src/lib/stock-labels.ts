// Helper murni (tanpa akses database) yang dipakai bersama oleh server dan UI.
import { SupplierJenis, TransactionKind, TransactionSource, TransactionType } from '@/types';

export const STALE_COUNT_DAYS = 14;

export const SUPPLIER_JENIS_LABEL: Record<SupplierJenis, string> = {
  utama: 'Utama',
  cadangan: 'Cadangan',
  grosir: 'Grosir'
};

export const TRANSACTION_KIND_LABEL: Record<TransactionKind, string> = {
  masuk: 'Masuk',
  keluar_opname: 'Keluar (opname)',
  keluar_manual: 'Keluar (manual)',
  koreksi: 'Koreksi',
  stok_awal: 'Stok awal'
};

export const TRANSACTION_KINDS = Object.keys(TRANSACTION_KIND_LABEL) as TransactionKind[];

export function isTransactionKind(v: unknown): v is TransactionKind {
  return typeof v === 'string' && (TRANSACTION_KINDS as string[]).includes(v);
}

// Aturan (asumsi, lihat PERUBAHAN.md):
// - masuk dari supplier sistem "Koreksi Stok" atau masuk yang berasal dari opname = Koreksi
// - keluar dari opname = Keluar (opname); keluar lain = Keluar (manual)
// - masuk lain = Masuk
// - penyesuaian opname pertama (source='opname', note diawali "Stok awal") = Stok awal, apa pun tipenya
export const STOK_AWAL_NOTE_PREFIX = 'stok awal';

export function isStokAwalNote(note: string | null | undefined): boolean {
  return typeof note === 'string' && note.trim().toLowerCase().startsWith(STOK_AWAL_NOTE_PREFIX);
}

export function classifyTransaction(t: {
  type: TransactionType;
  source?: TransactionSource | null;
  supplierIsAdjustment?: boolean | null;
  note?: string | null;
}): TransactionKind {
  if (t.source === 'opname' && isStokAwalNote(t.note)) return 'stok_awal';
  if (t.type === 'out') return t.source === 'opname' ? 'keluar_opname' : 'keluar_manual';
  if (t.supplierIsAdjustment || t.source === 'opname') return 'koreksi';
  return 'masuk';
}

const DAY_MS = 86400000;

// Selisih hari kalender WIB antara dua waktu (b - a).
function wibDayNumber(d: Date): number {
  return Math.floor((d.getTime() + 7 * 3600000) / DAY_MS);
}

export function daysSince(iso: string | null | undefined, now: Date = new Date()): number | null {
  if (!iso) return null;
  const t = new Date(iso);
  if (Number.isNaN(t.getTime())) return null;
  return Math.max(0, wibDayNumber(now) - wibDayNumber(t));
}

export function relativeDayLabel(iso: string | null | undefined, now: Date = new Date()): string {
  const d = daysSince(iso, now);
  if (d === null) return 'Belum pernah';
  if (d === 0) return 'Hari ini';
  if (d === 1) return 'Kemarin';
  return `${d} hari lalu`;
}

// Merah di UI: belum pernah dihitung atau lebih dari 14 hari.
export function isCountStale(iso: string | null | undefined, now: Date = new Date(), limitDays = STALE_COUNT_DAYS): boolean {
  const d = daysSince(iso, now);
  return d === null || d > limitDays;
}

// Ringkas item opname per produk: total keluar, total hari, rata-rata, terakhir dihitung.
// Item "baseline" (hitung pertama) dan item tanpa hari tidak menambah total hari/keluar,
// tetapi tetap dipakai untuk "terakhir dihitung". Urut rata-rata terbesar.
export function aggregateKeluarPerHari(items: {
  product_id: number;
  keluar: number | string | null;
  hari: number | string | null;
  jenis: string;
  created_at: string;
}[]) {
  const map = new Map<number, { product_id: number; total_keluar: number; total_hari: number; terakhir_dihitung: string | null }>();
  for (const it of items) {
    const row = map.get(it.product_id) ?? { product_id: it.product_id, total_keluar: 0, total_hari: 0, terakhir_dihitung: null };
    if (!row.terakhir_dihitung || it.created_at > row.terakhir_dihitung) row.terakhir_dihitung = it.created_at;
    const hari = Number(it.hari);
    if (it.jenis !== 'baseline' && Number.isFinite(hari) && hari > 0) {
      row.total_hari += hari;
      row.total_keluar += Number(it.keluar) || 0;
    }
    map.set(it.product_id, row);
  }
  return [...map.values()]
    .filter((r) => r.total_hari > 0)
    .map((r) => ({ ...r, rata_per_hari: perDay(r.total_keluar, r.total_hari) ?? 0 }))
    .sort((a, b) => b.rata_per_hari - a.rata_per_hari || b.total_keluar - a.total_keluar);
}

// Rata-rata aman: pembagi 0 / kosong -> null.
export function perDay(total: number, days: number | null | undefined): number | null {
  if (!days || days <= 0 || !Number.isFinite(total)) return null;
  return Math.round((total / days) * 10) / 10;
}
