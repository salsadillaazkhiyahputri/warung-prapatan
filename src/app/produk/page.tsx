'use client';

import React, { useState, useEffect } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Product } from '@/types';
import {
  Plus,
  Search,
  Edit2,
  Trash2,
  AlertCircle,
  CheckCircle2,
  RefreshCw,
  Boxes
} from 'lucide-react';

const CATEGORIES = ['Semua', 'Mie', 'Sabun', 'Bumbu', 'Minuman', 'Sembako'];

export default function ProdukPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    category: 'Mie',
    unit: 'pcs',
    qty_per_karton: null as number | null,
    stock_current: 0,
    stock_minimum: 10
  });

  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const fetchProducts = async () => {
    setIsLoading(true);
    try {
      let url = '/api/products';
      const params = new URLSearchParams();
      if (searchQuery) params.append('q', searchQuery);
      if (selectedCategory !== 'Semua') params.append('category', selectedCategory);
      if (params.toString()) url += `?${params.toString()}`;

      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [selectedCategory]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    fetchProducts();
  };

  const showToast = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(''), 3000);
  };

  // 1. Tambah Produk
  const openAddModal = () => {
    setFormData({
      name: '',
      category: 'Mie',
      unit: 'pcs',
      qty_per_karton: null,
      stock_current: 0,
      stock_minimum: 10
    });
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    if (!formData.name.trim()) {
      setFormError('Nama produk wajib diisi');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Gagal menambahkan produk');
        setIsSaving(false);
        return;
      }

      setIsAddModalOpen(false);
      showToast(`Produk "${formData.name}" berhasil ditambahkan`);
      fetchProducts();
    } catch {
      setFormError('Terjadi kesalahan pada server');
    } finally {
      setIsSaving(false);
    }
  };

  // 2. Edit Produk
  const openEditModal = (product: Product) => {
    setSelectedProduct(product);
    setFormData({
      name: product.name,
      category: product.category,
      unit: product.unit,
      qty_per_karton: product.qty_per_karton,
      stock_current: product.stock_current,
      stock_minimum: product.stock_minimum
    });
    setFormError('');
    setIsEditModalOpen(true);
  };

  const handleEditSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedProduct) return;
    setFormError('');

    if (!formData.name.trim()) {
      setFormError('Nama produk wajib diisi');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/products/${selectedProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Gagal memperbarui produk');
        setIsSaving(false);
        return;
      }

      setIsEditModalOpen(false);
      showToast(`Produk "${formData.name}" berhasil diperbarui`);
      fetchProducts();
    } catch {
      setFormError('Terjadi kesalahan pada server');
    } finally {
      setIsSaving(false);
    }
  };

  // 3. Hapus Produk
  const openDeleteModal = (product: Product) => {
    setSelectedProduct(product);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteConfirm = async () => {
    if (!selectedProduct) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/products/${selectedProduct.id}`, {
        method: 'DELETE'
      });

      if (res.ok) {
        setIsDeleteModalOpen(false);
        showToast(`Produk "${selectedProduct.name}" berhasil dihapus`);
        fetchProducts();
      } else {
        alert('Gagal menghapus produk');
      }
    } catch {
      alert('Terjadi kesalahan saat menghapus');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <DashboardLayout
      title="Produk"
      subtitle="Katalog barang toko, stok saat ini, dan konversi satuan karton"
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

      {/* Toolbar: Search, Category Dropdown & Action Buttons */}
      <div className="page-header-box" style={{ marginBottom: '22px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', flex: '1', maxWidth: '640px', flexWrap: 'wrap' }}>
          <form
            onSubmit={handleSearchSubmit}
            style={{
              position: 'relative',
              flex: '1',
              minWidth: '220px'
            }}
          >
            <span
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform: 'translateY(-50%)',
                color: '#94A3B8',
                display: 'flex',
                alignItems: 'center'
              }}
            >
              <Search size={15} />
            </span>
            <input
              type="text"
              className="form-input"
              style={{ paddingLeft: '38px', height: '38px', fontSize: '13.5px' }}
              placeholder="Cari produk..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </form>

          {/* Category Dropdown */}
          <div style={{ width: '160px' }}>
            <select
              className="form-select"
              style={{ height: '38px', fontSize: '13px' }}
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="Semua">Semua Kategori</option>
              <option value="Sembako">Sembako</option>
              <option value="Minuman">Minuman</option>
              <option value="Mie">Mie</option>
              <option value="Bumbu">Bumbu</option>
              <option value="Sabun">Sabun</option>
            </select>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            onClick={fetchProducts}
            className="btn btn-secondary btn-sm"
            title="Segarkan Data"
          >
            <RefreshCw size={14} className={isLoading ? 'pulse' : ''} />
            <span>Segarkan</span>
          </button>

          <button onClick={openAddModal} className="btn btn-primary btn-sm">
            <Plus size={15} />
            <span>Tambah produk</span>
          </button>
        </div>
      </div>

      {/* Tabel Data Produk Sesuai Proposal */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '32%' }}>Nama</th>
              <th style={{ width: '18%' }}>Kategori</th>
              <th style={{ width: '14%' }}>Satuan</th>
              <th style={{ width: '16%' }}>Per karton</th>
              <th style={{ width: '12%' }}>Stok</th>
              <th style={{ width: '80px', textAlign: 'center' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: '#94A3B8' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid #CBD5E1', borderTopColor: '#0F172A', animation: 'spin 0.6s linear infinite' }} />
                    <span>Memuat data produk...</span>
                  </div>
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
                  <Boxes size={32} style={{ color: '#94A3B8', margin: '0 auto 8px', display: 'block' }} />
                  <span>Tidak ada produk yang sesuai.</span>
                </td>
              </tr>
            ) : (
              products.map((item) => {
                const isLowStock = item.stock_current <= item.stock_minimum;

                return (
                  <tr key={item.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0F172A', fontSize: '13.5px' }}>
                        {item.name}
                      </div>
                    </td>
                    <td style={{ color: '#334155', fontSize: '13px' }}>
                      {item.category}
                    </td>
                    <td style={{ color: '#475569', fontSize: '13px' }}>
                      {item.unit}
                    </td>
                    <td style={{ color: '#475569', fontSize: '13px' }}>
                      {item.qty_per_karton ?? '-'}
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '14px',
                          fontWeight: isLowStock ? 700 : 500,
                          color: isLowStock ? '#DC2626' : '#0F172A'
                        }}
                      >
                        {item.stock_current}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <button
                          onClick={() => openEditModal(item)}
                          style={{
                            padding: '6px',
                            borderRadius: 'var(--radius-sm)',
                            color: '#334155',
                            background: '#F8FAFC',
                            border: '1px solid #E2E8F0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all var(--transition-fast)'
                          }}
                          className="action-btn-edit"
                          title="Edit Produk"
                        >
                          <Edit2 size={13} />
                        </button>
                        <button
                          onClick={() => openDeleteModal(item)}
                          style={{
                            padding: '6px',
                            borderRadius: 'var(--radius-sm)',
                            color: '#DC2626',
                            background: '#FEF2F2',
                            border: '1px solid #FECACA',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            transition: 'all var(--transition-fast)'
                          }}
                          className="action-btn-delete"
                          title="Hapus Produk"
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* MODAL 1: Tambah Produk */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Tambah Produk Baru"
        maxWidth="500px"
      >
        <form onSubmit={handleAddSubmit}>
          {formError && (
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
              <span>{formError}</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Nama Produk *</label>
            <input
              type="text"
              className="form-input"
              placeholder="Contoh: Indomie Goreng"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Kategori *</label>
              <select
                className="form-select"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                <option value="Mie">Mie</option>
                <option value="Sabun">Sabun</option>
                <option value="Bumbu">Bumbu</option>
                <option value="Minuman">Minuman</option>
                <option value="Sembako">Sembako</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Satuan Eceran *</label>
              <input
                type="text"
                className="form-input"
                placeholder="pcs / bungkus / botol"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Isi per Karton</label>
              <input
                type="number"
                min={1}
                className="form-input"
                placeholder="Opsional (misal: 40)"
                value={formData.qty_per_karton ?? ''}
                onChange={(e) => setFormData({
                  ...formData,
                  qty_per_karton: e.target.value ? parseInt(e.target.value, 10) : null
                })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Stok Awal ({formData.unit})</label>
              <input
                type="number"
                min={0}
                className="form-input"
                value={formData.stock_current}
                onChange={(e) => setFormData({ ...formData, stock_current: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Batas Minimum Stok ({formData.unit}) *</label>
            <input
              type="number"
              min={0}
              className="form-input"
              value={formData.stock_minimum}
              onChange={(e) => setFormData({ ...formData, stock_minimum: parseInt(e.target.value, 10) || 0 })}
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
              onClick={() => setIsAddModalOpen(false)}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSaving}
            >
              {isSaving ? 'Menyimpan...' : 'Simpan Produk'}
            </button>
          </div>
        </form>
      </Modal>

      {/* MODAL 2: Edit Produk */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Ubah Data Produk"
        maxWidth="500px"
      >
        <form onSubmit={handleEditSubmit}>
          {formError && (
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
              <span>{formError}</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label">Nama Produk *</label>
            <input
              type="text"
              className="form-input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              required
            />
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Kategori *</label>
              <select
                className="form-select"
                value={formData.category}
                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
              >
                <option value="Mie">Mie</option>
                <option value="Sabun">Sabun</option>
                <option value="Bumbu">Bumbu</option>
                <option value="Minuman">Minuman</option>
                <option value="Sembako">Sembako</option>
                <option value="Lainnya">Lainnya</option>
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Satuan Eceran *</label>
              <input
                type="text"
                className="form-input"
                placeholder="pcs / bungkus / botol"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Isi per Karton</label>
              <input
                type="number"
                min={1}
                className="form-input"
                value={formData.qty_per_karton ?? ''}
                onChange={(e) => setFormData({
                  ...formData,
                  qty_per_karton: e.target.value ? parseInt(e.target.value, 10) : null
                })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Stok Saat Ini ({formData.unit})</label>
              <input
                type="number"
                min={0}
                className="form-input"
                value={formData.stock_current}
                onChange={(e) => setFormData({ ...formData, stock_current: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Batas Minimum Stok ({formData.unit}) *</label>
            <input
              type="number"
              min={0}
              className="form-input"
              value={formData.stock_minimum}
              onChange={(e) => setFormData({ ...formData, stock_minimum: parseInt(e.target.value, 10) || 0 })}
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

      {/* MODAL 3: Konfirmasi Hapus Produk */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Konfirmasi Hapus"
        maxWidth="420px"
      >
        <div style={{ textAlign: 'center', padding: '10px 0 20px' }}>
          <div
            style={{
              width: '46px',
              height: '46px',
              borderRadius: 'var(--radius-sm)',
              background: '#FEF2F2',
              border: '1px solid #FECACA',
              color: '#DC2626',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              margin: '0 auto 14px'
            }}
          >
            <Trash2 size={20} />
          </div>
          <h4 style={{ fontSize: '15.5px', fontWeight: 700, color: '#0F172A' }}>
            Hapus produk ini?
          </h4>
          <p style={{ fontSize: '13px', color: '#64748B', marginTop: '6px', lineHeight: 1.45 }}>
            Produk &quot;{selectedProduct?.name}&quot; beserta riwayat terkait akan dihapus dari sistem.
          </p>
        </div>

        <div style={{ display: 'flex', justifyContent: 'center', gap: '10px' }}>
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => setIsDeleteModalOpen(false)}
          >
            Batal
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleDeleteConfirm}
            disabled={isSaving}
          >
            {isSaving ? 'Menghapus...' : 'Ya, Hapus'}
          </button>
        </div>
      </Modal>

      <style jsx global>{`
        .action-btn-edit:hover {
          background: #0F172A !important;
          color: #FFFFFF !important;
          border-color: #0F172A !important;
        }
        .action-btn-delete:hover {
          background: #DC2626 !important;
          color: #FFFFFF !important;
          border-color: #DC2626 !important;
        }
      `}</style>
    </DashboardLayout>
  );
}
