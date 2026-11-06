'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Transaction, Product, TransactionType } from '@/types';
import { formatDateTime } from '@/lib/export-utils';
import {
  Download,
  Calendar,
  Filter,
  FileSpreadsheet,
  FileText,
  RotateCcw,
  RefreshCw,
  PlusCircle,
  Receipt,
  CheckCircle2,
  AlertCircle
} from 'lucide-react';

export default function RiwayatPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('all');
  const [selectedType, setSelectedType] = useState<'all' | TransactionType>('all');

  // Export Modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Manual Transaction Modal state
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    product_id: '',
    type: 'in' as TransactionType,
    qty: 1,
    unit_mode: 'pcs',
    supplier_name: 'Unilever',
    note: ''
  });
  const [manualError, setManualError] = useState('');

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  const fetchTransactions = async () => {
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
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    fetchTransactions();
  }, [startDate, endDate, selectedProductId, selectedType]);

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

  // Handle Export File
  const handleExportSubmit = async (format: 'xlsx' | 'pdf') => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      params.append('format', format);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (selectedProductId !== 'all') params.append('productId', selectedProductId);
      if (selectedType !== 'all') params.append('type', selectedType);

      const res = await fetch(`/api/transactions/export?${params.toString()}`);
      if (!res.ok) throw new Error('Gagal mengunduh laporan');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Laporan-Transaksi-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      setIsExportModalOpen(false);
      showToast(`Laporan ${format.toUpperCase()} berhasil diunduh`);
    } catch (err) {
      console.error('Gagal mengunduh:', err);
      alert('Gagal mengunduh file laporan');
    } finally {
      setIsExporting(false);
    }
  };

  // Handle Manual Transaction Submit
  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setManualError('');

    if (!manualForm.product_id) {
      setManualError('Pilih produk terlebih dahulu');
      return;
    }

    const prod = products.find(p => p.id === parseInt(manualForm.product_id, 10));
    if (!prod) return;

    let totalQty = manualForm.qty;
    let finalNote = manualForm.note;
    if (manualForm.unit_mode === 'karton') {
      if (!prod.qty_per_karton) {
        setManualError(`Produk ini tidak menggunakan karton. Gunakan satuan ${prod.unit}.`);
        return;
      }
      totalQty = manualForm.qty * prod.qty_per_karton;
      finalNote = `${manualForm.qty} karton (${totalQty} ${prod.unit})${finalNote ? ` - ${finalNote}` : ''}`;
    }

    try {
      if (manualForm.type === 'in') {
        const supplierRes = await fetch('/api/suppliers', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: manualForm.supplier_name })
        });
        const supplierData = await supplierRes.json();
        if (!supplierRes.ok) {
          setManualError(supplierData.error || 'Gagal menyimpan supplier');
          return;
        }

        const transactionRes = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product_id: prod.id,
            type: manualForm.type,
            qty: totalQty,
            supplier_id: supplierData.id,
            note: finalNote || null
          })
        });
        const transactionData = await transactionRes.json();
        if (!transactionRes.ok) {
          setManualError(transactionData.error || 'Gagal menyimpan transaksi');
          return;
        }
      } else {
        const transactionRes = await fetch('/api/transactions', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            product_id: prod.id,
            type: manualForm.type,
            qty: totalQty,
            note: finalNote || null
          })
        });
        const transactionData = await transactionRes.json();
        if (!transactionRes.ok) {
          setManualError(transactionData.error || 'Gagal menyimpan transaksi');
          return;
        }
      }

      setIsManualModalOpen(false);
      showToast('Transaksi manual berhasil dicatat');
      fetchTransactions();
      fetchProducts();
    } catch {
      setManualError('Terjadi kesalahan pada server');
    }
  };

  return (
    <DashboardLayout
      title="Riwayat Transaksi Stok"
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

      {/* Top Header Controls: Filter & Export */}
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
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={() => setIsManualModalOpen(true)}
            className="btn btn-secondary btn-sm"
          >
            <PlusCircle size={15} />
            <span>Catat Manual</span>
          </button>

          <button
            onClick={() => setIsExportModalOpen(true)}
            className="btn btn-primary btn-sm"
          >
            <Download size={15} />
            <span>Ekspor Laporan</span>
          </button>
        </div>
      </div>

      {/* Spacious Modern Filter Card */}
      <div
        style={{
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 'var(--radius-lg)',
          padding: '22px 24px',
          marginBottom: '24px',
          boxShadow: 'var(--shadow-card)'
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: '16px',
            paddingBottom: '14px',
            borderBottom: '1px solid #F1F5F9'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={15} style={{ color: '#0F172A' }} />
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
              Filter Riwayat Transaksi
            </h4>
          </div>

          {(startDate || endDate || selectedProductId !== 'all' || selectedType !== 'all') && (
            <button
              onClick={handleResetFilter}
              className="btn btn-secondary btn-sm"
              style={{ height: '30px', fontSize: '12px', padding: '0 12px' }}
            >
              <RotateCcw size={12} />
              <span>Reset Filter</span>
            </button>
          )}
        </div>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(210px, 1fr))',
            gap: '16px'
          }}
        >
          {/* Dari Tanggal (DD/MM/YYYY) */}
          <div>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              <Calendar size={13} style={{ color: '#64748B' }} />
              <span>Dari Tanggal</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                readOnly
                placeholder="dd/mm/yyyy"
                value={startDate ? (() => {
                  const [y, m, d] = startDate.split('-');
                  return `${d}/${m}/${y}`;
                })() : ''}
                className="form-input"
                style={{ paddingRight: '38px', cursor: 'pointer', background: '#FFFFFF', height: '38px', fontSize: '13px' }}
                onClick={(e) => {
                  const dateInput = e.currentTarget.nextElementSibling as HTMLInputElement;
                  if (dateInput) {
                    if (typeof dateInput.showPicker === 'function') dateInput.showPicker();
                    else dateInput.focus();
                  }
                }}
              />
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                style={{
                  position: 'absolute',
                  right: '6px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  opacity: 0,
                  width: '28px',
                  height: '28px',
                  cursor: 'pointer'
                }}
              />
              <Calendar
                size={15}
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

          {/* Sampai Tanggal (DD/MM/YYYY) */}
          <div>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              <Calendar size={13} style={{ color: '#64748B' }} />
              <span>Sampai Tanggal</span>
            </label>
            <div style={{ position: 'relative' }}>
              <input
                type="text"
                readOnly
                placeholder="dd/mm/yyyy"
                value={endDate ? (() => {
                  const [y, m, d] = endDate.split('-');
                  return `${d}/${m}/${y}`;
                })() : ''}
                className="form-input"
                style={{ paddingRight: '38px', cursor: 'pointer', background: '#FFFFFF', height: '38px', fontSize: '13px' }}
                onClick={(e) => {
                  const dateInput = e.currentTarget.nextElementSibling as HTMLInputElement;
                  if (dateInput) {
                    if (typeof dateInput.showPicker === 'function') dateInput.showPicker();
                    else dateInput.focus();
                  }
                }}
              />
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
                style={{
                  position: 'absolute',
                  right: '6px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  opacity: 0,
                  width: '28px',
                  height: '28px',
                  cursor: 'pointer'
                }}
              />
              <Calendar
                size={15}
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

          {/* Filter Produk */}
          <div>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              <Filter size={13} style={{ color: '#64748B' }} />
              <span>Filter Produk</span>
            </label>
            <select
              className="form-select"
              style={{ height: '38px', fontSize: '13px' }}
              value={selectedProductId}
              onChange={(e) => setSelectedProductId(e.target.value)}
            >
              <option value="all">Semua Produk</option>
              {products.map((p) => (
                <option key={p.id} value={p.id.toString()}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* Jenis Transaksi */}
          <div>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px' }}>
              <Filter size={13} style={{ color: '#64748B' }} />
              <span>Jenis Transaksi</span>
            </label>
            <select
              className="form-select"
              style={{ height: '38px', fontSize: '13px' }}
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as 'all' | TransactionType)}
            >
              <option value="all">Semua Jenis</option>
              <option value="in">Stok Masuk (+)</option>
              <option value="out">Stok Keluar (-)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabel Riwayat Transaksi */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '18%' }}>Tanggal & Waktu</th>
              <th style={{ width: '12%' }}>Jenis</th>
              <th style={{ width: '28%' }}>Produk</th>
              <th style={{ width: '14%', textAlign: 'right' }}>Jumlah</th>
              <th style={{ width: '28%' }}>Supplier / Catatan</th>
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
                    <td style={{ color: '#475569', fontSize: '13px' }}>
                      {formatDateTime(tx.created_at)}
                    </td>
                    <td>
                      <Badge type={isIn ? 'in' : 'out'}>
                        {isIn ? 'Masuk (+)' : 'Keluar (-)'}
                      </Badge>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '13.5px' }}>
                        {tx.product?.name || `Produk #${tx.product_id}`}
                      </span>
                    </td>
                    <td style={{ textAlign: 'right' }}>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: '13.5px',
                          color: isIn ? '#059669' : '#DC2626'
                        }}
                      >
                        {isIn ? '+' : '-'}{tx.qty} {tx.product?.unit || 'pcs'}
                      </span>
                    </td>
                    <td>
                      <div style={{ color: '#475569', fontSize: '13px' }}>
                        {tx.supplier?.name ? (
                          <span style={{ fontWeight: 500, color: '#0F172A' }}>
                            {tx.supplier.name}
                          </span>
                        ) : tx.note ? (
                          <span>{tx.note}</span>
                        ) : (
                          <span style={{ color: '#94A3B8' }}>-</span>
                        )}
                        {tx.supplier?.name && tx.note && (
                          <span style={{ color: '#94A3B8', marginLeft: '6px' }}>
                            ({tx.note})
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Ekspor Laporan */}
      <Modal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title="Ekspor Laporan Transaksi"
        maxWidth="440px"
      >
        <div style={{ padding: '4px 0 16px' }}>
          <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '16px', lineHeight: 1.45 }}>
            Unduh laporan transaksi sesuai filter tanggal dan produk yang sedang dipilih:
          </p>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
            <button
              onClick={() => handleExportSubmit('xlsx')}
              disabled={isExporting}
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
              onClick={() => handleExportSubmit('pdf')}
              disabled={isExporting}
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
                <span style={{ fontSize: '11.5px', color: '#64748B' }}>Format cetak siap pakai</span>
              </div>
            </button>
          </div>

          {isExporting && (
            <p style={{ fontSize: '12px', color: '#0F172A', textAlign: 'center', marginTop: '12px' }}>
              Sedang memproses laporan...
            </p>
          )}
        </div>
      </Modal>

      {/* Modal Catat Transaksi Manual */}
      <Modal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        title="Catat Transaksi Manual"
        maxWidth="480px"
      >
        <form onSubmit={handleManualSubmit}>
          {manualError && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '10px 14px',
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: 'var(--radius-sm)',
                color: '#DC2626',
                fontSize: '13px',
                marginBottom: '16px'
              }}
            >
              <AlertCircle size={16} />
              <span>{manualError}</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Jenis Transaksi *</label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
              <button
                type="button"
                onClick={() => setManualForm({ ...manualForm, type: 'in' })}
                style={{
                  padding: '9px',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 600,
                  fontSize: '13px',
                  background: manualForm.type === 'in' ? '#ECFDF5' : '#FFFFFF',
                  color: manualForm.type === 'in' ? '#065F46' : '#475569',
                  border: `1px solid ${manualForm.type === 'in' ? '#A7F3D0' : '#D1D5DB'}`,
                  cursor: 'pointer'
                }}
              >
                Stok Masuk (+)
              </button>
              <button
                type="button"
                onClick={() => setManualForm({ ...manualForm, type: 'out' })}
                style={{
                  padding: '9px',
                  borderRadius: 'var(--radius-md)',
                  fontWeight: 600,
                  fontSize: '13px',
                  background: manualForm.type === 'out' ? '#FEF2F2' : '#FFFFFF',
                  color: manualForm.type === 'out' ? '#991B1B' : '#475569',
                  border: `1px solid ${manualForm.type === 'out' ? '#FECACA' : '#D1D5DB'}`,
                  cursor: 'pointer'
                }}
              >
                Stok Keluar (-)
              </button>
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Pilih Produk *</label>
            <select
              className="form-select"
              value={manualForm.product_id}
              onChange={(e) => setManualForm({ ...manualForm, product_id: e.target.value })}
              required
            >
              <option value="">-- Pilih Produk --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id.toString()}>
                  {p.name} (Stok: {p.stock_current} {p.unit})
                </option>
              ))}
            </select>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            <div className="form-group">
              <label className="form-label">Jumlah *</label>
              <input
                type="number"
                min={1}
                className="form-input"
                value={manualForm.qty}
                onChange={(e) => setManualForm({ ...manualForm, qty: parseInt(e.target.value, 10) || 1 })}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Satuan Input *</label>
              <select
                className="form-select"
                value={manualForm.unit_mode}
                onChange={(e) => setManualForm({ ...manualForm, unit_mode: e.target.value })}
              >
                <option value="pcs">Satuan Eceran (pcs)</option>
                <option value="karton">Karton / Dus</option>
              </select>
            </div>
          </div>

          {manualForm.type === 'in' && (
            <div className="form-group">
              <label className="form-label">Nama Supplier *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Contoh: Unilever"
                value={manualForm.supplier_name}
                onChange={(e) => setManualForm({ ...manualForm, supplier_name: e.target.value })}
                required
              />
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Catatan Tambahan (Opsional)</label>
            <input
              type="text"
              className="form-input"
              placeholder="Keterangan singkat..."
              value={manualForm.note}
              onChange={(e) => setManualForm({ ...manualForm, note: e.target.value })}
            />
          </div>

          <div
            style={{
              display: 'flex',
              justifyContent: 'flex-end',
              gap: '10px',
              marginTop: '20px',
              paddingTop: '16px',
              borderTop: '1px solid #E2E8F0'
            }}
          >
            <button
              type="button"
              className="btn btn-secondary"
              onClick={() => setIsManualModalOpen(false)}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn btn-primary"
            >
              Simpan Transaksi
            </button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
