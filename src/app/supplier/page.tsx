'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Supplier, SupplierJenis, SUPPLIER_JENIS, MasukPerJenisRow } from '@/types';
import { formatDateOnly } from '@/lib/export-utils';
import { SUPPLIER_JENIS_LABEL } from '@/lib/stock-labels';
import {
  Edit2,
  Lock,
  Plus,
  Info,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Building2,
  Power,
  Trash2
} from 'lucide-react';

export default function SupplierPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);
  const [editName, setEditName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [addName, setAddName] = useState('');
  const [addJenis, setAddJenis] = useState<SupplierJenis | ''>('');
  const [editJenis, setEditJenis] = useState<SupplierJenis | ''>('');
  // Nonaktif/aktif dan hapus permanen.
  const [showInactive, setShowInactive] = useState(false);
  const [busyId, setBusyId] = useState<number | null>(null);
  const [confirmAction, setConfirmAction] = useState<{ kind: 'deactivate' | 'delete'; supplier: Supplier } | null>(null);
  const [actionError, setActionError] = useState('');

  const fetchSuppliers = async () => {
    setIsLoading(true);
    try {
      const res = await fetch('/api/suppliers');
      if (res.ok) {
        const data = await res.json();
        setSuppliers(data);
      }
    } catch (err) {
      console.error('Error fetching suppliers:', err);
    } finally {
      setIsLoading(false);
    }
  };

  // Ringkasan barang masuk per jenis supplier, 30 hari terakhir (tanpa koreksi stok).
  const [masuk, setMasuk] = useState<MasukPerJenisRow[]>([]);
  const [masukRange, setMasukRange] = useState<{ startDate: string; endDate: string } | null>(null);
  const [masukError, setMasukError] = useState('');

  const fetchMasuk = async () => {
    setMasukError('');
    try {
      const res = await fetch('/api/suppliers/masuk-per-jenis');
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setMasukError(data?.error || 'Gagal memuat ringkasan barang masuk');
        return;
      }
      setMasuk(data.rows);
      setMasukRange(data.range);
    } catch {
      setMasukError('Gagal memuat ringkasan barang masuk');
    }
  };

  const refreshAll = () => {
    fetchSuppliers();
    fetchMasuk();
  };

  useEffect(() => {
    fetchSuppliers();
    fetchMasuk();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // PATCH is_active. Mengaktifkan langsung jalan; menonaktifkan lewat dialog konfirmasi.
  const setActive = async (supplier: Supplier, isActive: boolean) => {
    if (busyId !== null) return;
    setBusyId(supplier.id);
    setActionError('');
    try {
      const res = await fetch(`/api/suppliers/${supplier.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: isActive })
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = data.error || 'Gagal mengubah status supplier';
        if (confirmAction) setActionError(msg); else showToast(msg);
        return;
      }
      setConfirmAction(null);
      showToast(isActive ? `"${supplier.name}" diaktifkan lagi` : `"${supplier.name}" dinonaktifkan`);
      fetchSuppliers();
    } catch {
      setActionError('Terjadi kesalahan pada server');
    } finally {
      setBusyId(null);
    }
  };

  const deletePermanent = async (supplier: Supplier) => {
    if (busyId !== null) return;
    setBusyId(supplier.id);
    setActionError('');
    try {
      const res = await fetch(`/api/suppliers/${supplier.id}`, { method: 'DELETE' });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setActionError(data.error || 'Gagal menghapus supplier');
        if (res.status === 409 || res.status === 404) fetchSuppliers();
        return;
      }
      setConfirmAction(null);
      showToast(`"${supplier.name}" dihapus permanen`);
      fetchSuppliers();
    } catch {
      setActionError('Terjadi kesalahan pada server');
    } finally {
      setBusyId(null);
    }
  };

  const openConfirm = (kind: 'deactivate' | 'delete', supplier: Supplier) => {
    setActionError('');
    setConfirmAction({ kind, supplier });
  };

  const activeCount = suppliers.filter((s) => s.is_active).length;
  const inactiveCount = suppliers.length - activeCount;
  const visibleSuppliers = showInactive ? suppliers : suppliers.filter((s) => s.is_active);

  const openEditModal = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setEditName(supplier.name);
    setEditJenis(supplier.jenis ?? '');
    setErrorMessage('');
    setIsEditModalOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');
    if (!addName.trim()) {
      setErrorMessage('Nama supplier tidak boleh kosong');
      return;
    }
    if (!addJenis) {
      setErrorMessage('Jenis supplier wajib dipilih');
      return;
    }
    setIsSaving(true);
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: addName.trim(), jenis: addJenis })
      });
      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Gagal menambahkan supplier');
        return;
      }
      setIsAddModalOpen(false);
      showToast('Supplier berhasil ditambahkan');
      fetchSuppliers();
    } catch {
      setErrorMessage('Terjadi kesalahan pada server');
    } finally {
      setIsSaving(false);
    }
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) return;
    setErrorMessage('');

    if (!editName.trim()) {
      setErrorMessage('Nama supplier tidak boleh kosong');
      return;
    }
    if (!editJenis) {
      setErrorMessage('Jenis supplier wajib dipilih');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/suppliers/${selectedSupplier.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim(), jenis: editJenis })
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Gagal mengubah supplier');
        setIsSaving(false);
        return;
      }

      setIsEditModalOpen(false);
      showToast('Supplier berhasil diperbarui');
      fetchSuppliers();
    } catch {
      setErrorMessage('Terjadi kesalahan pada server');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardLayout
      title="Supplier"
      subtitle="Daftarkan supplier beserta jenisnya (utama, cadangan, atau grosir). Ringkasan barang masuk per jenis ada di bawah ini."
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

      {/* Header Counter & Refresh */}
      <div className="page-header-box" style={{ marginBottom: '18px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flexWrap: 'wrap' }}>
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
            <strong style={{ color: '#0F172A' }}>{activeCount}</strong> Supplier Aktif
            {inactiveCount > 0 && <span style={{ color: '#64748B', fontWeight: 500 }}> · {inactiveCount} nonaktif</span>}
          </div>

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', color: '#334155', cursor: 'pointer', userSelect: 'none' }}>
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
            />
            Tampilkan yang nonaktif
          </label>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <button
            onClick={refreshAll}
            className="btn btn-secondary btn-sm"
            title="Segarkan Data"
          >
            <RefreshCw size={14} className={isLoading ? 'pulse' : ''} />
            <span>Segarkan</span>
          </button>

          <button
            onClick={() => { setAddName(''); setAddJenis(''); setErrorMessage(''); setIsAddModalOpen(true); }}
            className="btn btn-primary btn-sm"
          >
            <Plus size={14} />
            <span>Tambah supplier</span>
          </button>
        </div>
      </div>

      {/* Ringkasan barang masuk per jenis supplier */}
      <div className="card" style={{ marginBottom: '20px', padding: '18px 22px' }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', flexWrap: 'wrap', gap: '6px', marginBottom: '14px' }}>
          <div>
            <h4 style={{ fontSize: '14px', fontWeight: 700, color: '#0F172A', margin: 0 }}>Barang Masuk per Jenis Supplier</h4>
            <p style={{ fontSize: '12px', color: '#64748B', margin: '2px 0 0' }}>Akumulasi volume barang masuk selama periode 30 hari terakhir</p>
          </div>
          <span style={{ fontSize: '12px', fontWeight: 500, color: '#64748B', background: '#F1F5F9', padding: '4px 10px', borderRadius: 'var(--radius-full)' }}>
            {masukRange ? `${formatDateOnly(masukRange.startDate)} – ${formatDateOnly(masukRange.endDate)}` : '30 hari terakhir'} · tanpa koreksi stok
          </span>
        </div>
        {masukError ? (
          <p style={{ fontSize: '12.5px', color: '#DC2626', margin: 0 }}>{masukError}</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '14px' }}>
            {SUPPLIER_JENIS.map((j) => {
              const row = masuk.find((x) => x.jenis === j) ?? { jenis: j, total_qty: 0, transaction_count: 0 };
              const maxQty = Math.max(1, ...masuk.map((x) => x.total_qty));
              const pct = (row.total_qty / maxQty) * 100;
              const barColors: Record<SupplierJenis, string> = {
                utama: '#2563EB',
                cadangan: '#059669',
                grosir: '#7C3AED'
              };
              return (
                <div
                  key={j}
                  title={`${SUPPLIER_JENIS_LABEL[j]}: ${row.total_qty.toLocaleString('id-ID')} pcs dari ${row.transaction_count} transaksi`}
                  style={{
                    background: '#FFFFFF',
                    border: '1px solid #E2E8F0',
                    borderRadius: 'var(--radius-lg)',
                    padding: '14px 16px',
                    boxShadow: 'var(--shadow-xs)',
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'space-between'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '10px' }}>
                    <Badge type={j}>{SUPPLIER_JENIS_LABEL[j]}</Badge>
                    <span style={{ fontSize: '11.5px', fontWeight: 600, color: '#475569', background: '#F8FAFC', border: '1px solid #E2E8F0', padding: '2px 8px', borderRadius: 'var(--radius-full)' }}>
                      {row.transaction_count} transaksi
                    </span>
                  </div>
                  <div style={{ fontSize: '20px', fontWeight: 800, color: '#0F172A', marginBottom: '10px', letterSpacing: '-0.02em' }}>
                    {row.total_qty.toLocaleString('id-ID')} <span style={{ fontSize: '12.5px', fontWeight: 500, color: '#64748B' }}>pcs</span>
                  </div>
                  <div>
                    <div style={{ height: '6px', background: '#F1F5F9', borderRadius: 'var(--radius-full)', overflow: 'hidden' }}>
                      <div
                        style={{
                          width: `${pct}%`,
                          minWidth: row.total_qty > 0 ? '6px' : 0,
                          height: '100%',
                          background: barColors[j],
                          borderRadius: 'var(--radius-full)',
                          transition: 'width 0.3s ease'
                        }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Tabel Data Supplier Sesuai Proposal */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '32%' }}>Nama supplier</th>
              <th style={{ width: '15%' }}>Jenis</th>
              <th style={{ width: '18%' }}>Kali barang masuk</th>
              <th style={{ width: '18%' }}>Terakhir masuk</th>
              <th style={{ width: '17%', textAlign: 'center' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: '#94A3B8' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid #CBD5E1', borderTopColor: '#0F172A', animation: 'spin 0.6s linear infinite' }} />
                    <span>Memuat data supplier...</span>
                  </div>
                </td>
              </tr>
            ) : visibleSuppliers.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
                  <Building2 size={32} style={{ color: '#94A3B8', margin: '0 auto 8px', display: 'block' }} />
                  <span>{suppliers.length === 0 ? 'Belum ada supplier yang tercatat.' : 'Tidak ada supplier aktif. Centang "Tampilkan yang nonaktif" untuk melihat semuanya.'}</span>
                </td>
              </tr>
            ) : (
              visibleSuppliers.map((item) => (
                <tr key={item.id} style={item.is_active ? undefined : { opacity: 0.55, background: '#F8FAFC' }}>
                  <td>
                    <div style={{ fontWeight: 600, color: '#0F172A', fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                      {item.name}
                      {!item.is_active && <Badge type="neutral">Nonaktif</Badge>}
                    </div>
                    {item.is_adjustment && (
                      <div style={{ fontSize: '12px', color: '#64748B', marginTop: '2px' }}>Supplier sistem untuk penyesuaian stok</div>
                    )}
                  </td>
                  <td>
                    {item.jenis ? (
                      <Badge type={item.jenis}>{SUPPLIER_JENIS_LABEL[item.jenis]}</Badge>
                    ) : (
                      <Badge type="neutral">Sistem</Badge>
                    )}
                  </td>
                  <td style={{ color: '#334155', fontSize: '13.5px' }}>
                    {item.transaction_count ?? 0}
                  </td>
                  <td style={{ color: '#475569', fontSize: '13.5px' }}>
                    {item.last_restock_date ? formatDateOnly(item.last_restock_date) : '-'}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    {item.is_adjustment ? (
                      <span
                        title="Supplier sistem tidak bisa diubah, dinonaktifkan, atau dihapus"
                        style={{
                          display: 'inline-flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: '32px',
                          height: '32px',
                          borderRadius: 'var(--radius-sm)',
                          background: '#F1F5F9',
                          color: '#94A3B8'
                        }}
                      >
                        <Lock size={14} />
                      </span>
                    ) : (
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <button
                          onClick={() => openEditModal(item)}
                          className="sup-icon-btn action-btn-edit"
                          title="Ubah Nama atau Jenis Supplier"
                          disabled={busyId !== null}
                        >
                          <Edit2 size={13} />
                        </button>
                        {item.is_active ? (
                          <button
                            onClick={() => openConfirm('deactivate', item)}
                            className="sup-icon-btn action-btn-power"
                            disabled={busyId !== null}
                            title="Nonaktifkan supplier (bot & form tidak akan menawarkannya)"
                          >
                            <Power size={13} />
                          </button>
                        ) : (
                          <button
                            onClick={() => setActive(item, true)}
                            className="sup-icon-btn action-btn-activate"
                            disabled={busyId !== null}
                            title="Aktifkan kembali supplier"
                          >
                            <Power size={13} />
                          </button>
                        )}
                        {(item.transaction_count ?? 0) === 0 && (
                          <button
                            onClick={() => openConfirm('delete', item)}
                            className="sup-icon-btn action-btn-delete"
                            disabled={busyId !== null}
                            title="Hapus permanen (hanya untuk supplier tanpa riwayat)"
                          >
                            <Trash2 size={13} />
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <p style={{ fontSize: '12px', color: '#64748B', margin: '8px 2px 0' }}>
        Angka ini dihitung dari seluruh riwayat stok masuk, termasuk barang yang sudah dihapus dari katalog.
      </p>

      {/* Modal Tambah Supplier */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Tambah Supplier"
        maxWidth="440px"
      >
        <form onSubmit={handleAddSubmit}>
          {errorMessage && (
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius-sm)', color: '#DC2626', fontSize: '13px', marginBottom: '16px' }}>
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}
          <div className="form-group">
            <label className="form-label">Nama Supplier *</label>
            <input type="text" className="form-input" value={addName} onChange={(e) => setAddName(e.target.value)} placeholder="Contoh: PT Unilever Indonesia" required />
          </div>
          <div className="form-group">
            <label className="form-label">Jenis Supplier *</label>
            <select className="form-select" value={addJenis} onChange={(e) => setAddJenis(e.target.value as SupplierJenis | '')} required>
              <option value="">-- Pilih Jenis --</option>
              {SUPPLIER_JENIS.map((j) => (
                <option key={j} value={j}>{SUPPLIER_JENIS_LABEL[j]}</option>
              ))}
            </select>
          </div>
          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #E2E8F0' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setIsAddModalOpen(false)}>Batal</button>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>{isSaving ? 'Menyimpan...' : 'Simpan'}</button>
          </div>
        </form>
      </Modal>

      {/* Modal Ubah Supplier */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Ubah Supplier"
        maxWidth="440px"
      >
        <form onSubmit={handleEditSubmit}>
          {errorMessage && (
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
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Nama Supplier *</label>
            <input
              type="text"
              className="form-input"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              placeholder="Contoh: PT Unilever Indonesia"
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label">Jenis Supplier *</label>
            <select className="form-select" value={editJenis} onChange={(e) => setEditJenis(e.target.value as SupplierJenis | '')} required>
              <option value="">-- Pilih Jenis --</option>
              {SUPPLIER_JENIS.map((j) => (
                <option key={j} value={j}>{SUPPLIER_JENIS_LABEL[j]}</option>
              ))}
            </select>
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
              onClick={() => setIsEditModalOpen(false)}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSaving}
            >
              {isSaving ? 'Menyimpan...' : 'Simpan Perubahan'}
            </button>
          </div>
        </form>
      </Modal>
      {/* Konfirmasi nonaktifkan / hapus permanen */}
      <Modal
        isOpen={confirmAction !== null}
        onClose={() => { if (busyId === null) setConfirmAction(null); }}
        title={confirmAction?.kind === 'delete' ? 'Hapus Permanen Supplier' : 'Nonaktifkan Supplier'}
        maxWidth="440px"
      >
        {actionError && (
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', padding: '10px 14px', background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius-sm)', color: '#DC2626', fontSize: '13px', marginBottom: '16px' }}>
            <AlertCircle size={16} />
            <span>{actionError}</span>
          </div>
        )}
        <p style={{ fontSize: '13.5px', color: '#334155', lineHeight: 1.5, margin: '0 0 6px' }}>
          {confirmAction?.kind === 'delete' ? (
            <>Hapus permanen <strong>{confirmAction?.supplier.name}</strong>? Tindakan ini tidak bisa dibatalkan.</>
          ) : (
            <>Nonaktifkan <strong>{confirmAction?.supplier.name}</strong>? Bot dan form stok masuk tidak akan menawarkannya lagi. Riwayat tetap ada dan bisa diaktifkan lagi kapan saja.</>
          )}
        </p>
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '20px', paddingTop: '16px', borderTop: '1px solid #E2E8F0' }}>
          <button type="button" className="btn btn-secondary" onClick={() => setConfirmAction(null)} disabled={busyId !== null}>
            Batal
          </button>
          {confirmAction?.kind === 'delete' ? (
            <button
              type="button"
              className="btn btn-danger"
              disabled={busyId !== null}
              onClick={() => confirmAction && deletePermanent(confirmAction.supplier)}
            >
              {busyId !== null ? 'Menghapus...' : 'Hapus permanen'}
            </button>
          ) : (
            <button
              type="button"
              className="btn btn-primary"
              disabled={busyId !== null}
              onClick={() => confirmAction && setActive(confirmAction.supplier, false)}
            >
              {busyId !== null ? 'Memproses...' : 'Nonaktifkan'}
            </button>
          )}
        </div>
      </Modal>

      <style jsx global>{`
        .sup-icon-btn {
          width: 32px;
          height: 32px;
          padding: 0;
          border-radius: var(--radius-sm);
          display: inline-flex;
          align-items: center;
          justify-content: center;
          transition: all var(--transition-fast);
          cursor: pointer;
        }
        .sup-icon-btn.action-btn-edit { color: #334155; background: #F8FAFC; border: 1px solid #E2E8F0; }
        .sup-icon-btn.action-btn-edit:not(:disabled):hover { background: #0F172A; color: #FFFFFF; border-color: #0F172A; }
        .sup-icon-btn.action-btn-power { color: #64748B; background: #F8FAFC; border: 1px solid #E2E8F0; }
        .sup-icon-btn.action-btn-power:not(:disabled):hover { background: #FEF2F2; color: #DC2626; border-color: #FECACA; }
        .sup-icon-btn.action-btn-activate { color: #059669; background: #ECFDF5; border: 1px solid #A7F3D0; }
        .sup-icon-btn.action-btn-activate:not(:disabled):hover { background: #059669; color: #FFFFFF; border-color: #059669; }
        .sup-icon-btn.action-btn-delete { color: #DC2626; background: #FEF2F2; border: 1px solid #FECACA; }
        .sup-icon-btn.action-btn-delete:not(:disabled):hover { background: #DC2626; color: #FFFFFF; border-color: #DC2626; }
        .sup-icon-btn:disabled { opacity: 0.5; cursor: not-allowed; }
      `}</style>
    </DashboardLayout>
  );
}
