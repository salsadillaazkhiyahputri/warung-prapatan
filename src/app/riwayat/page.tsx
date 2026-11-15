'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Transaction, Product, Supplier, TransactionType } from '@/types';
import { formatDateTime } from '@/lib/export-utils';
import { getTransactionLabel } from '@/lib/validate';
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
  AlertCircle,
  ChevronDown,
  AlertTriangle
} from 'lucide-react';

export default function RiwayatPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Filters state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('all');
  const [selectedType, setSelectedType] = useState<'all' | TransactionType>('all');
  const [filterError, setFilterError] = useState('');

  // Export state
  const [isExportDropdownOpen, setIsExportDropdownOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Manual Transaction Modal state
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [manualForm, setManualForm] = useState({
    product_id: '',
    type: 'in' as TransactionType,
    qty: 1,
    supplier_id: '',
    note: '',
    idem_key: ''
  });
  const [manualError, setManualError] = useState('');
  const [isSavingManual, setIsSavingManual] = useState(false);

  // Soft Confirmation Modal for New Pair (fn_pair_baru)
  const [isNewPairModalOpen, setIsNewPairModalOpen] = useState(false);
  const [newPairMessage, setNewPairMessage] = useState('');

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

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/suppliers');
      if (res.ok) {
        const data = await res.json();
        setSuppliers(data);
      }
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    }
  };

  const fetchTransactions = async () => {
    setFilterError('');
    setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (selectedProductId !== 'all') params.append('productId', selectedProductId);
      if (selectedType !== 'all') params.append('type', selectedType);

      const res = await fetch(`/api/transactions?${params.toString()}`);
      const data = await res.json();

      if (!res.ok) {
        setFilterError(data.error || 'Gagal mengambil riwayat transaksi');
        setTransactions([]);
        return;
      }

      setTransactions(data);
    } catch (err) {
      console.error('Error fetching transactions:', err);
      setFilterError('Terjadi kesalahan koneksi server');
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchSuppliers();
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
    setFilterError('');
  };

  // Handle Export File
  const handleExportSubmit = async (format: 'xlsx' | 'pdf') => {
    setIsExporting(true);
    setIsExportDropdownOpen(false);
    try {
      const params = new URLSearchParams();
      params.append('format', format);
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (selectedProductId !== 'all') params.append('productId', selectedProductId);
      if (selectedType !== 'all') params.append('type', selectedType);

      const res = await fetch(`/api/transactions/export?${params.toString()}`);
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new Error(errData.error || 'Gagal mengunduh laporan');
      }

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Laporan-Transaksi-${new Date().toISOString().split('T')[0]}.${format}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);

      showToast(`Laporan ${format.toUpperCase()} berhasil diunduh`);
    } catch (err: any) {
      console.error('Gagal mengunduh:', err);
      alert(err.message || 'Gagal mengunduh file laporan');
    } finally {
      setIsExporting(false);
    }
  };

  // Open Manual Transaction Modal: generate fresh idempotency key
  const openManualModal = (type: TransactionType = 'in') => {
    const firstSupplier = suppliers.find(s => !s.is_adjustment) || suppliers[0];
    const uuid = 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = (Math.random() * 16) | 0;
      const v = c === 'x' ? r : (r & 0x3) | 0x8;
      return v.toString(16);
    });

    setManualForm({
      product_id: products[0]?.id ? String(products[0].id) : '',
      type,
      qty: 1,
      supplier_id: firstSupplier ? String(firstSupplier.id) : '',
      note: '',
      idem_key: `web:${uuid}`
    });
    setManualError('');
    setIsManualModalOpen(true);
  };

  // Submit Manual Transaction
  const executeSubmit = async (confirmNewPair = false) => {
    setManualError('');

    if (!manualForm.product_id) {
      setManualError('Pilih produk terlebih dahulu');
      return;
    }

    if (manualForm.type === 'in' && !manualForm.supplier_id) {
      setManualError('Pilih supplier untuk transaksi stok masuk');
      return;
    }

    if (manualForm.type === 'out' && (!manualForm.note || manualForm.note.trim().length < 3)) {
      setManualError('Alasan barang keluar wajib diisi minimal 3 karakter (misal: barang rusak atau hilang)');
      return;
    }

    setIsSavingManual(true);
    try {
      const payload: Record<string, any> = {
        product_id: parseInt(manualForm.product_id, 10),
        type: manualForm.type,
        qty: manualForm.qty,
        idem_key: manualForm.idem_key,
        note: manualForm.note.trim() || null
      };

      if (manualForm.type === 'in') {
        payload.supplier_id = parseInt(manualForm.supplier_id, 10);
      }

      if (confirmNewPair) {
        payload.confirm_new_pair = true;
      }

      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (res.status === 409 && data.need_confirmation) {
        // Tampilkan dialog konfirmasi peringatan lunak
        setNewPairMessage(data.message);
        setIsNewPairModalOpen(true);
        setIsSavingManual(false);
        return;
      }

      if (!res.ok) {
        setManualError(data.error || 'Gagal mencatat transaksi');
        setIsSavingManual(false);
        return;
      }

      setIsNewPairModalOpen(false);
      setIsManualModalOpen(false);
      showToast(data.message || 'Transaksi berhasil dicatat');
      fetchTransactions();
      fetchProducts();
    } catch {
      setManualError('Terjadi kesalahan pada server');
    } finally {
      setIsSavingManual(false);
    }
  };

  const handleManualFormSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    executeSubmit(false);
  };

  const handleConfirmNewPair = () => {
    executeSubmit(true);
  };

  const getJenisBadgeUI = (type: string, source: string) => {
    const label = getTransactionLabel(type, source);
    if (type === 'in') {
      if (source === 'opname') {
        return <Badge variant="primary">{label}</Badge>;
      }
      return <Badge variant="success">{label}</Badge>;
    } else {
      if (source === 'opname') {
        return <Badge variant="warning">{label}</Badge>;
      }
      return <Badge variant="danger">{label}</Badge>;
    }
  };

  // Kelompokkan supplier untuk dropdown stok masuk
  const suppliersUtama = suppliers.filter(s => !s.is_adjustment && s.jenis === 'utama');
  const suppliersCadangan = suppliers.filter(s => !s.is_adjustment && s.jenis === 'cadangan');
  const suppliersGrosir = suppliers.filter(s => !s.is_adjustment && s.jenis === 'grosir');
  const suppliersSistem = suppliers.filter(s => s.is_adjustment);

  return (
    <DashboardLayout
      title="Riwayat Transaksi Stok"
      subtitle="Catatan aktivitas keluar masuk barang toko, baik secara manual maupun dari stok opname"
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
            fontSize: '13.5px',
            fontWeight: 600,
            animation: 'fadeIn 0.15s ease'
          }}
        >
          <CheckCircle2 size={17} style={{ color: '#059669' }} />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Action Header: Counter, Refresh, Catat Manual, Ekspor */}
      <div className="page-header-box" style={{ marginBottom: '18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <div
            style={{
              padding: '6px 14px',
              borderRadius: 'var(--radius-full)',
              background: '#FFFFFF',
              border: '1px solid #E2E8F0',
              fontSize: '13px',
              fontWeight: 600,
              color: '#0F172A',
              boxShadow: 'var(--shadow-xs)'
            }}
          >
            Total <strong style={{ color: '#0F172A' }}>{transactions.length}</strong> Catatan
          </div>

          <button onClick={fetchTransactions} className="btn btn-secondary btn-sm" title="Segarkan Data">
            <RefreshCw size={14} className={isLoading ? 'pulse' : ''} />
            <span>Segarkan</span>
          </button>
        </div>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', position: 'relative' }}>
          <button onClick={() => openManualModal('in')} className="btn btn-secondary btn-sm">
            <PlusCircle size={15} />
            <span>Catat Manual</span>
          </button>

          {/* Tombol Ekspor dengan Dropdown Modern */}
          <div style={{ position: 'relative' }}>
            <button
              onClick={() => setIsExportDropdownOpen(!isExportDropdownOpen)}
              className="btn btn-primary btn-sm"
              disabled={isExporting}
            >
              <Download size={15} />
              <span>{isExporting ? 'Mengunduh...' : 'Ekspor Laporan'}</span>
              <ChevronDown size={14} />
            </button>

            {isExportDropdownOpen && (
              <div
                style={{
                  position: 'absolute',
                  top: '100%',
                  right: 0,
                  marginTop: '6px',
                  background: '#FFFFFF',
                  border: '1px solid #E2E8F0',
                  borderRadius: 'var(--radius-md)',
                  boxShadow: 'var(--shadow-lg)',
                  zIndex: 50,
                  minWidth: '180px',
                  padding: '6px'
                }}
              >
                <button
                  onClick={() => handleExportSubmit('xlsx')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '9px',
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    color: '#0F172A',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                  className="dropdown-item"
                >
                  <FileSpreadsheet size={16} style={{ color: '#059669' }} />
                  <span>Ekspor Excel (.xlsx)</span>
                </button>

                <button
                  onClick={() => handleExportSubmit('pdf')}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '9px',
                    width: '100%',
                    padding: '8px 12px',
                    fontSize: '13px',
                    color: '#0F172A',
                    background: 'transparent',
                    border: 'none',
                    borderRadius: 'var(--radius-sm)',
                    cursor: 'pointer',
                    textAlign: 'left'
                  }}
                  className="dropdown-item"
                >
                  <FileText size={16} style={{ color: '#DC2626' }} />
                  <span>Ekspor PDF (.pdf)</span>
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Filter Box: Tanggal WIB, Produk, Jenis */}
      <div className="card" style={{ padding: '18px 22px', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '14px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
            <Filter size={16} style={{ color: '#0F172A' }} />
            <h3 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', margin: 0 }}>
              Filter Riwayat Transaksi
            </h3>
          </div>

          {(startDate || endDate || selectedProductId !== 'all' || selectedType !== 'all') && (
            <button
              onClick={handleResetFilter}
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: '5px',
                fontSize: '12.5px',
                color: '#64748B',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer'
              }}
            >
              <RotateCcw size={13} />
              <span>Reset Filter</span>
            </button>
          )}
        </div>

        {filterError && (
          <div className="alert alert-danger" style={{ marginBottom: '14px' }}>
            <AlertCircle size={15} />
            <span>{filterError}</span>
          </div>
        )}

        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
            gap: '14px'
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

          <div>
            <label className="form-label" style={{ fontSize: '12px' }}>
              Jenis Transaksi
            </label>
            <select
              className="input"
              value={selectedType}
              onChange={(e) => setSelectedType(e.target.value as any)}
            >
              <option value="all">Semua Jenis</option>
              <option value="in">Barang Masuk (in)</option>
              <option value="out">Barang Keluar (out)</option>
            </select>
          </div>
        </div>
      </div>

      {/* Tabel Riwayat: TANGGAL & WAKTU | JENIS | PRODUK | JUMLAH | SUPPLIER / CATATAN */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '22%' }}>TANGGAL & WAKTU</th>
                <th style={{ width: '18%' }}>JENIS</th>
                <th style={{ width: '26%' }}>PRODUK</th>
                <th style={{ width: '14%' }}>JUMLAH</th>
                <th style={{ width: '20%' }}>SUPPLIER / CATATAN</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '48px', color: '#94A3B8' }}>
                    Memuat catatan transaksi...
                  </td>
                </tr>
              ) : transactions.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '48px', color: '#64748B' }}>
                    Tidak ada transaksi pada filter yang dipilih.
                  </td>
                </tr>
              ) : (
                transactions.map((t) => {
                  const isIn = t.type === 'in';

                  return (
                    <tr key={t.id}>
                      <td style={{ fontSize: '13px', color: '#475569' }}>
                        {t.tanggal_wib || formatDateTime(t.created_at)}
                      </td>
                      <td>
                        {getJenisBadgeUI(t.type, t.source)}
                      </td>
                      <td style={{ fontWeight: 600, color: '#0F172A' }}>
                        <div>{t.product_name || `Produk #${t.product_id}`}</div>
                        {t.category && (
                          <span style={{ fontSize: '11.5px', color: '#64748B', fontWeight: 400 }}>
                            {t.category}
                          </span>
                        )}
                      </td>
                      <td>
                        <span
                          style={{
                            fontWeight: 700,
                            color: isIn ? '#059669' : '#DC2626'
                          }}
                        >
                          {isIn ? `+${t.qty} pcs` : `-${t.qty} pcs`}
                        </span>
                      </td>
                      <td style={{ fontSize: '13px', color: '#334155' }}>
                        {isIn ? (
                          <div>
                            <span style={{ fontWeight: 500 }}>{t.supplier_name || '—'}</span>
                            {t.note && (
                              <p style={{ margin: '2px 0 0', fontSize: '11.5px', color: '#64748B', fontStyle: 'italic' }}>
                                {t.note}
                              </p>
                            )}
                          </div>
                        ) : (
                          <div>
                            <span>{t.note || (t.source === 'opname' ? 'Stok opname' : 'Barang keluar')}</span>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Catat Transaksi Manual (Masuk / Keluar) */}
      <Modal
        isOpen={isManualModalOpen}
        onClose={() => setIsManualModalOpen(false)}
        title={manualForm.type === 'in' ? 'Catat Stok Masuk Manual' : 'Catat Stok Keluar Manual'}
        subtitle={
          manualForm.type === 'in'
            ? 'Catat penerimaan barang masuk dari supplier ke inventaris toko'
            : 'Catat pengurangan stok barang akibat rusak, kedaluwarsa, atau hilang'
        }
      >
        <form onSubmit={handleManualFormSubmit}>
          {manualError && (
            <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
              <AlertCircle size={16} />
              <span>{manualError}</span>
            </div>
          )}

          {/* Tab Pilihan Tipe: Masuk vs Keluar */}
          <div
            style={{
              display: 'flex',
              background: '#F1F5F9',
              padding: '4px',
              borderRadius: 'var(--radius-md)',
              marginBottom: '18px'
            }}
          >
            <button
              type="button"
              onClick={() => setManualForm({ ...manualForm, type: 'in' })}
              style={{
                flex: 1,
                padding: '8px',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                fontWeight: manualForm.type === 'in' ? 700 : 500,
                color: manualForm.type === 'in' ? '#0F172A' : '#64748B',
                background: manualForm.type === 'in' ? '#FFFFFF' : 'transparent',
                boxShadow: manualForm.type === 'in' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer'
              }}
            >
              Stok Masuk
            </button>
            <button
              type="button"
              onClick={() => setManualForm({ ...manualForm, type: 'out' })}
              style={{
                flex: 1,
                padding: '8px',
                border: 'none',
                borderRadius: 'var(--radius-sm)',
                fontSize: '13px',
                fontWeight: manualForm.type === 'out' ? 700 : 500,
                color: manualForm.type === 'out' ? '#0F172A' : '#64748B',
                background: manualForm.type === 'out' ? '#FFFFFF' : 'transparent',
                boxShadow: manualForm.type === 'out' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                cursor: 'pointer'
              }}
            >
              Stok Keluar (Rusak/Hilang)
            </button>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="manual-prod">
              Pilih Produk <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <select
              id="manual-prod"
              className="input"
              value={manualForm.product_id}
              onChange={(e) => setManualForm({ ...manualForm, product_id: e.target.value })}
              required
            >
              {products.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name} (Stok: {p.stock_current} pcs)
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="manual-qty">
              Jumlah Barang (pcs) <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input
              id="manual-qty"
              type="number"
              className="input"
              min={1}
              max={100000}
              value={manualForm.qty}
              onChange={(e) => setManualForm({ ...manualForm, qty: parseInt(e.target.value, 10) || 1 })}
              required
            />
          </div>

          {/* Supplier (Hanya untuk Stok Masuk, dikelompokkan per jenis) */}
          {manualForm.type === 'in' && (
            <div className="form-group">
              <label className="form-label" htmlFor="manual-sup">
                Supplier Pengirim <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <select
                id="manual-sup"
                className="input"
                value={manualForm.supplier_id}
                onChange={(e) => setManualForm({ ...manualForm, supplier_id: e.target.value })}
                required
              >
                {suppliersUtama.length > 0 && (
                  <optgroup label="Supplier Utama">
                    {suppliersUtama.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {suppliersCadangan.length > 0 && (
                  <optgroup label="Supplier Cadangan">
                    {suppliersCadangan.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {suppliersGrosir.length > 0 && (
                  <optgroup label="Supplier Grosir">
                    {suppliersGrosir.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                )}
                {suppliersSistem.length > 0 && (
                  <optgroup label="Sistem">
                    {suppliersSistem.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </optgroup>
                )}
              </select>
            </div>
          )}

          {/* Alasan / Catatan */}
          <div className="form-group">
            <label className="form-label" htmlFor="manual-note">
              {manualForm.type === 'in' ? 'Catatan (Opsional)' : 'Alasan Barang Keluar (Wajib, min 3 karakter)'}{' '}
              {manualForm.type === 'out' && <span style={{ color: '#DC2626' }}>*</span>}
            </label>
            <input
              id="manual-note"
              type="text"
              className="input"
              placeholder={
                manualForm.type === 'in'
                  ? 'Contoh: Restok mingguan'
                  : 'Contoh: Kemasan bocor saat pengangkutan'
              }
              value={manualForm.note}
              onChange={(e) => setManualForm({ ...manualForm, note: e.target.value })}
              maxLength={200}
              required={manualForm.type === 'out'}
            />
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
            <button
              type="button"
              onClick={() => setIsManualModalOpen(false)}
              className="btn btn-secondary"
              disabled={isSavingManual}
            >
              Batal
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSavingManual}>
              {isSavingManual ? 'Menyimpan...' : 'Simpan Transaksi'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Peringatan Lunak: Pasangan Baru fn_pair_baru */}
      <Modal
        isOpen={isNewPairModalOpen}
        onClose={() => setIsNewPairModalOpen(false)}
        title="Peringatan Supplier Baru"
        subtitle="Konfirmasi penerimaan barang dari supplier yang belum pernah tercatat sebelumnya"
      >
        <div style={{ display: 'flex', gap: '14px', alignItems: 'flex-start', padding: '6px 0' }}>
          <div
            style={{
              width: '40px',
              height: '40px',
              borderRadius: '50%',
              background: '#FEF3C7',
              color: '#D97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <AlertTriangle size={20} />
          </div>
          <div>
            <p style={{ fontSize: '14px', color: '#1E293B', lineHeight: 1.6, margin: 0, fontWeight: 500 }}>
              {newPairMessage}
            </p>
            <p style={{ fontSize: '12.5px', color: '#64748B', marginTop: '6px', margin: 0 }}>
              Produk ini sebelumnya tercatat masuk dari supplier lain. Apakah Anda yakin ingin melanjutkan pencatatan stok masuk dari supplier ini?
            </p>
          </div>
        </div>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
          <button
            type="button"
            onClick={() => setIsNewPairModalOpen(false)}
            className="btn btn-secondary"
            disabled={isSavingManual}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleConfirmNewPair}
            className="btn btn-primary"
            disabled={isSavingManual}
          >
            {isSavingManual ? 'Menyimpan...' : 'Lanjutkan'}
          </button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
