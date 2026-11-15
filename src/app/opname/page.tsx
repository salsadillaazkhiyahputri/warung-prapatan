'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/Badge';
import { StockOpnameSession, StockOpnameItem, KeluarPerHariItem, Product } from '@/types';
import { formatDateTime } from '@/lib/export-utils';
import {
  ClipboardCheck,
  Calendar,
  Filter,
  RefreshCw,
  Send,
  RotateCcw,
  TrendingDown,
  Layers,
  ChevronRight,
  Clock
} from 'lucide-react';

export default function OpnamePage() {
  const [activeTab, setActiveTab] = useState<'sessions' | 'average'>('sessions');

  // Sessions Tab State
  const [sessions, setSessions] = useState<StockOpnameSession[]>([]);
  const [items, setItems] = useState<StockOpnameItem[]>([]);
  const [selectedSessionId, setSelectedSessionId] = useState<number | null>(null);
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('all');
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoadingSessions, setIsLoadingSessions] = useState(true);

  // Average Tab State
  const [averageList, setAverageList] = useState<KeluarPerHariItem[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  const [isLoadingAverage, setIsLoadingAverage] = useState(true);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (err) {
      console.error('Error fetch products:', err);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (err) {
      console.error('Error fetch categories:', err);
    }
  };

  const fetchSessions = async () => {
    setIsLoadingSessions(true);
    try {
      const params = new URLSearchParams();
      params.append('tab', 'sessions');
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (selectedProductId !== 'all') params.append('productId', selectedProductId);

      const res = await fetch(`/api/opname?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setSessions(data.sessions || []);
        setItems(data.items || []);
        if (data.sessions && data.sessions.length > 0 && selectedSessionId === null) {
          setSelectedSessionId(data.sessions[0].id);
        }
      }
    } catch (err) {
      console.error('Error fetch opname sessions:', err);
    } finally {
      setIsLoadingSessions(false);
    }
  };

  const fetchAverage = async () => {
    setIsLoadingAverage(true);
    try {
      const params = new URLSearchParams();
      params.append('tab', 'keluar_per_hari');
      if (selectedCategory !== 'Semua') params.append('category', selectedCategory);

      const res = await fetch(`/api/opname?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setAverageList(data || []);
      }
    } catch (err) {
      console.error('Error fetch keluar per hari:', err);
    } finally {
      setIsLoadingAverage(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
  }, []);

  useEffect(() => {
    if (activeTab === 'sessions') {
      fetchSessions();
    } else {
      fetchAverage();
    }
  }, [activeTab, startDate, endDate, selectedProductId, selectedCategory]);

  const handleResetFilter = () => {
    setStartDate('');
    setEndDate('');
    setSelectedProductId('all');
    setSelectedCategory('Semua');
  };

  const selectedSessionItems = items.filter(it => it.opname_id === selectedSessionId);

  return (
    <DashboardLayout
      title="Stok Opname"
      subtitle="Data hasil perhitungan fisik stok barang berkala yang dicatat melalui bot Telegram"
    >
      {/* Banner Keterangan Sistem Telegram */}
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '12px 18px',
          background: '#EFF6FF',
          border: '1px solid #BFDBFE',
          borderRadius: 'var(--radius-md)',
          marginBottom: '20px'
        }}
      >
        <Send size={18} style={{ color: '#2563EB', flexShrink: 0 }} />
        <p style={{ fontSize: '13px', color: '#1E40AF', margin: 0, lineHeight: 1.5 }}>
          <strong>Pemberitahuan:</strong> Stok Opname dicatat secara harian/berkala oleh petugas toko lewat{' '}
          <strong>Bot Telegram</strong>. Halaman ini hanya menampilkan hasil perhitungan, riwayat sesi opname, dan analisis rata-rata keluar barang.
        </p>
      </div>

      {/* Tab Navigation */}
      <div
        style={{
          display: 'flex',
          borderBottom: '1px solid #E2E8F0',
          marginBottom: '20px',
          gap: '24px'
        }}
      >
        <button
          onClick={() => setActiveTab('sessions')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 4px',
            border: 'none',
            borderBottom: activeTab === 'sessions' ? '2.5px solid #0F172A' : '2.5px solid transparent',
            background: 'transparent',
            color: activeTab === 'sessions' ? '#0F172A' : '#64748B',
            fontWeight: activeTab === 'sessions' ? 700 : 500,
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          <ClipboardCheck size={17} />
          <span>Riwayat Sesi Opname</span>
        </button>

        <button
          onClick={() => setActiveTab('average')}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '8px',
            padding: '12px 4px',
            border: 'none',
            borderBottom: activeTab === 'average' ? '2.5px solid #0F172A' : '2.5px solid transparent',
            background: 'transparent',
            color: activeTab === 'average' ? '#0F172A' : '#64748B',
            fontWeight: activeTab === 'average' ? 700 : 500,
            fontSize: '14px',
            cursor: 'pointer'
          }}
        >
          <TrendingDown size={17} />
          <span>Rata-rata Keluar per Hari (30 Hari)</span>
        </button>
      </div>

      {/* =========================================================================
          TAB 1: RIWAYAT SESI OPNAME (Daftar Sesi + Detail per Sesi)
          ========================================================================= */}
      {activeTab === 'sessions' && (
        <>
          {/* Filter Bar */}
          <div className="card" style={{ padding: '16px 20px', marginBottom: '20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '12px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Filter size={15} style={{ color: '#0F172A' }} />
                <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                  Filter Sesi Opname
                </h4>
              </div>

              {(startDate || endDate || selectedProductId !== 'all') && (
                <button
                  onClick={handleResetFilter}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '4px',
                    fontSize: '12px',
                    color: '#64748B',
                    background: 'transparent',
                    border: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <RotateCcw size={12} />
                  <span>Reset Filter</span>
                </button>
              )}
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
                gap: '12px'
              }}
            >
              <div>
                <label className="form-label" style={{ fontSize: '12px' }}>
                  <Calendar size={13} style={{ display: 'inline', marginRight: '4px' }} />
                  Dari Tanggal
                </label>
                <input
                  type="date"
                  className="input"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '12px' }}>
                  <Calendar size={13} style={{ display: 'inline', marginRight: '4px' }} />
                  Sampai Tanggal
                </label>
                <input
                  type="date"
                  className="input"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>

              <div>
                <label className="form-label" style={{ fontSize: '12px' }}>
                  Filter Produk
                </label>
                <select
                  className="input"
                  value={selectedProductId}
                  onChange={(e) => setSelectedProductId(e.target.value)}
                >
                  <option value="all">Semua Produk</option>
                  {products.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* 2 Kolom: Sisi Kiri Daftar Sesi, Sisi Kanan Detail Sesi */}
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '320px 1fr',
              gap: '20px',
              alignItems: 'start'
            }}
          >
            {/* Daftar Sesi Opname */}
            <div className="card" style={{ padding: '16px' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
                <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                  Daftar Sesi ({sessions.length})
                </h4>
                <button onClick={fetchSessions} className="btn-icon" title="Segarkan">
                  <RefreshCw size={14} className={isLoadingSessions ? 'pulse' : ''} />
                </button>
              </div>

              {isLoadingSessions ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#94A3B8', fontSize: '13px' }}>
                  Memuat sesi...
                </div>
              ) : sessions.length === 0 ? (
                <div style={{ padding: '30px', textAlign: 'center', color: '#64748B', fontSize: '13px' }}>
                  Belum ada sesi opname tercatat.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {sessions.map((s) => {
                    const isSelected = s.id === selectedSessionId;
                    return (
                      <div
                        key={s.id}
                        onClick={() => setSelectedSessionId(s.id)}
                        style={{
                          padding: '12px 14px',
                          borderRadius: 'var(--radius-sm)',
                          border: isSelected ? '1px solid #0F172A' : '1px solid #E2E8F0',
                          background: isSelected ? '#F8FAFC' : '#FFFFFF',
                          cursor: 'pointer',
                          transition: 'all 0.15s ease'
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                          <span style={{ fontSize: '13px', fontWeight: 700, color: '#0F172A' }}>
                            Sesi #{s.id}
                          </span>
                          <span style={{ fontSize: '11.5px', color: '#64748B' }}>
                            {s.item_count} item
                          </span>
                        </div>
                        <p style={{ fontSize: '12px', color: '#64748B', margin: '4px 0 0 0' }}>
                          {s.tanggal_wib || formatDateTime(s.created_at)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Detail Item per Sesi Terpilih */}
            <div className="card" style={{ overflow: 'hidden' }}>
              <div style={{ padding: '16px 20px', borderBottom: '1px solid #E2E8F0', background: '#F8FAFC' }}>
                <h4 style={{ fontSize: '14.5px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                  Detail Hasil Opname: Sesi #{selectedSessionId || '—'}
                </h4>
                <p style={{ fontSize: '12.5px', color: '#64748B', margin: '3px 0 0 0' }}>
                  Perbandingan stok sistem vs hitungan fisik dan kalkulasi barang keluar
                </p>
              </div>

              <div className="table-container">
                <table className="table">
                  <thead>
                    <tr>
                      <th>PRODUK</th>
                      <th style={{ textAlign: 'right' }}>STOK SISTEM</th>
                      <th style={{ textAlign: 'right' }}>HITUNGAN FISIK</th>
                      <th style={{ textAlign: 'center' }}>STATUS / JENIS</th>
                      <th style={{ textAlign: 'right' }}>KELUAR / KOREKSI</th>
                      <th style={{ textAlign: 'center' }}>PERIODE HARI</th>
                    </tr>
                  </thead>
                  <tbody>
                    {selectedSessionItems.length === 0 ? (
                      <tr>
                        <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: '#94A3B8' }}>
                          Pilih sesi opname di sebelah kiri untuk melihat rincian item.
                        </td>
                      </tr>
                    ) : (
                      selectedSessionItems.map((item) => {
                        const isBaseline = item.jenis === 'baseline';

                        return (
                          <tr key={item.id}>
                            <td style={{ fontWeight: 600, color: '#0F172A' }}>
                              <div>{item.product_name || `Produk #${item.product_id}`}</div>
                              <span style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 400 }}>
                                {item.category}
                              </span>
                            </td>
                            <td style={{ textAlign: 'right', color: '#475569' }}>
                              {item.stok_sistem} {item.unit}
                            </td>
                            <td style={{ textAlign: 'right', fontWeight: 700, color: '#0F172A' }}>
                              {item.hitungan} {item.unit}
                            </td>
                            <td style={{ textAlign: 'center' }}>
                              {isBaseline ? (
                                <Badge variant="primary">Hitung awal</Badge>
                              ) : item.jenis === 'keluar' ? (
                                <Badge variant="warning">Keluar</Badge>
                              ) : (
                                <Badge variant="secondary">Koreksi</Badge>
                              )}
                            </td>
                            <td style={{ textAlign: 'right' }}>
                              {isBaseline ? (
                                // Butir 17: item baseline menampilkan koreksinya, bukan keluar
                                <span style={{ fontWeight: 600, color: '#2563EB' }}>
                                  {item.koreksi >= 0 ? `+${item.koreksi}` : item.koreksi} {item.unit}
                                </span>
                              ) : item.jenis === 'keluar' ? (
                                <span style={{ fontWeight: 700, color: '#DC2626' }}>
                                  -{item.keluar} {item.unit}
                                </span>
                              ) : (
                                <span style={{ fontWeight: 600, color: '#059669' }}>
                                  {item.koreksi >= 0 ? `+${item.koreksi}` : item.koreksi} {item.unit}
                                </span>
                              )}
                            </td>
                            <td style={{ textAlign: 'center', fontSize: '13px', color: '#64748B' }}>
                              {item.hari > 0 ? `${item.hari} hari` : 'Hari ke-0'}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        </>
      )}

      {/* =========================================================================
          TAB 2: RATA-RATA KELUAR PER HARI (View v_keluar_per_hari)
          ========================================================================= */}
      {activeTab === 'average' && (
        <div className="card" style={{ overflow: 'hidden' }}>
          {/* Header Kontrol Kategori */}
          <div
            style={{
              padding: '16px 22px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              borderBottom: '1px solid #E2E8F0',
              background: '#F8FAFC'
            }}
          >
            <div>
              <h4 style={{ fontSize: '14.5px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
                Analisis Laju Penjualan / Pengeluaran Produk (30 Hari Terakhir)
              </h4>
              <p style={{ fontSize: '12.5px', color: '#64748B', margin: '3px 0 0 0' }}>
                Diambil dari riwayat stok opname untuk memprediksi kebutuhan restok harian
              </p>
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
              <select
                className="input"
                style={{ width: '180px', height: '36px' }}
                value={selectedCategory}
                onChange={(e) => setSelectedCategory(e.target.value)}
              >
                <option value="Semua">Semua Kategori</option>
                {categories.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>

              <button onClick={fetchAverage} className="btn-icon" title="Segarkan Data">
                <RefreshCw size={14} className={isLoadingAverage ? 'pulse' : ''} />
              </button>
            </div>
          </div>

          <div className="table-container">
            <table className="table">
              <thead>
                <tr>
                  <th style={{ width: '32%' }}>NAMA PRODUK</th>
                  <th style={{ width: '20%' }}>KATEGORI</th>
                  <th style={{ width: '16%', textAlign: 'right' }}>TOTAL KELUAR</th>
                  <th style={{ width: '16%', textAlign: 'right' }}>RATA-RATA / HARI</th>
                  <th style={{ width: '16%', textAlign: 'center' }}>TERAKHIR DIHITUNG</th>
                </tr>
              </thead>
              <tbody>
                {isLoadingAverage ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '48px', color: '#94A3B8' }}>
                      Memuat data analisis keluar per hari...
                    </td>
                  </tr>
                ) : averageList.length === 0 ? (
                  <tr>
                    <td colSpan={5} style={{ textAlign: 'center', padding: '48px', color: '#64748B' }}>
                      Belum ada data opname keluar untuk kategori ini.
                    </td>
                  </tr>
                ) : (
                  averageList.map((item) => (
                    <tr key={item.product_id}>
                      <td style={{ fontWeight: 600, color: '#0F172A' }}>
                        {item.product_name}
                      </td>
                      <td style={{ color: '#475569' }}>
                        {item.category}
                      </td>
                      <td style={{ textAlign: 'right', fontWeight: 600, color: '#0F172A' }}>
                        {item.total_keluar} {item.unit}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        <span style={{ fontWeight: 700, color: '#2563EB' }}>
                          {item.rata_per_hari.toFixed(1)} {item.unit}
                        </span>
                        <span style={{ fontSize: '11px', color: '#64748B', display: 'block' }}>
                          per hari ({item.total_hari} hari)
                        </span>
                      </td>
                      <td style={{ textAlign: 'center', fontSize: '13px', color: '#475569' }}>
                        {item.terakhir_dihitung ? formatDateTime(item.terakhir_dihitung) : 'Belum pernah'}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </DashboardLayout>
  );
}
