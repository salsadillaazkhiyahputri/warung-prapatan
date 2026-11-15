'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Modal } from '@/components/ui/Modal';
import { Supplier } from '@/types';
import { formatDateOnly } from '@/lib/export-utils';
import {
  Truck,
  Edit2,
  Info,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
  Building2
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

  const openEditModal = (supplier: Supplier) => {
    setSelectedSupplier(supplier);
    setEditName(supplier.name);
    setErrorMessage('');
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSupplier) return;
    setErrorMessage('');

    if (!editName.trim()) {
      setErrorMessage('Nama supplier tidak boleh kosong');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/suppliers/${selectedSupplier.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: editName.trim() })
      });

      const data = await res.json();
      if (!res.ok) {
        setErrorMessage(data.error || 'Gagal mengubah nama supplier');
        setIsSaving(false);
        return;
      }

      setIsEditModalOpen(false);
      showToast(`Nama supplier berhasil diperbarui`);
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
      subtitle="Supplier ditambahkan otomatis dari chatbot. Anda dapat mengedit nama jika terdapat kesalahan penulisan."
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

      {/* Header Counter & Refresh */}
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

          <button
            onClick={fetchSuppliers}
            className="btn btn-secondary btn-sm"
            title="Segarkan Data"
          >
            <RefreshCw size={14} className={isLoading ? 'pulse' : ''} />
            <span>Segarkan</span>
          </button>
        </div>
      </div>

      {/* Tabel Data Supplier Sesuai Proposal */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '40%' }}>Nama Supplier</th>
              <th style={{ width: '25%' }}>Jumlah Transaksi</th>
              <th style={{ width: '25%' }}>Terakhir Masuk</th>
              <th style={{ width: '10%', textAlign: 'center' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '36px', color: '#94A3B8' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid #CBD5E1', borderTopColor: '#0F172A', animation: 'spin 0.6s linear infinite' }} />
                    <span>Memuat data supplier...</span>
                  </div>
                </td>
              </tr>
            ) : suppliers.length === 0 ? (
              <tr>
                <td colSpan={4} style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
                  <Building2 size={32} style={{ color: '#94A3B8', margin: '0 auto 8px', display: 'block' }} />
                  <span>Belum ada supplier yang tercatat.</span>
                </td>
              </tr>
            ) : (
              suppliers.map((item) => (
                <tr key={item.id}>
                  <td>
                    <div style={{ fontWeight: 600, color: '#0F172A', fontSize: '14.5px' }}>
                      {item.name}
                    </div>
                  </td>
                  <td style={{ color: '#334155', fontSize: '14px' }}>
                    {item.transaction_count ?? 0}
                  </td>
                  <td style={{ color: '#475569', fontSize: '14px' }}>
                    {item.last_restock_date ? formatDateOnly(item.last_restock_date) : '-'}
                  </td>
                  <td style={{ textAlign: 'center' }}>
                    <button
                      onClick={() => openEditModal(item)}
                      style={{
                        padding: '6px',
                        borderRadius: 'var(--radius-sm)',
                        color: '#334155',
                        background: '#F8FAFC',
                        border: '1px solid #E2E8F0',
                        display: 'inline-flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        transition: 'all var(--transition-fast)'
                      }}
                      className="action-btn-edit"
                      title="Ubah Nama Supplier"
                    >
                      <Edit2 size={13} />
                    </button>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Modal Edit Nama Supplier */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Ubah Nama Supplier"
        maxWidth="480px"
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
    </DashboardLayout>
  );
}
