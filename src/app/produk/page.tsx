'use client';

import React, { useState, useEffect, useMemo } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Modal } from '@/components/ui/Modal';
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

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

const DEFAULT_CATEGORIES = [
  'Makanan',
  'Minuman',
  'Bumbu',
  'Perlengkapan',
  'Sembako',
  'Mie',
  'Sabun',
  'Lainnya'
];

export default function ProdukPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua Kategori');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Form states
  const [formData, setFormData] = useState({
    name: '',
    category: 'Makanan',
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
      if (selectedCategory !== 'Semua Kategori' && selectedCategory !== 'Semua') {
        params.append('category', selectedCategory);
      }
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

  // Dinamis kategori untuk dropdown filter
  const categoryOptions = useMemo(() => {
    const list = new Set<string>(DEFAULT_CATEGORIES);
    products.forEach((p) => {
      if (p.category) list.add(p.category);
    });
    return Array.from(list);
  }, [products]);

  // Format status terakhir dihitung stok opname
  const formatLastCounted = (dateStr?: string | null) => {
    if (!dateStr) {
      return { text: 'Belum pernah', isUrgent: true };
    }
    const diffMs = Date.now() - new Date(dateStr).getTime();
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
    const isUrgent = diffMs > FOURTEEN_DAYS_MS;

    if (diffDays <= 0) return { text: 'Hari ini', isUrgent: false };
    if (diffDays === 1) return { text: 'Kemarin', isUrgent: false };
    return { text: `${diffDays} hari lalu`, isUrgent };
  };

  // 1. Tambah Produk
  const openAddModal = () => {
    setFormData({
      name: '',
      category: 'Makanan',
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
    if (!formData.category.trim()) {
      setFormError('Kategori produk wajib diisi');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(formData)
      });

      const json = await res.json();
      if (!res.ok) {
        setFormError(json.error || 'Gagal menambahkan produk');
      } else {
        setIsAddModalOpen(false);
        showToast('Produk berhasil ditambahkan');
        fetchProducts();
      }
    } catch {
      setFormError('Terjadi kesalahan jaringan');
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
      unit: product.unit || 'pcs',
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

      const json = await res.json();
      if (!res.ok) {
        setFormError(json.error || 'Gagal memperbarui produk');
      } else {
        setIsEditModalOpen(false);
        showToast('Data produk berhasil diperbarui');
        fetchProducts();
      }
    } catch {
      setFormError('Terjadi kesalahan jaringan');
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
        showToast('Produk berhasil dihapus');
        fetchProducts();
      } else {
        const json = await res.json();
        alert(json.error || 'Gagal menghapus produk');
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
      subtitle="Katalog barang toko, stok saat ini (pcs), dan kapan terakhir dihitung lewat stok opname"
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
              style={{ paddingLeft: '38px', height: '40px', fontSize: '14px' }}
              placeholder="Cari produk..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </form>

          {/* Category Dropdown */}
          <div style={{ width: '170px' }}>
            <select
              className="form-select"
              style={{ height: '40px', fontSize: '14px' }}
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            >
              <option value="Semua Kategori">Semua Kategori</option>
              {categoryOptions.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
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

      {/* Tabel Data Produk Sesuai Desain Mockup */}
      <div className="table-container">
        <table className="data-table">
          <thead>
            <tr>
              <th style={{ width: '32%' }}>NAMA</th>
              <th style={{ width: '22%' }}>KATEGORI</th>
              <th style={{ width: '18%' }}>STOK</th>
              <th style={{ width: '18%' }}>TERAKHIR DIHITUNG</th>
              <th style={{ width: '10%', textAlign: 'center' }}>AKSI</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '36px', color: '#94A3B8' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid #CBD5E1', borderTopColor: '#0F172A', animation: 'spin 0.6s linear infinite' }} />
                    <span>Memuat data produk...</span>
                  </div>
                </td>
              </tr>
            ) : products.length === 0 ? (
              <tr>
                <td colSpan={5} style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
                  <Boxes size={32} style={{ color: '#94A3B8', margin: '0 auto 8px', display: 'block' }} />
                  <span>Tidak ada produk yang sesuai.</span>
                </td>
              </tr>
            ) : (
              products.map((item) => {
                const isLowStock = item.stock_current <= item.stock_minimum;
                const lastCount = formatLastCounted(item.last_counted_at);

                return (
                  <tr key={item.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0F172A', fontSize: '14.5px' }}>
                        {item.name}
                      </div>
                    </td>
                    <td style={{ color: '#475569', fontSize: '14px' }}>
                      {item.category}
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '14px',
                          fontWeight: isLowStock ? 700 : 500,
                          color: isLowStock ? '#DC2626' : '#0F172A'
                        }}
                      >
                        {item.stock_current} pcs
                      </span>
                    </td>
                    <td>
                      <span
                        style={{
                          fontSize: '14px',
                          fontWeight: lastCount.isUrgent ? 700 : 400,
                          color: lastCount.isUrgent ? '#DC2626' : '#64748B'
                        }}
                      >
                        {lastCount.text}
                      </span>
                    </td>
                    <td style={{ textAlign: 'center' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
                        <button
                          onClick={() => openEditModal(item)}
                          style={{
                            padding: '6px',
                            borderRadius: 'var(--radius-sm)',
                            color: '#475569',
                            background: '#FFFFFF',
                            border: '1px solid #E2E8F0',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            cursor: 'pointer',
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
                            cursor: 'pointer',
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
        maxWidth="520px"
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
                {DEFAULT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Satuan Eceran *</label>
              <input
                type="text"
                className="form-input"
                placeholder="pcs"
                value={formData.unit}
                onChange={(e) => setFormData({ ...formData, unit: e.target.value })}
                required
              />
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">Stok Awal (pcs)</label>
              <input
                type="number"
                min={0}
                className="form-input"
                value={formData.stock_current}
                onChange={(e) => setFormData({ ...formData, stock_current: parseInt(e.target.value, 10) || 0 })}
              />
            </div>

            <div className="form-group">
              <label className="form-label">Batas Minimum Stok (pcs) *</label>
              <input
                type="number"
                min={0}
                className="form-input"
                value={formData.stock_minimum}
                onChange={(e) => setFormData({ ...formData, stock_minimum: parseInt(e.target.value, 10) || 0 })}
                required
              />
            </div>
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
        maxWidth="520px"
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
                {DEFAULT_CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
            </div>

            <div className="form-group">
              <label className="form-label">Satuan Ecer *</label>
              <input
                type="text"
                className="form-input"
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
                placeholder="24"
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
                className="form-input"
                value={formData.stock_current}
                disabled
                style={{
                  background: '#F8FAFC',
                  color: '#64748B',
                  borderColor: '#E2E8F0',
                  cursor: 'not-allowed'
                }}
              />
              <p style={{ fontSize: '11.5px', color: '#64748B', marginTop: '5px', lineHeight: 1.3 }}>
                Stok diubah lewat Riwayat &rarr; Catat Manual.
              </p>
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
        maxWidth="440px"
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
          <h4 style={{ fontSize: '16px', fontWeight: 700, color: '#0F172A' }}>
            Hapus produk ini?
          </h4>
          <p style={{ fontSize: '13.5px', color: '#64748B', marginTop: '6px', lineHeight: 1.45 }}>
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
