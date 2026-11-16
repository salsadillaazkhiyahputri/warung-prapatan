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

