'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { DashboardStats } from '@/types';
import {
  Package,
  AlertTriangle,
  Clock,
  ArrowRight,
  Plus,
  RefreshCw,
  CheckCircle2,
  Calendar
} from 'lucide-react';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const fetchStats = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/dashboard/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
      }
    } catch (err) {
      console.error('Gagal memuat statistik:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  const formatLastCounted = (dateStr?: string | null) => {
    if (!dateStr) return 'Belum pernah';
    const diffDays = Math.floor((Date.now() - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays <= 0) return 'Hari ini';
    if (diffDays === 1) return 'Kemarin';
    return `${diffDays} hari lalu`;
  };

  return (
    <DashboardLayout
      title="Dashboard"
      subtitle="Ringkasan ketersediaan stok barang dan status opname toko"
    >
      {/* Action Header */}
      <div className="page-header-box" style={{ marginBottom: '20px' }}>
        <div>
          <p style={{ fontSize: '13.5px', color: '#64748B' }}>
            Pantau ketersediaan barang dan jadwal opname fisik toko
          </p>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={fetchStats}
            className="btn btn-secondary btn-sm"
            title="Segarkan Data"
          >
            <RefreshCw size={14} className={isLoading ? 'pulse' : ''} />
            <span>Segarkan</span>
          </button>
          <Link href="/produk" className="btn btn-primary btn-sm">
            <Plus size={15} />
            <span>Tambah Produk</span>
          </Link>
        </div>
      </div>

      {/* 3 Metric Summary Cards Sesuai Bagian 5: Total Produk, Stok Menipis, Perlu Dihitung (Tanpa Transaksi Hari Ini) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))',
          gap: '18px',
          marginBottom: '26px'
        }}
      >
        <StatCard
          title="Total Produk"
          value={isLoading ? '...' : stats?.total_products || 0}
          icon={<Package size={24} />}
          subtitle="Item aktif dalam sistem"
        />

        <StatCard
          title="Stok Menipis"
          value={isLoading ? '...' : stats?.low_stock_count || 0}
          icon={<AlertTriangle size={24} />}
          subtitle="Di bawah batas minimum"
          isAlert={Boolean(stats && stats.low_stock_count > 0)}
        />

        <StatCard
          title="Perlu Dihitung"
          value={isLoading ? '...' : stats?.needs_count_count || 0}
          icon={<Clock size={24} />}
          subtitle="Belum dihitung > 14 hari"
          isAlert={Boolean(stats && stats.needs_count_count > 0)}
        />
      </div>

      {/* 2 Kolom Daftar: Stok Menipis & Perlu Dihitung */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
          gap: '24px',
          alignItems: 'start'
        }}
      >
        {/* Kolom 1: Daftar Produk Stok Menipis */}
        <div className="card" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <AlertTriangle size={18} style={{ color: '#E11D48' }} />
                <span>Peringatan Stok Menipis</span>
              </h3>
              <p style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>
                Produk yang harus segera dipesan ulang ke supplier
              </p>
            </div>
            <Link
              href="/produk"
              style={{
                fontSize: '13px',
                color: '#0F172A',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span>Lihat Semua</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          {isLoading ? (
            <div style={{ padding: '36px', textAlign: 'center', color: '#94A3B8', fontSize: '13.5px' }}>
              Memuat data stok...
            </div>
          ) : !stats?.low_stock_products || stats.low_stock_products.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center', color: '#059669', fontSize: '13.5px', background: '#F0FDF4', borderRadius: 'var(--radius-md)' }}>
              <CheckCircle2 size={24} style={{ margin: '0 auto 8px', display: 'block' }} />
              <p style={{ fontWeight: 600, margin: 0 }}>Semua stok barang dalam kondisi aman!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {stats.low_stock_products.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid #FFE4E6',
                    background: '#FFF1F2'
                  }}
                >
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '14px', color: '#0F172A', margin: 0 }}>
                      {item.name}
                    </p>
                    <p style={{ fontSize: '12px', color: '#64748B', marginTop: '2px', margin: 0 }}>
                      Kategori: {item.category} · Batas: {item.stock_minimum} {item.unit}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '14px', fontWeight: 700, color: '#E11D48' }}>
                      {item.stock_current} {item.unit}
                    </span>
                    <Badge variant="danger" style={{ display: 'block', marginTop: '3px', fontSize: '11px' }}>
                      {item.stock_current === 0 ? 'Habis' : 'Menipis'}
                    </Badge>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Kolom 2: Daftar Produk Perlu Dihitung (Opname Fisik) */}
        <div className="card" style={{ padding: '22px' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
            <div>
              <h3 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Clock size={18} style={{ color: '#D97706' }} />
                <span>Perlu Dihitung (Opname Fisik)</span>
              </h3>
              <p style={{ fontSize: '13px', color: '#64748B', marginTop: '2px' }}>
                Produk belum pernah dihitung atau terakhir dihitung &gt; 14 hari
              </p>
            </div>
            <Link
              href="/opname"
              style={{
                fontSize: '13px',
                color: '#0F172A',
                fontWeight: 600,
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
            >
              <span>Riwayat Opname</span>
              <ArrowRight size={14} />
            </Link>
          </div>

          {isLoading ? (
            <div style={{ padding: '36px', textAlign: 'center', color: '#94A3B8', fontSize: '13.5px' }}>
              Memuat data opname...
            </div>
          ) : !stats?.needs_count_products || stats.needs_count_products.length === 0 ? (
            <div style={{ padding: '36px', textAlign: 'center', color: '#059669', fontSize: '13.5px', background: '#F0FDF4', borderRadius: 'var(--radius-md)' }}>
              <CheckCircle2 size={24} style={{ margin: '0 auto 8px', display: 'block' }} />
              <p style={{ fontWeight: 600, margin: 0 }}>Semua produk telah dihitung dalam 14 hari terakhir!</p>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {stats.needs_count_products.slice(0, 6).map((item) => (
                <div
                  key={item.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '12px 14px',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid #FEF3C7',
                    background: '#FFFBEB'
                  }}
                >
                  <div>
                    <p style={{ fontWeight: 600, fontSize: '14px', color: '#0F172A', margin: 0 }}>
                      {item.name}
                    </p>
                    <p style={{ fontSize: '12px', color: '#64748B', marginTop: '2px', margin: 0 }}>
                      Kategori: {item.category} · Stok sistem: {item.stock_current} {item.unit}
                    </p>
                  </div>
                  <div style={{ textAlign: 'right' }}>
                    <span style={{ fontSize: '12.5px', fontWeight: 600, color: '#B45309' }}>
                      {formatLastCounted(item.last_counted_at)}
                    </span>
                    <span style={{ display: 'block', fontSize: '11px', color: '#78350F', marginTop: '2px' }}>
                      Hitung via Bot Telegram
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </DashboardLayout>
  );
}
