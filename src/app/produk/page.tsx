'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Modal } from '@/components/ui/Modal';
import { Badge } from '@/components/ui/Badge';
import { Pagination, usePagination } from '@/components/ui/Pagination';
import { Product, DEFAULT_CATEGORY } from '@/types';
import { relativeDayLabel, isCountStale } from '@/lib/stock-labels';
import { formatDateOnly } from '@/lib/export-utils';
import { otherSuppliersLabel } from '@/lib/product-suppliers';
import { BASE_CATEGORIES, CATEGORY_MAX_LENGTH, normalizeCategory } from '@/lib/categories';
import { getClientCache, setClientCache, invalidateClientCache } from '@/lib/client-cache';

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

const NEEDS_REVIEW_FILTER = 'perlu-dilengkapi';

const EMPTY_FORM = {
  name: '',
  category: DEFAULT_CATEGORY,
  stock_current: 0,
  stock_minimum: 10
};

export default function ProdukPage() {
  const [products, setProducts] = useState<Product[]>(() => {
    return getClientCache<Product[]>('products:all') || [];
  });
  const [isLoading, setIsLoading] = useState(() => {
    return !getClientCache<Product[]>('products:all');
  });
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Semua');
  // Filter "Perlu dilengkapi" (barang dari bot, needs_review). Bisa dibuka dari kartu dashboard
  // lewat /produk?filter=perlu-dilengkapi. URL dibaca di useEffect agar aman untuk hidrasi.
  const [onlyNeedsReview, setOnlyNeedsReview] = useState(false);

  useEffect(() => {
    try {
      if (new URLSearchParams(window.location.search).get('filter') === NEEDS_REVIEW_FILTER) setOnlyNeedsReview(true);
    } catch {
      // abaikan
    }
  }, []);

  const toggleNeedsReview = (on: boolean) => {
    setOnlyNeedsReview(on);
    try {
      const url = new URL(window.location.href);
      if (on) url.searchParams.set('filter', NEEDS_REVIEW_FILTER); else url.searchParams.delete('filter');
      window.history.replaceState(null, '', url.toString());
    } catch {
      // abaikan
    }
  };

  // Modals state
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);

  // Form states
  const [formData, setFormData] = useState(EMPTY_FORM);
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  // Saran kategori di form (daftar tetap + kategori yang pernah dipakai) dan kategori untuk filter
  // (hanya yang dipakai produk aktif). Daftar tetap jadi nilai awal agar saran tidak pernah kosong.
  const [categories, setCategories] = useState<string[]>(() => {
    return getClientCache<string[]>('products:categories') || [...BASE_CATEGORIES];
  });
  const [usedCategories, setUsedCategories] = useState<string[]>(() => {
    return getClientCache<string[]>('products:categories:used') || [];
  });

  const fetchCategories = useCallback(async () => {
    try {
      const [sugRes, usedRes] = await Promise.all([
        fetch('/api/products/categories'),
        fetch('/api/products/categories?scope=used')
      ]);
      if (sugRes.ok) {
        const catData = await sugRes.json();
        setCategories(catData);
        setClientCache('products:categories', catData);
      }
      if (usedRes.ok) {
        const used: string[] = await usedRes.json();
        setUsedCategories(used);
        setClientCache('products:categories:used', used);
        // Kategori terpilih tidak punya produk lagi -> kembali ke "Semua".
        setSelectedCategory((cur) => (cur === 'Semua' || used.includes(cur) ? cur : 'Semua'));
      }
    } catch (err) {
      console.error('Error fetching categories:', err);
    }
  }, []);

  useEffect(() => {
    fetchCategories();
  }, [fetchCategories]);

  // Pratinjau perapian kategori (aturan yang sama dengan server).
  const categoryCheck = normalizeCategory(formData.category, categories);
  const categoryHint = categoryCheck.ok
    ? categoryCheck.value !== formData.category.trim() || !categories.includes(categoryCheck.value)
      ? `Disimpan sebagai "${categoryCheck.value}"${categories.includes(categoryCheck.value) ? '' : ' (kategori baru)'}`
      : ''
    : '';

  const renderCategoryInput = () => (
    <div className="form-group" style={{ marginBottom: '16px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '8px' }}>
        <label className="form-label" style={{ margin: 0, fontWeight: 600, color: '#1E293B', fontSize: '13.5px' }}>
          Kategori *
        </label>
        <button
          type="button"
          onClick={() => {
            const nextMode = !isCustomCategory;
            setIsCustomCategory(nextMode);
            if (nextMode) {
              setFormData((prev) => ({ ...prev, category: '' }));
            } else {
              setFormData((prev) => ({ ...prev, category: categories[0] || DEFAULT_CATEGORY }));
            }
          }}
          style={{
            fontSize: '12px',
            fontWeight: 600,
            color: isCustomCategory ? '#475569' : '#0F172A',
            background: '#F1F5F9',
            border: '1px solid #CBD5E1',
            padding: '3px 10px',
            borderRadius: '6px',
            cursor: 'pointer',
            transition: 'all 0.15s ease'
          }}
        >
          {isCustomCategory ? '← Pilih dari Daftar' : '+ Tambah Kategori Baru'}
        </button>
      </div>

      {!isCustomCategory ? (
        <select
          className="form-select"
          value={categories.includes(formData.category) ? formData.category : DEFAULT_CATEGORY}
          onChange={(e) => setFormData((prev) => ({ ...prev, category: e.target.value }))}
          style={{ height: '42px', fontSize: '14px', borderRadius: '8px', background: '#FFFFFF' }}
          required
        >
          {categories.map((c) => (
            <option key={c} value={c}>{c}</option>
          ))}
        </select>
      ) : (
        <div>
          <input
            type="text"
            className="form-input"
            value={formData.category}
            onChange={(e) => setFormData({ ...formData, category: e.target.value })}
            placeholder="Ketik nama kategori baru..."
            maxLength={CATEGORY_MAX_LENGTH + 10}
            autoFocus
            style={{ height: '42px', fontSize: '14px', borderRadius: '8px', background: '#FFFFFF' }}
            required
          />
        </div>
      )}
      {categoryHint && (
        <p style={{ fontSize: '12px', color: '#64748B', margin: '4px 0 0' }}>{categoryHint}</p>
      )}
    </div>
  );

  // Rapikan kategori di browser sebelum dikirim; server merapikan lagi dengan aturan yang sama.
  const checkCategory = (): string | null => {
    if (!categoryCheck.ok) {
      setFormError(categoryCheck.error);
      return null;
    }
    return categoryCheck.value;
  };

  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [toastMessage, setToastMessage] = useState('');

  const fetchProducts = useCallback(async (silent = false) => {
    if (!silent && products.length === 0) setIsLoading(true);
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
        if (!searchQuery && selectedCategory === 'Semua') {
          setClientCache('products:all', data);
        }
      }
    } catch (err) {
      console.error('Error fetching products:', err);
    } finally {
      setIsLoading(false);
    }
  }, [searchQuery, selectedCategory]);

  useEffect(() => {
    fetchProducts(products.length > 0);

    // Auto-refresh di latar belakang setiap 25 detik & saat tab browser kembali aktif
    const interval = setInterval(() => {
      fetchProducts(true);
    }, 25000);
    const handleFocus = () => {
      fetchProducts(true);
      fetchCategories();
    };
    window.addEventListener('focus', handleFocus);
    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
    };
  }, [fetchProducts, fetchCategories]);

  const needsReviewCount = products.filter((p) => p.needs_review).length;
  const visibleProducts = onlyNeedsReview ? products.filter((p) => p.needs_review) : products;
  const productPagination = usePagination(
    visibleProducts,
    10,
    `${searchQuery}:${selectedCategory}:${onlyNeedsReview}`
  );

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
    setFormData(EMPTY_FORM);
    setIsCustomCategory(false);
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
    const category = checkCategory();
    if (!category) return;

    setIsSaving(true);
    try {
      const res = await fetch('/api/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...formData, category })
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Gagal menambahkan produk');
        setIsSaving(false);
        return;
      }

      setIsAddModalOpen(false);
      invalidateClientCache('products');
      showToast(`Produk "${formData.name}" berhasil ditambahkan`);
      fetchProducts();
      fetchCategories();
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
      stock_current: product.stock_current,
      stock_minimum: product.stock_minimum
    });
    const inList = categories.some((c) => c.toLowerCase() === (product.category || '').toLowerCase());
    setIsCustomCategory(!inList && !!product.category);
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
    const category = checkCategory();
    if (!category) return;

    setIsSaving(true);
    try {
      const res = await fetch(`/api/products/${selectedProduct.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: formData.name, category, stock_minimum: formData.stock_minimum })
      });

      const data = await res.json();
      if (!res.ok) {
        setFormError(data.error || 'Gagal memperbarui produk');
        setIsSaving(false);
        return;
      }

      setIsEditModalOpen(false);
      invalidateClientCache('products');
      showToast(`Produk "${formData.name}" berhasil diperbarui`);
      fetchProducts();
      fetchCategories();
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
        invalidateClientCache('products');
        showToast(`Produk "${selectedProduct.name}" berhasil dihapus`);
        fetchProducts();
        fetchCategories();
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
              placeholder="Cari produk atau supplier..."
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
              {usedCategories.map((c) => (
                <option key={c} value={c}>{c}</option>
              ))}
            </select>
          </div>

          {/* Filter Perlu Dilengkapi sebagai Modern Filter Button */}
          <button
            type="button"
            onClick={() => toggleNeedsReview(!onlyNeedsReview)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              height: '38px',
              padding: '0 14px',
              borderRadius: 'var(--radius-md)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
              transition: 'all var(--transition-fast)',
              background: onlyNeedsReview ? '#FEF2F2' : '#FFFFFF',
              color: onlyNeedsReview ? '#DC2626' : '#475569',
              border: `1.5px solid ${onlyNeedsReview ? '#FCA5A5' : '#E2E8F0'}`,
              boxShadow: onlyNeedsReview ? '0 1px 3px rgba(220, 38, 38, 0.12)' : 'var(--shadow-xs)'
            }}
            title="Filter barang yang didaftarkan lewat bot dan belum dilengkapi"
          >
            <AlertCircle size={15} style={{ color: onlyNeedsReview ? '#DC2626' : '#94A3B8' }} />
            <span>Perlu Dilengkapi</span>
            {needsReviewCount > 0 && (
              <span
                style={{
                  padding: '1px 7px',
                  borderRadius: 'var(--radius-full)',
                  fontSize: '11.5px',
                  fontWeight: 700,
                  background: onlyNeedsReview ? '#DC2626' : '#F1F5F9',
                  color: onlyNeedsReview ? '#FFFFFF' : '#475569'
                }}
              >
                {needsReviewCount}
              </span>
            )}
          </button>
        </div>

        {/* Action Buttons */}
        <div>
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
              <th style={{ width: '28%' }}>Nama</th>
              <th style={{ width: '14%' }}>Kategori</th>
              <th style={{ width: '20%' }} title="Supplier dari stok masuk terakhir. Satu barang bisa datang dari beberapa supplier.">Supplier terakhir</th>
              <th style={{ width: '13%' }}>Stok</th>
              <th style={{ width: '17%' }}>Terakhir dihitung</th>
              <th style={{ width: '80px', textAlign: 'center' }}>Aksi</th>
            </tr>
          </thead>
          <tbody>
            {isLoading && visibleProducts.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '36px', color: '#94A3B8' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
                    <div style={{ width: '16px', height: '16px', borderRadius: '50%', border: '2px solid #CBD5E1', borderTopColor: '#0F172A', animation: 'spin 0.6s linear infinite' }} />
                    <span>Memuat data produk...</span>
                  </div>
                </td>
              </tr>
            ) : visibleProducts.length === 0 ? (
              <tr>
                <td colSpan={6} style={{ textAlign: 'center', padding: '40px', color: '#64748B' }}>
                  <Boxes size={32} style={{ color: '#94A3B8', margin: '0 auto 8px', display: 'block' }} />
                  <span>{onlyNeedsReview ? 'Tidak ada barang yang perlu dilengkapi.' : 'Tidak ada produk yang sesuai.'}</span>
                </td>
              </tr>
            ) : (
              productPagination.pageItems.map((item) => {
                const isLowStock = item.stock_current <= item.stock_minimum;
                const staleCount = isCountStale(item.last_counted_at);
                const countTitle = item.last_counted_at
                  ? `${formatDateOnly(item.last_counted_at)}${item.last_counted_qty != null ? ` · hitungan ${item.last_counted_qty} pcs` : ''}`
                  : 'Belum pernah dihitung lewat stok opname';

                return (
                  <tr key={item.id}>
                    <td>
                      <div style={{ fontWeight: 600, color: '#0F172A', fontSize: '13.5px', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
                        {item.name}
                        {item.needs_review && (
                          <Badge type="warning" title="Didaftarkan lewat bot. Lengkapi kategori dan batas minimum lewat tombol Edit.">
                            Perlu dilengkapi
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td>
                      <span
                        style={{
                          display: 'inline-block',
                          padding: '3px 10px',
                          borderRadius: 'var(--radius-full)',
                          background: '#F1F5F9',
                          border: '1px solid #E2E8F0',
                          fontSize: '12px',
                          fontWeight: 500,
                          color: '#334155'
                        }}
                      >
                        {item.category}
                      </span>
                    </td>
                    <td style={{ fontSize: '13px' }}>
                      {item.last_supplier_name ? (
                        <div>
                          <div style={{ color: '#0F172A', fontWeight: 600, fontSize: '13.5px' }}>
                            {item.last_supplier_name}
                          </div>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '6px', marginTop: '3px', flexWrap: 'wrap' }}>
                            {item.last_in_at && (
                              <span style={{ fontSize: '12px', color: '#64748B' }}>
                                {formatDateOnly(item.last_in_at)}
                              </span>
                            )}
                            {item.last_supplier_active === false && (
                              <span
                                title="Supplier ini sedang dinonaktifkan"
                                style={{
                                  display: 'inline-flex',
                                  alignItems: 'center',
                                  fontSize: '10.5px',
                                  fontWeight: 700,
                                  color: '#DC2626',
                                  background: '#FEF2F2',
                                  border: '1px solid #FECACA',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  lineHeight: 1.2
                                }}
                              >
                                Nonaktif
                              </span>
                            )}
                            {otherSuppliersLabel(item.supplier_count ?? 1) && (
                              <span
                                title={(item.supplier_names ?? []).join(', ')}
                                style={{
                                  fontSize: '10.5px',
                                  color: '#475569',
                                  background: '#F1F5F9',
                                  padding: '1px 6px',
                                  borderRadius: '4px',
                                  cursor: 'help'
                                }}
                              >
                                {otherSuppliersLabel(item.supplier_count ?? 1)}
                              </span>
                            )}
                          </div>
                        </div>
                      ) : (
                        <span style={{ color: '#94A3B8' }} title="Belum pernah ada stok masuk">-</span>
                      )}
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
                    <td
                      title={countTitle}
                      style={{
                        fontSize: '13px',
                        fontWeight: staleCount ? 600 : 400,
                        color: staleCount ? '#DC2626' : '#475569'
                      }}
                    >
                      {relativeDayLabel(item.last_counted_at)}
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
      <Pagination
        currentPage={productPagination.currentPage}
        pageSize={productPagination.pageSize}
        totalItems={productPagination.totalItems}
        onPageChange={productPagination.setCurrentPage}
      />


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
              style={{ height: '42px', fontSize: '14px', borderRadius: '8px' }}
              required
            />
          </div>

          {renderCategoryInput()}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '8px' }}>
            <div className="form-group">
              <label className="form-label">Stok Awal (pcs)</label>
              <input
                type="number"
                min={0}
                className="form-input"
                value={formData.stock_current}
                onChange={(e) => setFormData({ ...formData, stock_current: parseInt(e.target.value, 10) || 0 })}
                style={{ height: '42px', fontSize: '14px', borderRadius: '8px' }}
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
                style={{ height: '42px', fontSize: '14px', borderRadius: '8px' }}
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
              style={{ height: '42px', padding: '0 18px', fontSize: '14px' }}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSaving}
              style={{ height: '42px', padding: '0 20px', fontSize: '14px' }}
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
          {selectedProduct?.needs_review && (
            <div style={{ padding: '10px 14px', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 'var(--radius-sm)', color: '#92400E', fontSize: '12.5px', marginBottom: '16px', lineHeight: 1.45 }}>
              Barang baru dari bot. Periksa nama, kategori (&quot;Lainnya&quot; boleh), dan batas minimum. Tanda &quot;Perlu dilengkapi&quot; hilang otomatis setelah disimpan.
            </div>
          )}
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

          {renderCategoryInput()}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '8px' }}>
            <div className="form-group">
              <label className="form-label">Batas Minimum Stok (pcs) *</label>
              <input
                type="number"
                min={0}
                className="form-input"
                value={formData.stock_minimum}
                onChange={(e) => setFormData({ ...formData, stock_minimum: parseInt(e.target.value, 10) || 0 })}
                style={{ height: '42px', fontSize: '14px', borderRadius: '8px' }}
                required
              />
            </div>

            <div className="form-group">
              <label className="form-label">Stok Saat Ini (pcs)</label>
              <input
                type="number"
                className="form-input"
                value={formData.stock_current}
                disabled
                readOnly
                title="Stok hanya berubah lewat transaksi atau stok opname"
                style={{ height: '42px', fontSize: '14px', borderRadius: '8px', background: '#F1F5F9', color: '#64748B', cursor: 'not-allowed' }}
              />
            </div>
          </div>
          <p style={{ fontSize: '12px', color: '#64748B', margin: '0 0 16px' }}>
            * Stok saat ini diubah lewat menu Riwayat Transaksi atau stok opname Telegram.
          </p>

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
              style={{ height: '42px', padding: '0 18px', fontSize: '14px' }}
            >
              Batal
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={isSaving}
              style={{ height: '42px', padding: '0 20px', fontSize: '14px' }}
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
            Produk &quot;{selectedProduct?.name}&quot; akan dinonaktifkan. Riwayat transaksinya tetap tersimpan.
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
