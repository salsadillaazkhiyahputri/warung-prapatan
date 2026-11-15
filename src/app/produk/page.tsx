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
  Clock
} from 'lucide-react';

const FOURTEEN_DAYS_MS = 14 * 24 * 60 * 60 * 1000;

export default function ProdukPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Form states (tanpa supplier dan tanpa karton)
  const [formData, setFormData] = useState({
    name: '',
    category: 'Makanan',
    customCategory: '',
    stock_current: 0,
    stock_minimum: 10
  });

  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  };

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
    fetchCategories();
  }, []);

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
      category: categories[0] || 'Makanan',
      customCategory: '',
      stock_current: 0,
      stock_minimum: 10
    });
    setFormError('');
    setIsAddModalOpen(true);
  };

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const resolvedCategory =
      formData.category === 'Lainnya' ? formData.customCategory.trim() : formData.category;

    if (!formData.name.trim()) {
      setFormError('Nama produk wajib diisi');
      return;
    }
    if (!resolvedCategory) {
      setFormError('Kategori produk wajib diisi');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          category: resolvedCategory,
          unit: 'pcs',
          stock_current: formData.stock_current,
          stock_minimum: formData.stock_minimum
        })
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
      fetchCategories();
    } catch {
      setFormError('Terjadi kesalahan pada server');
    } finally {
      setIsSaving(false);
    }
  };

  // 2. Edit Produk (Stok TIDAK BISA diubah)
  const openEditModal = (product: Product) => {
    setSelectedProduct(product);
    const isStandardCat = categories.includes(product.category);
    setFormData({
      name: product.name,
      category: isStandardCat ? product.category : 'Lainnya',
      customCategory: isStandardCat ? '' : product.category,
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

    const resolvedCategory =
      formData.category === 'Lainnya' ? formData.customCategory.trim() : formData.category;

    if (!formData.name.trim()) {
      setFormError('Nama produk wajib diisi');
      return;
    }
    if (!resolvedCategory) {
      setFormError('Kategori produk wajib diisi');
      return;
    }

    setIsSaving(true);
    try {
      const res = await fetch(`/api/products/${selectedProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name.trim(),
          category: resolvedCategory,
          stock_minimum: formData.stock_minimum
        })
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
      fetchCategories();
    } catch {
      setFormError('Terjadi kesalahan pada server');
    } finally {
      setIsSaving(false);
    }
  };

  // 3. Hapus (Nonaktifkan) Produk
  const openDeleteModal = (product: Product) => {
    setSelectedProduct(product);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteSubmit = async () => {
    if (!selectedProduct) return;
    setIsSaving(true);
    try {
      const res = await fetch(`/api/products/${selectedProduct.id}`, {
        method: 'DELETE'
      });

      if (!res.ok) {
        const data = await res.json();
        alert(data.error || 'Gagal menghapus produk');
        setIsSaving(false);
        return;
      }

      setIsDeleteModalOpen(false);
      showToast(`Produk "${selectedProduct.name}" berhasil dinonaktifkan`);
      fetchProducts();
    } catch {
      alert('Terjadi kesalahan pada server');
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

      {/* Control Box: Search, Filter, Add */}
      <div className="page-header-box" style={{ marginBottom: '20px' }}>
        <form onSubmit={handleSearchSubmit} style={{ display: 'flex', gap: '10px', flex: 1, maxWidth: '520px' }}>
          <div style={{ position: 'relative', flex: 1 }}>
            <span style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#94A3B8' }}>
              <Search size={16} />
            </span>
            <input
              type="text"
              className="input"
              style={{ paddingLeft: '38px', height: '38px' }}
              placeholder="Cari produk..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <select
            className="input"
            style={{ width: '180px', height: '38px' }}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          >
            <option value="Semua">Semua Kategori</option>
            {categories.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        </form>

        <div style={{ display: 'flex', gap: '8px' }}>
          <button onClick={fetchProducts} className="btn btn-secondary btn-sm" title="Segarkan Data">
            <RefreshCw size={14} className={isLoading ? 'pulse' : ''} />
            <span>Segarkan</span>
          </button>
          <button onClick={openAddModal} className="btn btn-primary btn-sm">
            <Plus size={16} />
            <span>Tambah produk</span>
          </button>
        </div>
      </div>

      {/* Tabel Produk Utama: Nama, Kategori, Stok (pcs), Terakhir dihitung, Aksi */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="table-container">
          <table className="table">
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
                  <td colSpan={5} style={{ textAlign: 'center', padding: '48px', color: '#94A3B8' }}>
                    Memuat katalog produk...
                  </td>
                </tr>
              ) : products.length === 0 ? (
                <tr>
                  <td colSpan={5} style={{ textAlign: 'center', padding: '48px', color: '#64748B' }}>
                    Tidak ada produk ditemukan.
                  </td>
                </tr>
              ) : (
                products.map((product) => {
                  const lastCount = formatLastCounted(product.last_counted_at);
                  const isLow = product.stock_current <= product.stock_minimum;

                  return (
                    <tr key={product.id}>
                      <td style={{ fontWeight: 600, color: '#0F172A' }}>
                        {product.name}
                      </td>
                      <td style={{ color: '#475569' }}>
                        {product.category}
                      </td>
                      <td>
                        <span
                          style={{
                            fontWeight: 600,
                            color: isLow ? '#DC2626' : '#0F172A'
                          }}
                        >
                          {product.stock_current} pcs
                        </span>
                      </td>
                      <td>
                        <span
                          style={{
                            fontSize: '13px',
                            fontWeight: lastCount.isUrgent ? 600 : 500,
                            color: lastCount.isUrgent ? '#DC2626' : '#475569'
                          }}
                        >
                          {lastCount.text}
                        </span>
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <div style={{ display: 'inline-flex', gap: '6px' }}>
                          <button
                            onClick={() => openEditModal(product)}
                            className="btn-icon"
                            title="Ubah Produk"
                          >
                            <Edit2 size={15} />
                          </button>
                          <button
                            onClick={() => openDeleteModal(product)}
                            className="btn-icon btn-icon-danger"
                            title="Nonaktifkan Produk"
                          >
                            <Trash2 size={15} />
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
      </div>

      {/* Modal Tambah Produk (Tanpa Supplier & Tanpa Karton) */}
      <Modal
        isOpen={isAddModalOpen}
        onClose={() => setIsAddModalOpen(false)}
        title="Tambah Produk Baru"
        subtitle="Daftarkan barang baru ke dalam sistem katalog toko"
      >
        <form onSubmit={handleAddSubmit}>
          {formError && (
            <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
              <AlertCircle size={16} />
              <span>{formError}</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="add-name">
              Nama Produk <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input
              id="add-name"
              type="text"
              className="input"
              placeholder="Contoh: Indomie Goreng"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              maxLength={100}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="add-category">
              Kategori <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <select
              id="add-category"
              className="input"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value="Lainnya">+ Tambah Kategori Baru</option>
            </select>
          </div>

          {formData.category === 'Lainnya' && (
            <div className="form-group">
              <label className="form-label" htmlFor="add-custom-cat">
                Nama Kategori Baru <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input
                id="add-custom-cat"
                type="text"
                className="input"
                placeholder="Contoh: Biskuit"
                value={formData.customCategory}
                onChange={(e) => setFormData({ ...formData, customCategory: e.target.value })}
                maxLength={50}
                required
              />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label" htmlFor="add-stock">
                Stok Awal (pcs)
              </label>
              <input
                id="add-stock"
                type="number"
                className="input"
                min={0}
                max={10000000}
                value={formData.stock_current}
                onChange={(e) => setFormData({ ...formData, stock_current: parseInt(e.target.value, 10) || 0 })}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="add-min">
                Batas Minimum (pcs)
              </label>
              <input
                id="add-min"
                type="number"
                className="input"
                min={0}
                max={10000000}
                value={formData.stock_minimum}
                onChange={(e) => setFormData({ ...formData, stock_minimum: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
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
              {isSaving ? 'Menyimpan...' : 'Simpan Produk'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Ubah Produk (Stok Tidak Bisa Diubah) */}
      <Modal
        isOpen={isEditModalOpen}
        onClose={() => setIsEditModalOpen(false)}
        title="Ubah Produk"
        subtitle="Perbarui nama produk, kategori, atau batas stok minimum"
      >
        <form onSubmit={handleEditSubmit}>
          {formError && (
            <div className="alert alert-danger" style={{ marginBottom: '16px' }}>
              <AlertCircle size={16} />
              <span>{formError}</span>
            </div>
          )}

          <div className="form-group">
            <label className="form-label" htmlFor="edit-name">
              Nama Produk <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <input
              id="edit-name"
              type="text"
              className="input"
              value={formData.name}
              onChange={(e) => setFormData({ ...formData, name: e.target.value })}
              maxLength={100}
              required
            />
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="edit-category">
              Kategori <span style={{ color: '#DC2626' }}>*</span>
            </label>
            <select
              id="edit-category"
              className="input"
              value={formData.category}
              onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
              <option value="Lainnya">+ Tambah Kategori Baru</option>
            </select>
          </div>

          {formData.category === 'Lainnya' && (
            <div className="form-group">
              <label className="form-label" htmlFor="edit-custom-cat">
                Nama Kategori Baru <span style={{ color: '#DC2626' }}>*</span>
              </label>
              <input
                id="edit-custom-cat"
                type="text"
                className="input"
                placeholder="Contoh: Kebutuhan Rumah"
                value={formData.customCategory}
                onChange={(e) => setFormData({ ...formData, customCategory: e.target.value })}
                maxLength={50}
                required
              />
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '14px' }}>
            <div className="form-group">
              <label className="form-label">
                Stok Saat Ini (Terkunci)
              </label>
              <input
                type="text"
                className="input"
                disabled
                value={`${formData.stock_current} pcs (perubahan lewat transaksi/opname)`}
                style={{ background: '#F1F5F9', color: '#64748B', cursor: 'not-allowed' }}
              />
            </div>

            <div className="form-group">
              <label className="form-label" htmlFor="edit-min">
                Batas Minimum (pcs)
              </label>
              <input
                id="edit-min"
                type="number"
                className="input"
                min={0}
                max={10000000}
                value={formData.stock_minimum}
                onChange={(e) => setFormData({ ...formData, stock_minimum: parseInt(e.target.value, 10) || 0 })}
              />
            </div>
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
              {isSaving ? 'Menyimpan...' : 'Perbarui Produk'}
            </button>
          </div>
        </form>
      </Modal>

      {/* Modal Konfirmasi Nonaktifkan Produk */}
      <Modal
        isOpen={isDeleteModalOpen}
        onClose={() => setIsDeleteModalOpen(false)}
        title="Nonaktifkan Produk"
        subtitle="Produk akan disembunyikan dari daftar, riwayat transaksi tetap terjaga"
      >
        <p style={{ fontSize: '14px', color: '#475569', lineHeight: 1.6 }}>
          Apakah Anda yakin ingin menonaktifkan produk{' '}
          <strong style={{ color: '#0F172A' }}>{selectedProduct?.name}</strong>?
        </p>

        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px', marginTop: '24px' }}>
          <button
            type="button"
            onClick={() => setIsDeleteModalOpen(false)}
            className="btn btn-secondary"
            disabled={isSaving}
          >
            Batal
          </button>
          <button
            type="button"
            onClick={handleDeleteSubmit}
            className="btn btn-danger"
            disabled={isSaving}
          >
            {isSaving ? 'Menonaktifkan...' : 'Ya, Nonaktifkan'}
          </button>
        </div>
      </Modal>
    </DashboardLayout>
  );
}
