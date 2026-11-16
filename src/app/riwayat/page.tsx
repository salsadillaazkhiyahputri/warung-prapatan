'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Transaction, Product, TransactionType } from '@/types';
import { formatDateOnly, exportTransactionsToExcel, exportTransactionsToPDF } from '@/lib/export-utils';
import {
  Download,
  Calendar,
  FileSpreadsheet,
  FileText,
  RotateCcw,
  RefreshCw,
  Receipt,
  CheckCircle2
} from 'lucide-react';

export default function RiwayatPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters state (Sesuai Wireframe Gambar 22: Rentang tanggal, Dropdown produk, Dropdown jenis)
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('all');
  const [selectedType, setSelectedType] = useState<'all' | TransactionType>('all');

  // Modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        const prodData = await res.json();
        setProducts(prodData);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  const fetchTransactions = useCallback(async () => {
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (selectedProductId !== 'all') params.append('productId', selectedProductId);
      if (selectedType !== 'all') params.append('type', selectedType);

      const res = await fetch(`/api/transactions?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
      }
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, selectedProductId, selectedType]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchProducts();
    }, 0);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchTransactions();
    }, 200);
    return () => clearTimeout(timer);
  }, [fetchTransactions]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleResetFilter = () => {
    setStartDate('');
    setEndDate('');
    setSelectedProductId('all');
    setSelectedType('all');
  };

  const isFilterActive = startDate !== '' || endDate !== '' || selectedProductId !== 'all' || selectedType !== 'all';

  // Handle Export File (Sesuai Activity Diagram Gambar 13)
  const handleExport = (format: 'xlsx' | 'pdf') => {
    const selectedProd = products.find(p => p.id.toString() === selectedProductId);
    const periodText = startDate && endDate
      ? `${startDate} s/d ${endDate}`
      : startDate
      ? `Mulai ${startDate}`
      : endDate
      ? `Sampai ${endDate}`
      : 'Semua Periode';

    const filterMeta = {
      periodText,
      productText: selectedProd ? selectedProd.name : 'Semua Produk',
      typeText: selectedType === 'in' ? 'Stok Masuk' : selectedType === 'out' ? 'Stok Keluar' : 'Semua'
    };

    if (format === 'xlsx') {
      exportTransactionsToExcel(transactions, filterMeta);
      showToast('Laporan Excel berhasil diunduh');
    } else {
      exportTransactionsToPDF(transactions, filterMeta);
      showToast('Laporan PDF berhasil diunduh');
    }
    setIsExportModalOpen(false);
  };

  return (
    <DashboardLayout
      title="Riwayat transaksi"
      subtitle="Catatan aktivitas keluar masuk barang toko"
    >
      {/* Toast Notification */}
      {toastMessage && (
        <div
          style={{
            position: 'fixed',
            top: '20px',
            right: '24px',
            zIndex: 9999,
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 18px',
            background: '#FFFFFF',
            border: '1px solid #0F172A',
            borderRadius: 'var(--radius-md)',
            boxShadow: 'var(--shadow-md)',
            color: '#0F172A',
            fontSize: '13px',
            fontWeight: 600,
            animation: 'fadeIn 0.15s ease'
          }}
        >
          <CheckCircle2 size={17} style={{ color: '#059669' }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Header Controls: Counter & Tombol Ekspor (Sesuai Proposal Gambar 22) */}
      <div className="page-header-box" style={{ marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              fontSize: '12.5px',
              fontWeight: 600,
              color: '#0F172A',
              boxShadow: 'var(--shadow-xs)'
            }}
          >
            Total <strong style={{ color: '#0F172A' }}>{transactions.length}</strong> Catatan
          </div>

          <button
            onClick={fetchTransactions}
            className="btn btn-secondary btn-sm"
            title="Segarkan Riwayat"
          >
            <RefreshCw size={14} className={isLoading ? 'pulse' : ''} />
            <span>Segarkan</span>
          </button>
        </div>

        {/* Tombol Ekspor Sesuai Gambar 22 */}
        <div>
          <button
            onClick={() => setIsExportModalOpen(true)}
            className="btn btn-primary btn-sm"
          >
            <Download size={15} />
            <span>Ekspor</span>
          </button>
        </div>
      </div>

      {/* Filter Bar (Sesuai Wireframe Gambar 22: Rentang Tanggal, Produk, Jenis) */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 'var(--radius-lg)',
          padding: '18px 20px',
          marginBottom: '22px',
          boxShadow: 'var(--shadow-card)'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '14px',
            paddingBottom: '10px',
            borderBottom: '1px solid #F1F5F9'
          }}
        >
          <h4 style={{ fontSize: '13.5px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
            Filter Riwayat
          </h4>

          {isFilterActive && (
            <button
              onClick={handleResetFilter}
              className="btn btn-secondary btn-sm"
              style={{ height: '28px', fontSize: '11.5px', padding: '0 10px' }}
            >
              <RotateCcw size={11} />
              <span>Reset Filter</span>
            </button>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '14px'
          }}
        >
          {/* Dari Tanggal */}
          <div>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#475569', marginBottom: '5px' }}>
              <Calendar size={13} style={{ color: '#64748B' }} />
              <span>Dari Tanggal</span>
            </label>
            <input
              type="date"
              className="form-input"
              style={{ height: '38px', fontSize: '13px' }}
              value={startDate}
              onChange={(e) => setStartDate(e.target.value)}
            />
          </div>

          {/* Sampai Tanggal */}
          <div>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '12px', color: '#475569', marginBottom: '5px' }}>
              <Calendar size={13} style={{ color: '#64748B' }} />
              <span>Sampai Tanggal</span>
            </label>
            <input
              type="date"
              className="form-input"
              style={{ height: '38px', fontSize: '13px' }}
              value={endDate}
              onChange={(e) => setEndDate(e.target.value)}
            />
          </div>

          {/* Dropdown Produk */}
          <div>
            <label className="form-label" style={{ fontSize: '12px', color: '#475569', marginBottom: '5px' }}>
              Produk
            </label>
            <select
              className="form-select"
              style={{ height: '38px', fontSize: '13px' }}
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
            >
              <option value="all">Semua produk</option>
              {products.map((p) => (
                <option key={p.id} value={p.id.toString()}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Dropdown Jenis Transaksi */}
          <div>
            <label className="form-label" style={{ fontSize: '12px', color: '#475569', marginBottom: '5px' }}>
              Jenis Transaksi
            </label>
            <select
              className="form-select"
              style={{ height: '38px', fontSize: '13px' }}
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as 'all' | TransactionType)}
            >
              <option value="all">Semua jenis</option>
              <option value="in">Masuk</option>
              <option value="out">Keluar</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabel Riwayat Transaksi Sesuai Proposal Gambar 22 */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '22%' }}>Tanggal</th>
              <th style={{ width: '28%' }}>Produk</th>
              <th style={{ width: '16%' }}>Jenis</th>
              <th style={{ width: '16%' }}>Jumlah</th>
              <th style={{ width: '18%' }}>Supplier</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: '#94A3B8' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid #CBD5E1', borderTopColor: '#0F172A', animation: 'spin 0.6s linear infinite' }} />
                    <span>Memuat data riwayat...</span>
                  </div>
                </td>
              </tr>
            ) : transactions.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
                  <Receipt size={32} style={{ color: '#94A3B8', margin: '0 auto 8px', display: 'block' }} />
                  <span>Tidak ada riwayat transaksi yang sesuai filter.</span>
                </td>
              </tr>
            ) : (
              transactions.map((tx) => {
                const isIn = tx.type === 'in';
                return (
                  <tr key={tx.id}>
                    <td style={{ color: '#475569', fontSize: '13.5px' }}>
                      {formatDateOnly(tx.created_at)}
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '13.5px' }}>
                        {tx.product?.name || `Produk #${tx.product_id}`}
                      </span>
                    </td>
                    <td>
                      <Badge type={isIn ? 'in' : 'out'}>
                        {isIn ? 'Masuk' : 'Keluar'}
                      </Badge>
                    </td>
                    <td style={{ fontSize: '13.5px', color: '#0F172A' }}>
                      {tx.qty} {tx.product?.unit || 'pcs'}
                    </td>
                    <td>
                      <span style={{ color: isIn ? '#0F172A' : '#94A3B8', fontWeight: isIn ? 600 : 400, fontSize: '13.5px' }}>
                        {isIn ? (tx.supplier?.name || '-') : '—'}
                      </span>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL: Ekspor Laporan (Sesuai Activity Diagram Gambar 13) */}
      <Modal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title="Ekspor Laporan Transaksi"
        maxWidth="440px"
      >
        <div style={{ padding: '4px 0 16px' }}>
          <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '16px', lineHeight: 1.45 }}>
            Unduh laporan transaksi sesuai dengan filter tanggal, produk, dan jenis yang sedang dipilih:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={() => handleExport('xlsx')}
              className="btn btn-secondary"
              style={{
                width: '100%',
                height: '46px',
                justifyContent: 'flex-start',
                padding: '0 16px',
                fontSize: '13.5px'
              }}
            >
              <FileSpreadsheet size={19} style={{ color: '#059669' }} />
              <div style={{ textAlign: 'left', marginLeft: '8px' }}>
                <span style={{ fontWeight: 600, display: 'block', color: '#0F172A' }}>Unduh Microsoft Excel (.xlsx)</span>
                <span style={{ fontSize: '11.5px', color: '#64748B' }}>Format spreadsheet lengkap</span>
              </div>
            </button>

            <button
              onClick={() => handleExport('pdf')}
              className="btn btn-secondary"
              style={{
                width: '100%',
                height: '46px',
                justifyContent: 'flex-start',
                padding: '0 16px',
                fontSize: '13.5px'
              }}
            >
              <FileText size={19} style={{ color: '#DC2626' }} />
              <div style={{ textAlign: 'left', marginLeft: '8px' }}>
                <span style={{ fontWeight: 600, display: 'block', color: '#0F172A' }}>Unduh Dokumen PDF (.pdf)</span>
                <span style={{ fontSize: '11.5px', color: '#64748B' }}>Format cetak dokumen resmi</span>
              </div>
            </button>
          </div>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
