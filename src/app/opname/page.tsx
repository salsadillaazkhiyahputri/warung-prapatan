'use client';

import React, { useEffect, useState, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Modal } from '@/components/ui/Modal';
import { Badge, BadgeType } from '@/components/ui/Badge';
import { DEFAULT_CATEGORY, KeluarPerHariRow, OpnameDetail, OpnameItemJenis, OpnameSession, Product } from '@/types';
import { formatDateOnly, formatDateTime } from '@/lib/export-utils';
import { isCountStale, relativeDayLabel } from '@/lib/stock-labels';
import { AlertCircle, ClipboardCheck, Eye, Filter, Info, RefreshCw, RotateCcw, TrendingDown, Calendar } from 'lucide-react';
import { getClientCache, setClientCache } from '@/lib/client-cache';

type Tab = 'sesi' | 'keluar';

const JENIS_BADGE: Record<OpnameItemJenis, { type: BadgeType; label: string }> = {
  keluar: { type: 'out', label: 'Keluar' },
  koreksi: { type: 'koreksi', label: 'Koreksi' },
  baseline: { type: 'neutral', label: 'Hitung awal' }
};

const labelStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', fontWeight: 600, color: '#1E293B', marginBottom: '8px'
};

export default function OpnamePage() {
  const [sessions, setSessions] = useState<OpnameSession[]>(() => {
    return getClientCache<OpnameSession[]>('opname:sessions') || [];
  });
  const [products, setProducts] = useState<Product[]>(() => {
    return getClientCache<Product[]>('products:all') || [];
  });
  const [isLoading, setIsLoading] = useState(() => {
    return !getClientCache<OpnameSession[]>('opname:sessions');
  });
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

  const fetchSessions = useCallback(async (silent = false) => {
    const isDefault = !startDate && !endDate && productId === 'all';
    if (!silent && sessions.length === 0) setIsLoading(true);
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
      if (isDefault) setClientCache('opname:sessions', data);
    } catch {
      setLoadError('Terjadi kesalahan pada server');
    } finally {
      if (!silent) setIsLoading(false);
    }
  }, [startDate, endDate, productId, sessions.length]);

  const fetchKeluar = useCallback(async (silent = false) => {
    if (!silent) setIsKeluarLoading(true);
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
      if (!silent) setIsKeluarLoading(false);
    }
  }, [kStart, kEnd, kCategory]);

  useEffect(() => {
    fetch('/api/products')
      .then((r) => (r.ok ? r.json() : []))
      .then((data) => {
        setProducts(data);
        setClientCache('products:all', data);
      })
      .catch(() => setProducts([]));
    fetch('/api/products/categories')
      .then((r) => (r.ok ? r.json() : [DEFAULT_CATEGORY]))
      .then((data) => {
        setCategories(data);
        setClientCache('products:categories', data);
      })
      .catch(() => setCategories([DEFAULT_CATEGORY]));
  }, []);

  useEffect(() => {
    if (tab === 'keluar') fetchKeluar();
  }, [tab, fetchKeluar]);

  useEffect(() => {
    fetchSessions();
  }, [fetchSessions]);

  useEffect(() => {
    // Auto-refresh setiap 25 detik & saat tab kembali aktif
    const interval = setInterval(() => {
      if (tab === 'sesi') fetchSessions(true);
      else fetchKeluar(true);
    }, 25000);
    const handleFocus = () => {
      if (tab === 'sesi') fetchSessions(true);
      else fetchKeluar(true);
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [tab, fetchSessions, fetchKeluar]);

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

  const renderDateInput = (
    label: string,
    value: string,
    onChange: (val: string) => void,
    max?: string,
    min?: string
  ) => {
    return (
      <div>
        <label className="form-label" style={labelStyle}>
          <Calendar size={14} style={{ color: '#64748B' }} />
          <span>{label}</span>
        </label>
        <div style={{ position: 'relative' }}>
          <input
            type="text"
            readOnly
            value={value ? (() => {
              const [y, m, d] = value.split('-');
              return `${d}/${m}/${y}`;
            })() : ''}
            className="form-input"
            placeholder="dd/mm/yyyy"
            style={{
              paddingRight: '38px',
              cursor: 'pointer',
              background: '#FFFFFF',
              height: '42px',
              fontSize: '14px',
              borderRadius: '8px'
            }}
            onClick={(e) => {
              const dateInput = e.currentTarget.nextElementSibling as HTMLInputElement;
              if (dateInput) {
                if ('showPicker' in HTMLInputElement.prototype) {
                  dateInput.showPicker();
                } else {
                  dateInput.focus();
                }
              }
            }}
          />
          <input
            type="date"
            value={value}
            max={max || undefined}
            min={min || undefined}
            onChange={(e) => onChange(e.target.value)}
            style={{
              position: 'absolute',
              opacity: 0,
              pointerEvents: 'none',
              width: '100%',
              height: '100%',
              top: 0,
              left: 0
            }}
          />
          <Calendar
            size={16}
            style={{
              position: 'absolute',
              right: '12px',
              top: '50%',
              transform: 'translateY(-50%)',
              color: '#64748B',
              pointerEvents: 'none'
            }}
          />
        </div>
      </div>
    );
  };

  return (
    <DashboardLayout
      title="Stok Opname"
      subtitle="Riwayat hitung fisik stok. Barang keluar dihitung dari selisih stok sistem dan hitungan."
    >
      <div className="info-callout" style={{ marginBottom: '18px' }}>
        <Info size={17} style={{ color: '#0F172A', flexShrink: 0 }} />
        <span>
          Opname dicatat lewat Telegram. Halaman ini hanya menampilkan riwayat hitungan fisik dan tidak bisa menambah atau mengubah opname.
        </span>
      </div>

      {/* Filter Card di paling atas (Sesuai Permintaan Ditukar dengan Tab) */}
      {tab === 'sesi' ? (
        <div className="card" style={{ marginBottom: '20px', padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <Filter size={16} style={{ color: '#0F172A' }} />
              <h4 style={{ fontSize: '14.5px', fontWeight: 700, color: '#0F172A', margin: 0 }}>Filter Riwayat Opname</h4>
            </div>
            {hasFilter && (
              <button
                onClick={() => { setStartDate(''); setEndDate(''); setProductId('all'); }}
                className="btn btn-secondary btn-sm"
                style={{ height: '32px', fontSize: '12.5px', padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <RotateCcw size={13} />
                <span>Reset Filter</span>
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            {renderDateInput('Dari Tanggal', startDate, setStartDate, endDate || undefined)}
            {renderDateInput('Sampai Tanggal', endDate, setEndDate, undefined, startDate || undefined)}
            <div>
              <label className="form-label" style={labelStyle}>
                <Filter size={14} style={{ color: '#64748B' }} />
                <span>Produk</span>
              </label>
              <select
                className="form-select"
                style={{ height: '42px', fontSize: '14px', borderRadius: '8px' }}
                value={productId}
                onChange={(e) => setProductId(e.target.value)}
              >
                <option value="all">Semua Produk</option>
                {products.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      ) : (
        <div className="card" style={{ marginBottom: '20px', padding: '20px 24px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <TrendingDown size={16} style={{ color: '#0F172A' }} />
                <h4 style={{ fontSize: '14.5px', fontWeight: 700, color: '#0F172A', margin: 0 }}>Filter Analisis Barang Keluar</h4>
              </div>
              <p style={{ fontSize: '12.5px', color: '#64748B', margin: '4px 0 0' }}>
                {keluarRange ? `${formatDateOnly(keluarRange.startDate)} – ${formatDateOnly(keluarRange.endDate)}` : '30 hari terakhir'} · Rata-rata dihitung dari total keluar ÷ jumlah hari antar-hitungan
              </p>
            </div>
            {(kStart || kEnd || kCategory !== 'Semua') && (
              <button
                onClick={() => { setKStart(''); setKEnd(''); setKCategory('Semua'); }}
                className="btn btn-secondary btn-sm"
                style={{ height: '32px', fontSize: '12.5px', padding: '0 12px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
              >
                <RotateCcw size={13} />
                <span>Reset Filter</span>
              </button>
            )}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '16px' }}>
            {renderDateInput('Dari Tanggal', kStart || keluarRange?.startDate || '', setKStart, kEnd || undefined)}
            {renderDateInput('Sampai Tanggal', kEnd || keluarRange?.endDate || '', setKEnd, undefined, kStart || undefined)}
            <div>
              <label className="form-label" style={labelStyle}>
                <Filter size={14} style={{ color: '#64748B' }} />
                <span>Kategori Produk</span>
              </label>
              <select
                className="form-select"
                style={{ height: '42px', fontSize: '14px', borderRadius: '8px' }}
                value={kCategory}
                onChange={(e) => setKCategory(e.target.value)}
              >
                <option value="Semua">Semua Kategori</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
      )}

      {/* Segmented Tab Bar (Sekarang Berada di Bawah Filter) */}
      <div
        style={{
          display: 'inline-flex',
          background: '#F1F5F9',
          padding: '4px',
          borderRadius: 'var(--radius-md)',
          marginBottom: '20px',
          gap: '4px',
          border: '1px solid #E2E8F0'
        }}
      >
        <button
          type="button"
          onClick={() => setTab('sesi')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '13.5px',
            fontWeight: tab === 'sesi' ? 700 : 500,
            background: tab === 'sesi' ? '#FFFFFF' : 'transparent',
            color: tab === 'sesi' ? '#0F172A' : '#64748B',
            border: tab === 'sesi' ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid transparent',
            boxShadow: tab === 'sesi' ? 'var(--shadow-xs)' : 'none',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)'
          }}
        >
          <ClipboardCheck size={16} style={{ color: tab === 'sesi' ? '#0F172A' : '#94A3B8' }} />
          <span>Riwayat Sesi Opname</span>
          <span
            style={{
              padding: '1px 8px',
              borderRadius: 'var(--radius-full)',
              fontSize: '11px',
              fontWeight: 700,
              background: tab === 'sesi' ? '#0F172A' : '#E2E8F0',
              color: tab === 'sesi' ? '#FFFFFF' : '#475569'
            }}
          >
            {sessions.length}
          </span>
        </button>

        <button
          type="button"
          onClick={() => setTab('keluar')}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
            padding: '8px 18px',
            borderRadius: 'var(--radius-sm)',
            fontSize: '13.5px',
            fontWeight: tab === 'keluar' ? 700 : 500,
            background: tab === 'keluar' ? '#FFFFFF' : 'transparent',
            color: tab === 'keluar' ? '#0F172A' : '#64748B',
            border: tab === 'keluar' ? '1px solid rgba(15, 23, 42, 0.08)' : '1px solid transparent',
            boxShadow: tab === 'keluar' ? 'var(--shadow-xs)' : 'none',
            cursor: 'pointer',
            transition: 'all var(--transition-fast)'
          }}
        >
          <TrendingDown size={16} style={{ color: tab === 'keluar' ? '#0F172A' : '#94A3B8' }} />
          <span>Rata-rata Keluar per Hari</span>
        </button>
      </div>

      {tab === 'sesi' && (
        <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '26%' }}>Tanggal & Waktu</th>
                  <th style={{ width: '22%' }}>Pengguna</th>
                  <th style={{ width: '18%', textAlign: 'center' }}>Jumlah Produk</th>
                  <th>Catatan</th>
                  <th style={{ width: '110px', textAlign: 'center' }}>Aksi</th>
                </tr>
              </thead>
              <tbody>
                {isLoading ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: '#94A3B8' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid #CBD5E1', borderTopColor: '#0F172A', animation: 'spin 0.6s linear infinite' }} />
                        <span>Memuat riwayat opname...</span>
                      </div>
                    </td>
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
                      <td style={{ color: '#0F172A', fontSize: '14px', fontWeight: 600 }}>
                        {formatDateTime(s.created_at)}
                      </td>
                      <td style={{ color: '#475569', fontSize: '14px' }}>
                        {s.username ?? '-'}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <span
                          style={{
                            display: 'inline-flex',
                            alignItems: 'center',
                            padding: '3px 12px',
                            borderRadius: 'var(--radius-full)',
                            background: '#F1F5F9',
                            border: '1px solid #E2E8F0',
                            fontSize: '13px',
                            fontWeight: 700,
                            color: '#0F172A'
                          }}
                        >
                          {s.item_count} produk
                        </span>
                      </td>
                      <td style={{ color: '#475569', fontSize: '14px' }}>
                        {s.note || <span style={{ color: '#94A3B8' }}>-</span>}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <button
                          onClick={() => openDetail(s.id)}
                          className="btn btn-secondary"
                          style={{ height: '34px', padding: '0 14px', fontSize: '13px', display: 'inline-flex', alignItems: 'center', gap: '6px' }}
                          title="Lihat detail hitungan opname"
                        >
                          <Eye size={14} />
                          <span>Detail</span>
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
      )}

      {tab === 'keluar' && (
          /* Tabel Rata-rata Keluar */
          <div className="table-container">
            <table className="data-table">
              <thead>
                <tr>
                  <th style={{ width: '28%' }}>Produk</th>
                  <th style={{ width: '16%' }}>Kategori</th>
                  <th style={{ width: '18%', textAlign: 'right' }}>Rata-rata Keluar / Hari</th>
                  <th style={{ width: '14%', textAlign: 'right' }}>Total Keluar</th>
                  <th style={{ width: '10%', textAlign: 'center' }}>Hari</th>
                  <th style={{ width: '14%' }}>Terakhir Dihitung</th>
                </tr>
              </thead>
              <tbody>
                {isKeluarLoading && keluarRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: '#94A3B8' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                        <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid #CBD5E1', borderTopColor: '#0F172A', animation: 'spin 0.6s linear infinite' }} />
                        <span>Menghitung rata-rata keluar...</span>
                      </div>
                    </td>
                  </tr>
                ) : keluarError ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: '#DC2626' }}>
                      <AlertCircle size={22} style={{ margin: '0 auto 6px', display: 'block' }} />
                      {keluarError}
                    </td>
                  </tr>
                ) : keluarRows.length === 0 ? (
                  <tr>
                    <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
                      <TrendingDown size={32} style={{ color: '#94A3B8', margin: '0 auto 8px', display: 'block' }} />
                      Belum ada data opname pada rentang ini.
                    </td>
                  </tr>
                ) : (
                  keluarRows.map((r) => (
                    <tr key={r.product_id}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#0F172A', fontSize: '14.5px' }}>
                          {r.product_name}
                        </div>
                      </td>
                      <td>
                        <Badge type="neutral">{r.category ?? 'Lainnya'}</Badge>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '15px', fontWeight: 800, color: '#0F172A' }}>
                          {r.rata_per_hari.toLocaleString('id-ID', { maximumFractionDigits: 1 })}
                        </span>{' '}
                        <span style={{ fontSize: '12.5px', color: '#64748B', fontWeight: 600 }}>pcs/hari</span>
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>
                          {r.total_keluar.toLocaleString('id-ID')}
                        </span>{' '}
                        <span style={{ fontSize: '12px', color: '#64748B' }}>pcs</span>
                      </td>
                      <td style={{ textAlign: 'center', fontSize: '14px', color: '#475569', fontWeight: 500 }}>
                        {r.total_hari} hari
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '13px',
                            fontWeight: isCountStale(r.terakhir_dihitung) ? 700 : 500,
                            color: isCountStale(r.terakhir_dihitung) ? '#DC2626' : '#475569'
                          }}
                        >
                          {relativeDayLabel(r.terakhir_dihitung)}
                        </span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
      )}

      {/* Modal Detail Opname */}
      <Modal
        isOpen={isDetailOpen}
        onClose={() => setIsDetailOpen(false)}
        title={detail ? `Detail Opname · ${formatDateTime(detail.created_at)}` : 'Detail Opname'}
        maxWidth="840px"
      >
        {isDetailLoading ? (
          <p style={{ textAlign: 'center', color: '#94A3B8', fontSize: '13px', padding: '24px 0' }}>Memuat detail...</p>
        ) : detailError ? (
          <p style={{ textAlign: 'center', color: '#DC2626', fontSize: '13px', padding: '24px 0' }}>{detailError}</p>
        ) : detail ? (
          <>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 16px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 'var(--radius-md)', marginBottom: '16px', fontSize: '13.5px', color: '#475569', flexWrap: 'wrap' }}>
              <span>Dicatat oleh: <strong style={{ color: '#0F172A' }}>{detail.username ?? '-'}</strong></span>
              <span>·</span>
              <span>Total: <strong style={{ color: '#0F172A' }}>{detail.item_count} produk</strong></span>
              {detail.note && (
                <>
                  <span>·</span>
                  <span>Catatan: <em>{detail.note}</em></span>
                </>
              )}
            </div>

            <div className="table-container">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Produk</th>
                    <th style={{ textAlign: 'right' }}>Stok Sistem</th>
                    <th style={{ textAlign: 'right' }}>Hitungan Fisik</th>
                    <th style={{ textAlign: 'right' }}>Keluar</th>
                    <th style={{ textAlign: 'right' }}>Rata-rata / Hari</th>
                    <th style={{ textAlign: 'center' }}>Jenis</th>
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
                          <div style={{ fontWeight: 600, color: '#0F172A', fontSize: '14px' }}>{it.product_name}</div>
                          {it.category && <div style={{ fontSize: '12px', color: '#64748B' }}>{it.category}</div>}
                        </td>
                        <td style={{ textAlign: 'right', fontSize: '14px', color: '#475569' }}>{it.stok_sistem} pcs</td>
                        <td style={{ textAlign: 'right', fontSize: '14px', fontWeight: 700, color: '#0F172A' }}>{it.hitungan} pcs</td>
                        <td style={{ textAlign: 'right', fontSize: '14px', fontWeight: 600, color: it.keluar > 0 ? '#DC2626' : '#475569' }}>
                          {it.keluar} pcs
                          {it.koreksi !== 0 && (
                            <div style={{ fontSize: '12px', color: '#B45309', fontWeight: 500 }}>koreksi {it.koreksi > 0 ? '+' : ''}{it.koreksi}</div>
                          )}
                        </td>
                        <td style={{ textAlign: 'right', fontSize: '14px', color: '#475569' }}>
                          {it.keluar_per_hari !== null ? `${it.keluar_per_hari.toLocaleString('id-ID')} pcs` : '-'}
                          {it.hari ? <div style={{ fontSize: '12px', color: '#94A3B8' }}>{it.hari} hari</div> : null}
                        </td>
                        <td style={{ textAlign: 'center' }}><Badge type={badge.type}>{badge.label}</Badge></td>
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
