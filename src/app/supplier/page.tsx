'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Supplier, SupplierJenis } from '@/types';
import { formatDateTime } from '@/lib/export-utils';
import {
  Truck,
  Plus,
  Edit2,
  Lock,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Building2,
  Store,
  Layers
} from 'lucide-react';

export default function SupplierPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [selectedSupplier, setSelectedSupplier] = useState<Supplier | null>(null);

  // Form states
  const [formName, setFormName] = useState('');
  const [formJenis, setFormJenis] = useState<SupplierJenis>('utama');
  const [errorMessage, setErrorMessage] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

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

  useEffect(() => {
    fetchSuppliers();
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  const formatLastRestock = (dateStr?: string | null) => {
    if (!dateStr) return '—';
    return formatDateTime(dateStr);
  };

  // Ringkasan per jenis supplier
  const statsUtama = suppliers.filter(s => s.jenis === 'utama');
  const statsCadangan = suppliers.filter(s => s.jenis === 'cadangan');
  const statsGrosir = suppliers.filter(s => s.jenis === 'grosir');

  const countTrxUtama = statsUtama.reduce((acc, s) => acc + (s.transaction_count || 0), 0);
  const countTrxCadangan = statsCadangan.reduce((acc, s) => acc + (s.transaction_count || 0), 0);
  const countTrxGrosir = statsGrosir.reduce((acc, s) => acc + (s.transaction_count || 0), 0);

  // 1. Tambah Supplier
  const openAddModal = () => {
    setFormName('');
    setFormJenis('utama');
    setErrorMessage('');
    setIsAddModalOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!formName.trim()) {
      setErrorMessage('Nama supplier wajib diisi');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/suppliers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          jenis: formJenis
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Gagal menambahkan supplier');
        setIsSaving(false);
        return;
      }

      setIsAddModalOpen(false);
      showToast(`Supplier "${formName}" berhasil ditambahkan`);
      fetchSuppliers();
    } catch {
      setErrorMessage('Terjadi kesalahan pada server');
    } finally {
      setIsSaving(false);
    }
  };

  // 2. Ubah Supplier
  const openEditModal = (supplier: Supplier) => {
    if (supplier.is_adjustment || supplier.name.toLowerCase() === 'koreksi stok') {
      return; // Terkunci
    }
    setSelectedSupplier(supplier);
    setFormName(supplier.name);
    setFormJenis(supplier.jenis || 'utama');
    setErrorMessage('');
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) return;
    setErrorMessage('');

    if (!formName.trim()) {
      setErrorMessage('Nama supplier wajib diisi');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/suppliers/${selectedSupplier.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formName.trim(),
          jenis: formJenis
        })
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Gagal mengubah supplier');
        setIsSaving(false);
        return;
      }

      setIsEditModalOpen(false);
      showToast(`Data supplier berhasil diperbarui`);
      fetchSuppliers();
    } catch {
      setErrorMessage('Terjadi kesalahan pada server');
    } finally {
      setIsSaving(false);
    }
  };

  const getJenisBadge = (jenis: SupplierJenis | null, isAdjustment: boolean) => {
    if (isAdjustment) {
      return <Badge variant="secondary">Sistem</Badge>;
    }
    switch (jenis) {
      case 'utama':
        return <Badge variant="primary">Utama</Badge>;
      case 'cadangan':
        return <Badge variant="warning">Cadangan</Badge>;
      case 'grosir':
        return <Badge variant="success">Grosir</Badge>;
      default:
        return <Badge variant="secondary">—</Badge>;
    }
  };

  return (
    <DashboardLayout
      title="Supplier"
      subtitle="Pengaturan data mitra supplier dan penetapan kategori jenis penyedia barang toko"
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

      {/* Ringkasan: Barang Masuk per Jenis Supplier (Sesuai Bagian 5) */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
          gap: '16px',
          marginBottom: '22px'
        }}
      >
        <div className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-md)',
              background: '#EFF6FF',
              color: '#2563EB',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Building2 size={20} />
          </div>
          <div>
            <span style={{ fontSize: '12.5px', color: '#64748B', fontWeight: 500 }}>Supplier Utama</span>
            <h4 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: '2px 0 0 0' }}>
              {countTrxUtama} <span style={{ fontSize: '12px', fontWeight: 400, color: '#64748B' }}>transaksi masuk</span>
            </h4>
            <span style={{ fontSize: '11.5px', color: '#94A3B8' }}>{statsUtama.length} mitra terdaftar</span>
          </div>
        </div>

        <div className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-md)',
              background: '#FFFBEB',
              color: '#D97706',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Layers size={20} />
          </div>
          <div>
            <span style={{ fontSize: '12.5px', color: '#64748B', fontWeight: 500 }}>Supplier Cadangan</span>
            <h4 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: '2px 0 0 0' }}>
              {countTrxCadangan} <span style={{ fontSize: '12px', fontWeight: 400, color: '#64748B' }}>transaksi masuk</span>
            </h4>
            <span style={{ fontSize: '11.5px', color: '#94A3B8' }}>{statsCadangan.length} mitra terdaftar</span>
          </div>
        </div>

        <div className="card" style={{ padding: '18px 20px', display: 'flex', alignItems: 'center', gap: '14px' }}>
          <div
            style={{
              width: '42px',
              height: '42px',
              borderRadius: 'var(--radius-md)',
              background: '#F0FDF4',
              color: '#059669',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0
            }}
          >
            <Store size={20} />
          </div>
          <div>
            <span style={{ fontSize: '12.5px', color: '#64748B', fontWeight: 500 }}>Supplier Grosir</span>
            <h4 style={{ fontSize: '18px', fontWeight: 700, color: '#0F172A', margin: '2px 0 0 0' }}>
              {countTrxGrosir} <span style={{ fontSize: '12px', fontWeight: 400, color: '#64748B' }}>transaksi masuk</span>
            </h4>
            <span style={{ fontSize: '11.5px', color: '#94A3B8' }}>{statsGrosir.length} mitra terdaftar</span>
          </div>
        </div>
      </div>

      {/* Action Header */}
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
            Total <strong style={{ color: '#0F172A' }}>{suppliers.length}</strong> Supplier Terdaftar
          </div>

          <button onClick={fetchSuppliers} className="btn btn-secondary btn-sm" title="Segarkan Data">
            <RefreshCw size={14} className={isLoading ? 'pulse' : ''} />
            <span>Segarkan</span>
          </button>
        </div>

        <button onClick={openAddModal} className="btn btn-primary btn-sm">
          <Plus size={16} />
          <span>Tambah Supplier</span>
        </button>
      </div>

      {/* Tabel Supplier: Nama, Jenis, Jumlah Transaksi, Terakhir Masuk, Aksi */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="table-container">
          <table className="table">
            <thead>
              <tr>
                <th style={{ width: '30%' }}>NAMA SUPPLIER</th>
                <th style={{ width: '18%' }}>JENIS</th>
                <th style={{ width: '20%' }}>JUMLAH TRANSAKSI</th>
                <th style={{ width: '22%' }}>TERAKHIR MASUK</th>
                <th style={{ width: '10%', textAlign: 'center' }}>AKSI</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '48px', color: '#94A3B8' }}>
                    Memuat data supplier...
                  </td>
                </tr>
              ) : suppliers.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '48px', color: '#64748B' }}>
                    Belum ada supplier terdaftar.
                  </td>
                </tr>
              ) : (
                suppliers.map((supplier) => {
                  const isLocked = supplier.is_adjustment || supplier.name.toLowerCase() === 'koreksi stok';

                  return (
                    <tr key={supplier.id}>
                      <td style={{ fontWeight: 600, color: '#0F172A' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span>{supplier.name}</span>
                          {isLocked && (
                            <span
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '3px',
                                fontSize: '11px',
                                color: '#64748B',
                                background: '#F1F5F9',
                                padding: '2px 6px',
                                borderRadius: '4px'
                              }}
                            >
                              <Lock size={11} />
                              <span>Sistem</span>
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        {getJenisBadge(supplier.jenis, supplier.is_adjustment)}
                      </td>
                      <td>
                        <span style={{ fontWeight: 600, color: '#0F172A' }}>
                          {supplier.transaction_count || 0}
                        </span>{' '}
                        <span style={{ fontSize: '12px', color: '#64748B' }}>kali</span>
                      </td>
                      <td style={{ fontSize: '13px', color: '#475569' }}>
                        {formatLastRestock(supplier.last_restock_date)}
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        {isLocked ? (
                          <span
                            title="Supplier sistem terkunci"
                            style={{
                              color: '#94A3B8',
                              display: 'inline-flex',
                              alignItems: 'center',
                              padding: '6px'
                            }}
                          >
                            <Lock size={15} />
                          </span>
                        ) : (
                          <button
                            onClick={() => openEditModal(supplier)}
                            className="btn-icon"
                            title="Ubah Supplier"
                          >
                            <Edit2 size={15} />
                          </button>
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

      {/* Modal Tambah Supplier */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Tambah Supplier Baru"
        subtitle="Daftarkan mitra penyedia barang toko dan tentukan jenisnya"
      >
        <form onSubmit={handleAddSubmit}>
          {errorMessage && (
            <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="add-sup-name">
              Nama Supplier <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input
              id="add-sup-name"
              type="text"
              className="input"
              placeholder="Contoh: PT Indofood Sukses Makmur"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              maxLength={100}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="add-sup-jenis">
              Jenis Supplier <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <select
              id="add-sup-jenis"
              className="input"
              value={formJenis}
              onChange={(e) => setFormJenis(e.target.value as SupplierJenis)}
            >
              <option value="utama">Utama (Penyedia reguler prioritas)</option>
              <option value="cadangan">Cadangan (Alternatif saat utama habis)</option>
              <option value="grosir">Grosir (Pasar / agen grosir lokal)</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
            <button
              type="button"
              onClick={() => setIsAddModalOpen(false)}
              className="btn btn-secondary"
              disabled={isSaving}
            >
              Batal
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? 'Menyimpan...' : 'Simpan Supplier'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Ubah Supplier */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Ubah Supplier"
        subtitle="Perbarui nama supplier atau ubah jenis peran supplier"
      >
        <form onSubmit={handleEditSubmit}>
          {errorMessage && (
            <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
              <AlertCircle size={16} />
              <span>{errorMessage}</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="edit-sup-name">
              Nama Supplier <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input
              id="edit-sup-name"
              type="text"
              className="input"
              value={formName}
              onChange={(e) => setFormName(e.target.value)}
              maxLength={100}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="edit-sup-jenis">
              Jenis Supplier <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <select
              id="edit-sup-jenis"
              className="input"
              value={formJenis}
              onChange={(e) => setFormJenis(e.target.value as SupplierJenis)}
            >
              <option value="utama">Utama (Penyedia reguler prioritas)</option>
              <option value="cadangan">Cadangan (Alternatif saat utama habis)</option>
              <option value="grosir">Grosir (Pasar / agen grosir lokal)</option>
            </select>
          </div>

          <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
            <button
              type="button"
              onClick={() => setIsEditModalOpen(false)}
              className="btn btn-secondary"
              disabled={isSaving}
            >
              Batal
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSaving}>
              {isSaving ? 'Menyimpan...' : 'Perbarui Supplier'}
            </button>
          </div>
        </form>
      </Modal>
    </DashboardLayout>
  );
}
