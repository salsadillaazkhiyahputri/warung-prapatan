'use client';

import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Modal } from '@/components/ui/Modal';
import { Badge, BadgeType } from '@/components/ui/Badge';
import { DEFAULT_CATEGORY, KeluarPerHariRow, OpnameDetail, OpnameItemJenis, OpnameSession, Product } from '@/types';
import { formatDateOnly, formatDateTime } from '@/lib/export-utils';
import { isCountStale, relativeDayLabel } from '@/lib/stock-labels';
import { AlertCircle, ClipboardCheck, Eye, Filter, Info, RefreshCw, RotateCcw, TrendingDown } from 'lucide-react';

type Tab = 'sesi' | 'keluar';

const JENIS_BADGE: Record<OpnameItemJenis, { type: BadgeType; label: string }> = {
  keluar: { type: 'out', label: 'Keluar' },
  koreksi: { type: 'koreksi', label: 'Koreksi' },
  baseline: { type: 'neutral', label: 'Hitung awal' }
};

const labelStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px'
};

export default function OpnamePage() {
  const [sessions, setSessions] = useState<OpnameSession[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [productId, setProductId] = useState('all');

  const [tab, setTab] = useState<Tab>('sesi');

  // Tab 2: rata-rata keluar per hari
  const [kStart, setKStart] = useState('');
  const [kEnd, setKEnd] = useState('');
  const [kCategory, setKCategory] = useState('Semua');
  const [categories, setCategories] = useState<string[]>([DEFAULT_CATEGORY]);
  const [keluarRows, setKeluarRows] = useState<KeluarPerHariRow[]>([]);
  const [keluarRange, setKeluarRange] = useState<{ startDate: string; endDate: string } | null>(null);
  const [isKeluarLoading, setIsKeluarLoading] = useState(false);
  const [keluarError, setKeluarError] = useState('');

  const [detail, setDetail] = useState<OpnameDetail | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const fetchSessions = async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (productId !== 'all') params.append('productId', productId);
      const res = await fetch(`/api/opname?${params.toString()}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setSessions([]);
        setLoadError(data?.error || 'Gagal memuat riwayat stok opname');
        return;
      }
      setSessions(data);
    } catch {
      setLoadError('Terjadi kesalahan pada server');
    } finally {
      setIsLoading(false);
    }
  };

  const fetchKeluar = async () => {
    setIsKeluarLoading(true);
    setKeluarError('');
    try {
      const params = new URLSearchParams();
      if (kStart) params.append('startDate', kStart);
      if (kEnd) params.append('endDate', kEnd);
      if (kCategory !== 'Semua') params.append('category', kCategory);
      const res = await fetch(`/api/opname/keluar-per-hari?${params.toString()}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setKeluarRows([]);
        setKeluarError(data?.error || 'Gagal menghitung rata-rata keluar per hari');
        return;
      }
      setKeluarRows(data.rows);
      setKeluarRange(data.range);
    } catch {
      setKeluarError('Terjadi kesalahan pada server');
    } finally {
      setIsKeluarLoading(false);
    }
  };

  useEffect(() => {
    fetch('/api/products')
      .then((r) => (r.ok ? r.json() : []))
      .then(setProducts)
      .catch(() => setProducts([]));
    fetch('/api/products/categories')
      .then((r) => (r.ok ? r.json() : [DEFAULT_CATEGORY]))
      .then(setCategories)
      .catch(() => setCategories([DEFAULT_CATEGORY]));
  }, []);

  useEffect(() => {
    if (tab === 'keluar') fetchKeluar();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab, kStart, kEnd, kCategory]);

  useEffect(() => {
    fetchSessions();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [startDate, endDate, productId]);

  const openDetail = async (id: number) => {
    setIsDetailOpen(true);
    setIsDetailLoading(true);
    setDetail(null);
    setDetailError('');
    try {
      const res = await fetch(`/api/opname/${id}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setDetailError(data?.error || 'Gagal memuat detail opname');
        return;
      }
      setDetail(data);
    } catch {
      setDetailError('Terjadi kesalahan pada server');
    } finally {
      setIsDetailLoading(false);
    }
  };

  const hasFilter = startDate || endDate || productId !== 'all';
  const selectedProductId = productId !== 'all' ? Number(productId) : null;

  return (
    <DashboardLayout
      title="Stok Opname"
      subtitle="Riwayat hitung fisik stok. Barang keluar dihitung dari selisih stok sistem dan hitungan."
    >
      <div className="info-callout">
        <Info size={17} style={{ color: '#0F172A', flexShrink: 0 }} />
        <span>
          Opname dicatat lewat Telegram. Halaman ini hanya menampilkan riwayat dan tidak bisa menambah atau mengubah opname.
        </span>
      </div>

      <div role="tablist" style={{ display: 'flex', gap: '4px', borderBottom: '1px solid #E2E8F0', marginBottom: '18px' }}>
        {([['sesi', 'Riwayat sesi'], ['keluar', 'Rata-rata keluar per hari']] as [Tab, string][]).map(([key, label]) => (
          <button
            key={key}
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            style={{
              padding: '9px 14px',
              fontSize: '13px',
              fontWeight: tab === key ? 700 : 500,
              color: tab === key ? '#0F172A' : '#64748B',
              background: 'transparent',
              border: 'none',
              borderBottom: `2px solid ${tab === key ? '#0F172A' : 'transparent'}`,
              marginBottom: '-1px',
              cursor: 'pointer'
            }}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === 'sesi' && (<>
      <div className="page-header-box" style={{ marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              padding: '6px 14px', borderRadius: 'var(--radius-full)', background: '#FFFFFF',
              border: '1px solid #E2E8F0', fontSize: '12.5px', fontWeight: 600, color: '#0F172A', boxShadow: 'var(--shadow-xs)'
            }}
          >
            Total <strong>{sessions.length}</strong> Sesi Opname
          </div>
          <button onClick={fetchSessions} className="btn btn-secondary btn-sm" title="Segarkan Data">
            <RefreshCw size={14} className={isLoading ? 'pulse' : ''} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={15} style={{ color: '#0F172A' }} />
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', margin: 0 }}>Filter Opname</h4>
          </div>
          {hasFilter && (
            <button
              onClick={() => { setStartDate(''); setEndDate(''); setProductId('all'); }}
              className="btn btn-secondary btn-sm"
              style={{ height: '30px', fontSize: '12px', padding: '0 12px' }}
            >
              <RotateCcw size={12} />
              <span>Reset Filter</span>
            </button>
          )}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '16px' }}>
          <div>
            <label className="form-label" style={labelStyle}>Dari Tanggal</label>
            <input type="date" className="form-input" style={{ height: '38px', fontSize: '13px' }}
              value={startDate} max={endDate || undefined} onChange={(e) => setStartDate(e.target.value)} />
          </div>
          <div>
            <label className="form-label" style={labelStyle}>Sampai Tanggal</label>
            <input type="date" className="form-input" style={{ height: '38px', fontSize: '13px' }}
              value={endDate} min={startDate || undefined} onChange={(e) => setEndDate(e.target.value)} />
          </div>
          <div>
            <label className="form-label" style={labelStyle}>Produk</label>
            <select className="form-select" style={{ height: '38px', fontSize: '13px' }}
              value={productId} onChange={(e) => setProductId(e.target.value)}>
              <option value="all">Semua Produk</option>
              {products.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '24%' }}>Tanggal</th>
              <th style={{ width: '20%' }}>Pengguna</th>
              <th style={{ width: '16%', textAlign: 'right' }}>Jumlah produk</th>
              <th>Catatan</th>
              <th style={{ width: '90px', textAlign: 'center' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: '#94A3B8' }}>Memuat riwayat opname...</td>
              </tr>
            ) : loadError ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: '#DC2626' }}>
                  <AlertCircle size={22} style={{ margin: '0 auto 6px', display: 'block' }} />
                  {loadError}
                </td>
              </tr>
            ) : sessions.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
                  <ClipboardCheck size={32} style={{ color: '#94A3B8', margin: '0 auto 8px', display: 'block' }} />
                  Belum ada stok opname yang sesuai filter.
                </td>
              </tr>
            ) : (
              sessions.map((s) => (
                <tr key={s.id}>
                  <td style={{ color: '#0F172A', fontSize: '13px', fontWeight: 600 }}>{formatDateTime(s.created_at)}</td>
                  <td style={{ color: '#475569', fontSize: '13px' }}>{s.username ?? '-'}</td>
                  <td style={{ textAlign: 'right', fontSize: '13.5px', color: '#0F172A' }}>{s.item_count}</td>
                  <td style={{ color: '#475569', fontSize: '13px' }}>{s.note || <span style={{ color: '#94A3B8' }}>-</span>}</td>
                  <td style={{ textAlign: 'center' }}>
                    <button onClick={() => openDetail(s.id)} className="btn btn-secondary btn-sm" title="Lihat detail">
                      <Eye size={13} />
                      <span>Detail</span>
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      </>)}

      {tab === 'keluar' && (<>
      <div className="card" style={{ marginBottom: '22px' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '16px', alignItems: 'end' }}>
          <div>
            <label className="form-label" style={labelStyle}>Dari Tanggal</label>
            <input type="date" className="form-input" style={{ height: '38px', fontSize: '13px' }}
              value={kStart || keluarRange?.startDate || ''} max={kEnd || undefined} onChange={(e) => setKStart(e.target.value)} />
          </div>
          <div>
            <label className="form-label" style={labelStyle}>Sampai Tanggal</label>
            <input type="date" className="form-input" style={{ height: '38px', fontSize: '13px' }}
              value={kEnd || keluarRange?.endDate || ''} min={kStart || undefined} onChange={(e) => setKEnd(e.target.value)} />
          </div>
          <div>
            <label className="form-label" style={labelStyle}>Kategori</label>
            <select className="form-select" style={{ height: '38px', fontSize: '13px' }} value={kCategory} onChange={(e) => setKCategory(e.target.value)}>
              <option value="Semua">Semua Kategori</option>
              {categories.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button onClick={fetchKeluar} className="btn btn-secondary btn-sm" style={{ height: '38px' }}>
              <RefreshCw size={14} className={isKeluarLoading ? 'pulse' : ''} />
              <span>Segarkan</span>
            </button>
            {(kStart || kEnd || kCategory !== 'Semua') && (
              <button onClick={() => { setKStart(''); setKEnd(''); setKCategory('Semua'); }} className="btn btn-secondary btn-sm" style={{ height: '38px' }}>
                <RotateCcw size={12} />
                <span>Reset</span>
              </button>
            )}
          </div>
        </div>
        <p style={{ fontSize: '12px', color: '#64748B', margin: '12px 0 0' }}>
          {keluarRange ? `${formatDateOnly(keluarRange.startDate)} – ${formatDateOnly(keluarRange.endDate)}` : '30 hari terakhir'}
          {' · '}rata-rata = total keluar ÷ total hari antar hitungan. Hitung pertama (baseline) tidak dihitung.
        </p>
      </div>

      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th>Produk</th>
              <th>Kategori</th>
              <th style={{ textAlign: 'right' }}>Rata / hari</th>
              <th style={{ textAlign: 'right' }}>Total keluar</th>
              <th style={{ textAlign: 'right' }}>Jumlah hari</th>
              <th>Terakhir dihitung</th>
            </tr>
          </thead>
          <tbody>
            {isKeluarLoading && keluarRows.length === 0 ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#94A3B8' }}>Menghitung...</td></tr>
            ) : keluarError ? (
              <tr><td colSpan={6} style={{ textAlign: 'center', padding: '32px', color: '#DC2626' }}>{keluarError}</td></tr>
            ) : keluarRows.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
                  <TrendingDown size={30} style={{ color: '#94A3B8', margin: '0 auto 8px', display: 'block' }} />
                  Belum ada data opname pada rentang ini.
                </td>
              </tr>
            ) : keluarRows.map((r) => (
              <tr key={r.product_id}>
                <td style={{ fontWeight: 600, color: '#0F172A', fontSize: '13px' }}>{r.product_name}</td>
                <td style={{ fontSize: '13px', color: '#475569' }}>{r.category ?? '-'}</td>
                <td style={{ textAlign: 'right', fontSize: '13.5px', fontWeight: 700, color: '#0F172A' }}>
                  {r.rata_per_hari.toLocaleString('id-ID', { maximumFractionDigits: 1 })} pcs
                </td>
                <td style={{ textAlign: 'right', fontSize: '13px' }}>{r.total_keluar.toLocaleString('id-ID')} pcs</td>
                <td style={{ textAlign: 'right', fontSize: '13px', color: '#475569' }}>{r.total_hari}</td>
                <td style={{ fontSize: '13px', color: isCountStale(r.terakhir_dihitung) ? '#DC2626' : '#475569' }}>
                  {relativeDayLabel(r.terakhir_dihitung)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      </>)}

      <Modal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title={detail ? `Detail Opname · ${formatDateTime(detail.created_at)}` : 'Detail Opname'}
        maxWidth="820px"
      >
        {isDetailLoading ? (
          <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: '13px', padding: '20px 0' }}>Memuat detail...</p>
        ) : detailError ? (
          <p style={{ textAlign: 'center', color: '#DC2626', fontSize: '13px', padding: '20px 0' }}>{detailError}</p>
        ) : detail ? (
          <>
            <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '14px' }}>
              Dicatat oleh <strong style={{ color: '#0F172A' }}>{detail.username ?? '-'}</strong> · {detail.item_count} produk
              {detail.note ? ` · ${detail.note}` : ''}
            </p>
            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Produk</th>
                    <th style={{ textAlign: 'right' }}>Stok sistem</th>
                    <th style={{ textAlign: 'right' }}>Hitungan</th>
                    <th style={{ textAlign: 'right' }}>Keluar</th>
                    <th style={{ textAlign: 'right' }}>Keluar / hari</th>
                    <th>Jenis</th>
                  </tr>
                </thead>
                <tbody>
                  {detail.items.length === 0 ? (
                    <tr><td colSpan={6} style={{ textAlign: 'center', padding: '24px', color: '#64748B' }}>Sesi ini tidak punya item.</td></tr>
                  ) : detail.items.map((it) => {
                    const badge = JENIS_BADGE[it.jenis];
                    const highlight = selectedProductId === it.product_id;
                    return (
                      <tr key={it.id} style={highlight ? { background: '#F8FAFC' } : undefined}>
                        <td>
                          <div style={{ fontWeight: 600, color: '#0F172A', fontSize: '13px' }}>{it.product_name}</div>
                          {it.category && <div style={{ fontSize: '11.5px', color: '#64748B' }}>{it.category}</div>}
                        </td>
                        <td style={{ textAlign: 'right', fontSize: '13px' }}>{it.stok_sistem} pcs</td>
                        <td style={{ textAlign: 'right', fontSize: '13px', fontWeight: 600 }}>{it.hitungan} pcs</td>
                        <td style={{ textAlign: 'right', fontSize: '13px', color: it.keluar > 0 ? '#DC2626' : '#475569' }}>
                          {it.keluar} pcs
                          {it.koreksi !== 0 && (
                            <div style={{ fontSize: '11.5px', color: '#B45309' }}>koreksi {it.koreksi > 0 ? '+' : ''}{it.koreksi}</div>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', fontSize: '13px', color: '#475569' }}>
                          {it.keluar_per_hari !== null ? `${it.keluar_per_hari.toLocaleString('id-ID')} pcs` : '-'}
                          {it.hari ? <div style={{ fontSize: '11.5px', color: '#94A3B8' }}>{it.hari} hari</div> : null}
                        </td>
                        <td><Badge type={badge.type}>{badge.label}</Badge></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        ) : null}
      </Modal>
    </DashboardLayout>
  );
}


