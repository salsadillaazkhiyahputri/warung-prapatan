'use client';

import React, { useEffect, useState } from 'react';
import { DashboardLayout } from '@/components/layout/DashboardLayout';
import { Modal } from '@/components/ui/Modal';
import { Badge, BadgeType } from '@/components/ui/Badge';
import { DEFAULT_CATEGORY, KeluarPerHariRow, OpnameDetail, OpnameItemJenis, OpnameSession, Product } from '@/types';
import { formatDateOnly, formatDateTime } from '@/lib/export-utils';
import { isCountStale, relativeDayLabel } from '@/lib/stock-labels';
import { AlertCircle, ClipboardCheck, Eye, Filter, Info, RefreshCw, RotateCcw, TrendingDown } from 'lucide-react';

type Tab = 'sesi' | 'keluar';

const JENIS_BADGE: Record<OpnameItemJenis, { type: BadgeType; label: string }> = {
  keluar: { type: 'out', label: 'Keluar' },
  koreksi: { type: 'koreksi', label: 'Koreksi' },
  baseline: { type: 'neutral', label: 'Hitung awal' }
};

const labelStyle: React.CSSProperties = {
  display: 'flex', alignItems: 'center', gap: '6px', fontSize: '12.5px', fontWeight: 600, color: '#334155', marginBottom: '6px'
};

export default function OpnamePage() {
  const [sessions, setSessions] = useState<OpnameSession[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [productId, setProductId] = useState('all');

  const [tab, setTab] = useState<Tab>('sesi');

  // Tab 2: rata-rata keluar per hari
  const [kStart, setKStart] = useState('');
  const [kEnd, setKEnd] = useState('');
  const [kCategory, setKCategory] = useState('Semua');
  const [categories, setCategories] = useState<string[]>([DEFAULT_CATEGORY]);
  const [keluarRows, setKeluarRows] = useState<KeluarPerHariRow[]>([]);
  const [keluarRange, setKeluarRange] = useState<{ startDate: string; endDate: string } | null>(null);
  const [isKeluarLoading, setIsKeluarLoading] = useState(false);
  const [keluarError, setKeluarError] = useState('');

  const [detail, setDetail] = useState<OpnameDetail | null>(null);
  const [isDetailOpen, setIsDetailOpen] = useState(false);
  const [isDetailLoading, setIsDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState('');

  const fetchSessions = async () => {
    setIsLoading(true);
    setLoadError('');
    try {
      const params = new URLSearchParams();
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);
      if (productId !== 'all') params.append('productId', productId);
      const res = await fetch(`/api/opname?${params.toString()}`);
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setSessions([]);
        setLoadError(data?.error || 'Gagal memuat riwayat stok opname');
        return;
      }
      setSessions(data);
    } catch {
      setLoadError('Terjadi kesalahan pada server');
    } finally {
      setIsLoading(false);
    }
  };
