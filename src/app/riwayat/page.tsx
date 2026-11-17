'use client';

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Badge } from '@/components/ui/Badge';
import { Modal } from '@/components/ui/Modal';
import { Pagination, usePagination } from '@/components/ui/Pagination';
import { Transaction, Product, Supplier, TransactionType, TransactionKind, SUPPLIER_JENIS } from '@/types';
import { formatDateTime } from '@/lib/export-utils';
import { SUPPLIER_JENIS_LABEL, TRANSACTION_KIND_LABEL, TRANSACTION_KINDS } from '@/lib/stock-labels';
import { getClientCache, setClientCache, invalidateClientCache } from '@/lib/client-cache';
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
  const [transactions, setTransactions] = useState<Transaction[]>(() => {
    return getClientCache<Transaction[]>('transactions:history') || [];
  });
  const [products, setProducts] = useState<Product[]>(() => {
    return getClientCache<Product[]>('products:all') || [];
  });
  const [allSuppliers, setAllSuppliers] = useState<Supplier[]>(() => {
    return getClientCache<Supplier[]>('suppliers:all') || [];
  });
  const [isLoading, setIsLoading] = useState(() => {
    return !getClientCache<Transaction[]>('transactions:history');
  });

  // Filters state
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [selectedProductId, setSelectedProductId] = useState('all');
  const [selectedKind, setSelectedKind] = useState<'all' | TransactionKind>('all');
  const transactionPagination = usePagination(
    transactions,
    10,
    `${startDate}:${endDate}:${selectedProductId}:${selectedKind}`
  );

  // Export Modal state
  const [isExportModalOpen, setIsExportModalOpen] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  // Manual Transaction Modal state
  const [isManualModalOpen, setIsManualModalOpen] = useState(false);
  const [isSavingManual, setIsSavingManual] = useState(false);
  // Satu kunci unik per pembukaan form: kirim ulang yang sama tidak akan tercatat dua kali.
  const manualKeyRef = useRef('');
  const [manualForm, setManualForm] = useState({
    product_id: '',
    type: 'in' as TransactionType,
    qty: 1,
    supplier_id: '',
    note: ''
  });
  const [manualError, setManualError] = useState('');
  // Peringatan lunak: produk + supplier yang belum pernah dipakai bersama.
  const [pairConfirm, setPairConfirm] = useState<{ productName: string; supplierName: string } | null>(null);

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/suppliers');
      if (res.ok) {
        const data = await res.json();
        setClientCache('suppliers:all', data);
        setAllSuppliers(data);
      }
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    }
  };

  // Hanya supplier AKTIF non-sistem, dikelompokkan per jenis. "Koreksi Stok" tidak ditawarkan:
  // database menolak stok masuk manual ke supplier itu (check_violation), begitu juga supplier nonaktif.
  const supplierGroups = SUPPLIER_JENIS.map((jenis) => ({
    jenis,
    items: allSuppliers.filter((x) => !x.is_adjustment && x.is_active && x.jenis === jenis)
  })).filter((g) => g.items.length > 0);

  const fetchProducts = async () => {
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        setClientCache('products:all', data);
        setProducts(data);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    }
  };

  const fetchTransactions = useCallback(async (silent = false) => {
    const isDefault = !startDate && !endDate && selectedProductId === 'all' && selectedKind === 'all';
    if (!silent) setIsLoading(true);
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (selectedProductId !== 'all') params.append('productId', selectedProductId);
      if (selectedKind !== 'all') params.append('kind', selectedKind);

      const res = await fetch(`/api/transactions?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setTransactions(data);
        if (isDefault) {
          setClientCache('transactions:history', data);
        }
      }
    } catch (err) {
      console.error('Error fetching transactions:', err);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, selectedProductId, selectedKind]);

  useEffect(() => {
    fetchProducts();
    fetchSuppliers();
  }, []);

  useEffect(() => {
    fetchTransactions(transactions.length > 0);

    // Auto-refresh setiap 25 detik & saat tab browser kembali aktif
    const interval = setInterval(() => {
      fetchTransactions(true);
    }, 25000);
    const handleFocus = () => {
      fetchTransactions(true);
      fetchProducts();
      fetchSuppliers();
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchTransactions]);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const handleResetFilter = () => {
    setStartDate('');
    setEndDate('');
    setSelectedProductId('all');
    setSelectedKind('all');
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
      if (selectedKind !== 'all') params.append('kind', selectedKind);

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

  const openManualModal = () => {
    manualKeyRef.current = crypto.randomUUID();
    setManualForm({ product_id: '', type: 'in', qty: 1, supplier_id: '', note: '' });
    setManualError('');
    setPairConfirm(null);
    setIsManualModalOpen(true);
  };

  // Kirim transaksi. Kunci idempotensi tetap sama walau dikirim ulang setelah konfirmasi.
  const postManual = async (confirmNewPair: boolean) => {
    const prod = products.find((p) => p.id === parseInt(manualForm.product_id, 10));
    if (!prod) return;
    const isIn = manualForm.type === 'in';
    setIsSavingManual(true);
    try {
      const res = await fetch('/api/transactions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          product_id: prod.id,
          type: manualForm.type,
          qty: manualForm.qty,
          ...(isIn ? { supplier_id: Number(manualForm.supplier_id) } : {}),
          note: manualForm.note.trim() || null,
          idempotency_key: manualKeyRef.current,
          confirm_new_pair: confirmNewPair
        })
      });
      const data = await res.json().catch(() => ({}));
      if (res.status === 409 && data.code === 'NEW_PAIR') {
        const sup = allSuppliers.find((x) => x.id === Number(manualForm.supplier_id));
        setPairConfirm({ productName: prod.name, supplierName: sup?.name ?? 'supplier ini' });
        return;
      }
      if (!res.ok) {
        setManualError(data.error || 'Gagal menyimpan transaksi');
        if (data.code === 'SUPPLIER_NONAKTIF') fetchSuppliers();
        return;
      }

      setIsManualModalOpen(false);
      invalidateClientCache('transactions');
      invalidateClientCache('products');
      invalidateClientCache('suppliers');
      showToast('Transaksi manual berhasil dicatat');
      fetchTransactions();
      fetchProducts();
    } catch {
      setManualError('Terjadi kesalahan pada server');
    } finally {
      setIsSavingManual(false);
    }
  };

  const handleManualSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isSavingManual) return;
    setManualError('');

    const prod = products.find((p) => p.id === parseInt(manualForm.product_id, 10));
    if (!prod) {
      setManualError('Pilih produk terlebih dahulu');
      return;
    }
    if (!Number.isInteger(manualForm.qty) || manualForm.qty < 1) {
      setManualError('Jumlah minimal 1 pcs');
      return;
    }

    if (manualForm.type === 'out') {
      if (manualForm.note.trim().length < 3) {
        setManualError('Alasan barang keluar wajib diisi (minimal 3 karakter)');
        return;
      }
      await postManual(false);
      return;
    }

    if (!manualForm.supplier_id) {
      setManualError('Supplier wajib dipilih untuk stok masuk');
      return;
    }

    // Cek dulu apakah produk ini pernah masuk dari supplier ini.
    setIsSavingManual(true);
    try {
      const params = new URLSearchParams({ product_id: String(prod.id), supplier_id: manualForm.supplier_id });
      const res = await fetch(`/api/transactions/pair-check?${params.toString()}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setManualError(data.error || 'Gagal memeriksa riwayat supplier');
        if (data.code === 'SUPPLIER_NONAKTIF') fetchSuppliers();
        return;
      }
      if (data.is_new) {
        const sup = allSuppliers.find((x) => x.id === Number(manualForm.supplier_id));
        setPairConfirm({ productName: prod.name, supplierName: sup?.name ?? 'supplier ini' });
        return;
      }
    } catch {
      setManualError('Terjadi kesalahan pada server');
      return;
    } finally {
      setIsSavingManual(false);
    }
    await postManual(false);
  };

  const handlePairConfirmYes = async () => {
    setPairConfirm(null);
    await postManual(true);
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
        </div>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={openManualModal}
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

          {(startDate || endDate || selectedProductId !== 'all' || selectedKind !== 'all') && (
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
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', fontWeight: 600, color: '#1E293B', marginBottom: '8px' }}>
              <Calendar size={14} style={{ color: '#64748B' }} />
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
                style={{ paddingRight: '38px', cursor: 'pointer', background: '#FFFFFF', height: '42px', fontSize: '14px', borderRadius: '8px' }}
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

          {/* Sampai Tanggal (DD/MM/YYYY) */}
          <div>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', fontWeight: 600, color: '#1E293B', marginBottom: '8px' }}>
              <Calendar size={14} style={{ color: '#64748B' }} />
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
                style={{ paddingRight: '38px', cursor: 'pointer', background: '#FFFFFF', height: '42px', fontSize: '14px', borderRadius: '8px' }}
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

          {/* Filter Produk */}
          <div>
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', fontWeight: 600, color: '#1E293B', marginBottom: '8px' }}>
              <Filter size={14} style={{ color: '#64748B' }} />
              <span>Filter Produk</span>
            </label>
            <select
              className="form-select"
              style={{ height: '42px', fontSize: '14px', borderRadius: '8px' }}
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
            <label className="form-label" style={{ display: 'flex', alignItems: 'center', gap: '6px', fontSize: '13.5px', fontWeight: 600, color: '#1E293B', marginBottom: '8px' }}>
              <Filter size={14} style={{ color: '#64748B' }} />
              <span>Jenis Transaksi</span>
            </label>
            <select
              className="form-select"
              style={{ height: '42px', fontSize: '14px', borderRadius: '8px' }}
              value={selectedKind}
              onChange={(e) => setSelectedKind(e.target.value as 'all' | TransactionKind)}
            >
              <option value="all">Semua Jenis</option>
              {TRANSACTION_KINDS.map((k) => (
                <option key={k} value={k}>{TRANSACTION_KIND_LABEL[k]}</option>
              ))}
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
              <th style={{ width: '14%' }}>Jumlah</th>
              <th style={{ width: '28%' }}>Supplier / Catatan</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && transactions.length === 0 ? (
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
              transactionPagination.pageItems.map((tx) => {
                const isIn = tx.type === 'in';
                const kind: TransactionKind = tx.kind ?? (isIn ? 'masuk' : 'keluar_manual');
                // "Stok awal" (opname pertama) bukan barang keluar/masuk sungguhan: label netral.
                const badgeType = kind === 'masuk' ? 'in' : kind === 'koreksi' ? 'koreksi' : kind === 'stok_awal' ? 'neutral' : 'out';
                const qtyColor = kind === 'masuk' ? '#059669' : kind === 'koreksi' ? '#B45309' : kind === 'stok_awal' ? '#475569' : '#DC2626';
                return (
                  <tr key={tx.id}>
                    <td style={{ color: '#475569', fontSize: '13px' }}>
                      {formatDateTime(tx.created_at)}
                    </td>
                    <td>
                      <Badge type={badgeType}>
                        {TRANSACTION_KIND_LABEL[kind]}
                      </Badge>
                    </td>
                    <td>
                      <span style={{ fontWeight: 600, color: '#0F172A', fontSize: '13.5px' }}>
                        {tx.product?.name || `Produk #${tx.product_id}`}
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          fontWeight: 700,
                          fontSize: '13.5px',
                          color: qtyColor
                        }}
                      >
                        {isIn ? '+' : '-'}{tx.qty} pcs
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
      <Pagination
        currentPage={transactionPagination.currentPage}
        pageSize={transactionPagination.pageSize}
        totalItems={transactionPagination.totalItems}
        onPageChange={transactionPagination.setCurrentPage}
      />

      {/* Modal Ekspor Laporan */}
      <Modal
        isOpen={isExportModalOpen}
        onClose={() => setIsExportModalOpen(false)}
        title="Ekspor Laporan Transaksi"
        maxWidth="440px"
      >
        <div style={{ padding: '4px 0 16px' }}>
          <p style={{ fontSize: '13px', color: '#64748B', marginBottom: '16px', lineHeight: 1.45 }}>
            Unduh laporan transaksi sesuai filter tanggal, produk, dan jenis yang sedang dipilih:
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
                onClick={() => setManualForm({ ...manualForm, type: 'in', note: '' })}
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
                onClick={() => setManualForm({ ...manualForm, type: 'out', supplier_id: '', note: '' })}
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
              onChange={(e) => setManualForm({ ...manualForm, product_id: e.target.value, supplier_id: '' })}
              required
            >
              <option value="">-- Pilih Produk --</option>
              {products.map((p) => (
                <option key={p.id} value={p.id.toString()}>
                  {p.name} (Stok: {p.stock_current} pcs)
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label className="form-label">Jumlah (pcs) *</label>
            <input
              type="number"
              min={1}
              className="form-input"
              value={manualForm.qty}
              onChange={(e) => setManualForm({ ...manualForm, qty: parseInt(e.target.value, 10) || 1 })}
              required
            />
          </div>

          {manualForm.type === 'in' && (
            <div className="form-group">
              <label className="form-label">Supplier *</label>
              <select
                className="form-select"
                value={manualForm.supplier_id}
                onChange={(e) => setManualForm({ ...manualForm, supplier_id: e.target.value })}
                required
              >
                <option value="">-- Pilih Supplier --</option>
                {supplierGroups.map((g) => (
                  <optgroup key={g.jenis} label={`Supplier ${SUPPLIER_JENIS_LABEL[g.jenis]}`}>
                    {g.items.map((o) => (
                      <option key={o.id} value={o.id}>{o.name}</option>
                    ))}
                  </optgroup>
                ))}
              </select>
              {supplierGroups.length === 0 && (
                <p style={{ fontSize: '12px', color: '#B45309', margin: '4px 0 0' }}>
                  Belum ada supplier aktif. Tambahkan atau aktifkan supplier di halaman Supplier.
                </p>
              )}
            </div>
          )}

          {manualForm.type === 'out' ? (
            <div className="form-group">
              <label className="form-label">Alasan (wajib) *</label>
              <input
                type="text"
                className="form-input"
                placeholder="Contoh: kemasan rusak, barang hilang"
                value={manualForm.note}
                maxLength={200}
                minLength={3}
                onChange={(e) => setManualForm({ ...manualForm, note: e.target.value })}
                required
              />
              <p style={{ fontSize: '12px', color: '#64748B', marginTop: '6px' }}>
                Barang terjual dicatat lewat stok opname di Telegram. Keluar manual hanya untuk barang rusak atau hilang.
              </p>
            </div>
          ) : (
            <div className="form-group">
              <label className="form-label">Catatan Tambahan (Opsional)</label>
              <input
                type="text"
                className="form-input"
                placeholder="Keterangan singkat..."
                value={manualForm.note}
                maxLength={200}
                onChange={(e) => setManualForm({ ...manualForm, note: e.target.value })}
              />
            </div>
          )}

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
              disabled={isSavingManual}
            >
              {isSavingManual ? 'Menyimpan...' : 'Simpan Transaksi'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Konfirmasi pasangan produk + supplier baru (peringatan lunak) */}
      <Modal
        isOpen={pairConfirm !== null}
        onClose={() => setPairConfirm(null)}
        title="Supplier Baru untuk Produk Ini"
        maxWidth="420px"
      >
        <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', marginBottom: '20px' }}>
          <AlertCircle size={20} style={{ color: '#B45309', flexShrink: 0, marginTop: '1px' }} />
          <p style={{ fontSize: '13.5px', color: '#0F172A', lineHeight: 1.5, margin: 0 }}>
            <strong>{pairConfirm?.productName}</strong> belum pernah masuk dari <strong>{pairConfirm?.supplierName}</strong>. Lanjutkan?
          </p>
        </div>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
          <button type="button" className="btn btn-secondary" onClick={() => setPairConfirm(null)}>
            Batal
          </button>
          <button type="button" className="btn btn-primary" onClick={handlePairConfirmYes} disabled={isSavingManual}>
            Ya, Lanjutkan
          </button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
