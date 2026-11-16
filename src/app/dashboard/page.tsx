'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { StatCard } from '@/components/ui/StatCard';
import { Badge } from '@/components/ui/Badge';
import { DashboardStats } from '@/types';
import { getClientCache, setClientCache } from '@/lib/client-cache';
import {
  Package,
  ClipboardCheck,
  AlertTriangle,
  ArrowRight,
  Plus,
  RefreshCw,
  CheckCircle2,
  PackagePlus
} from 'lucide-react';

export default function DashboardPage() {
  const [stats, setStats] = useState<DashboardStats | null>(() => {
    return getClientCache<DashboardStats>('dashboard:stats') || null;
  });
  const [isLoading, setIsLoading] = useState(() => {
    return !getClientCache<DashboardStats>('dashboard:stats');
  });

  const fetchStats = async () => {
    if (!stats) setIsLoading(true);
    try {
      const res = await fetch('/api/dashboard/stats');
      if (res.ok) {
        const data = await res.json();
        setStats(data);
        setClientCache('dashboard:stats', data);
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

  return (
    <DashboardLayout
      title="Dashboard Utama"
      subtitle="Ringkasan ketersediaan stok barang dan transaksi toko"
    >
      {/* Action Header */}
      <div className="page-header-box" style={{ marginBottom: '20px' }}>
        <div>
          <p style={{ fontSize: '13px', color: '#64748B' }}>
            Pantau pergerakan stok toko secara langsung
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

      {/* Barang baru dari bot yang belum dilengkapi. Disembunyikan bila 0. */}
      {!isLoading && (stats?.needs_review_count ?? 0) > 0 && (
        <Link
          href="/produk?filter=perlu-dilengkapi"
          className="hover-link"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: '10px',
            padding: '10px 16px',
            marginBottom: '18px',
            background: '#FFFBEB',
            border: '1px solid #FDE68A',
            borderRadius: 'var(--radius-md)',
            color: '#92400E',
            fontSize: '13px',
            fontWeight: 600
          }}
        >
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
            <PackagePlus size={16} />
            {stats!.needs_review_count} barang perlu dilengkapi
            <span style={{ fontWeight: 400, color: '#B45309' }}>· didaftarkan lewat bot, kategori dan minimum belum diatur</span>
          </span>
          <ArrowRight size={14} />
        </Link>
      )}

      {/* 3 Metric Summary Cards */}
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

        <Link href="/produk" style={{ display: 'block', color: 'inherit' }} title="Lihat kolom Terakhir dihitung di halaman Produk">
          <StatCard
            title="Perlu Dihitung"
            value={isLoading ? '...' : stats?.perlu_dihitung_count || 0}
            icon={<ClipboardCheck size={24} />}
            subtitle="Belum pernah atau > 14 hari tidak dihitung"
            isAlert={Boolean(stats && stats.perlu_dihitung_count > 0)}
          />
        </Link>

        <StatCard
          title="Stok Menipis"
          value={isLoading ? '...' : stats?.low_stock_count || 0}
          icon={<AlertTriangle size={24} />}
          subtitle="Segera lakukan restok"
          isAlert={Boolean(stats && stats.low_stock_count > 0)}
        />
      </div>

      {/* Tabel Produk Stok Menipis */}
      <div className="card">
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: 'var(--radius-sm)',
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                color: '#DC2626',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center'
              }}
            >
              <AlertTriangle size={18} />
            </div>
            <div>
              <h3 style={{ fontSize: '15.5px', fontWeight: 700, color: '#0F172A' }}>
                Produk Stok Menipis
              </h3>
              <p style={{ fontSize: '12px', color: '#64748B' }}>
                Barang dengan jumlah stok di bawah batas minimum
              </p>
            </div>
          </div>

          <Link
            href="/produk"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '5px',
              fontSize: '13px',
              fontWeight: 600,
              color: '#0F172A',
              transition: 'all var(--transition-fast)'
            }}
            className="hover-link"
          >
            <span>Lihat Semua Produk</span>
            <ArrowRight size={14} />
          </Link>
        </div>

        <div className="table-container">
          <table className="data-table">
            <thead>
              <tr>
                <th style={{ width: '45%' }}>Produk</th>
                <th style={{ width: '25%' }}>Kategori</th>
                <th style={{ width: '30%', textAlign: 'right' }}>Stok Saat Ini</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', padding: '32px', color: '#94A3B8' }}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                      <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid #CBD5E1', borderTopColor: '#0F172A', animation: 'spin 0.6s linear infinite' }} />
                      <span>Memuat data...</span>
                    </div>
                  </td>
                </tr>
              ) : !stats?.low_stock_products || stats.low_stock_products.length === 0 ? (
                <tr>
                  <td colSpan={3} style={{ textAlign: 'center', padding: '36px', color: '#059669' }}>
                    <CheckCircle2 size={26} style={{ margin: '0 auto 6px', display: 'block' }} />
                    <span style={{ fontWeight: 600, fontSize: '13px' }}>Semua stok dalam batas aman.</span>
                  </td>
                </tr>
              ) : (
                stats.low_stock_products.map((item) => (
                  <tr key={item.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0F172A', fontSize: '13.5px' }}>
                        {item.name}
                      </div>
                      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>
                        Batas minimum: {item.stock_minimum} pcs
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '11.5px',
                          fontWeight: 500,
                          padding: '3px 8px',
                          borderRadius: 'var(--radius-sm)',
                          background: '#F1F5F9',
                          border: '1px solid #E2E8F0',
                          color: '#334155'
                        }}
                      >
                        {item.category}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <Badge type="warning">
                        {item.stock_current} pcs
                      </Badge>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <style jsx global>{`
        .hover-link:hover {
          color: #2563EB !important;
        }
      `}</style>
    </DashboardLayout>
  );
}
