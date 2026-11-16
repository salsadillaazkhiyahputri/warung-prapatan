// @vitest-environment jsdom
// Memastikan render pertama di client identik dengan HTML server untuk semua halaman yang memakai
// DashboardLayout. Skenario yang dulu gagal: server merender tanpa cache login (spinner), lalu
// client yang sudah punya cache sessionStorage langsung merender layout lengkap.
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import React, { act } from 'react';
import { renderToString } from 'react-dom/server';
import { hydrateRoot } from 'react-dom/client';

vi.mock('next/navigation', () => ({
  usePathname: () => '/dashboard',
  useRouter: () => ({ push: vi.fn(), refresh: vi.fn(), replace: vi.fn(), prefetch: vi.fn() })
}));
vi.mock('next/link', () => ({
  default: ({ href, children, prefetch: _p, ...rest }: { href: string; children: React.ReactNode; prefetch?: boolean }) =>
    React.createElement('a', { href, ...rest }, children)
}));

import DashboardPage from '@/app/dashboard/page';
import ProdukPage from '@/app/produk/page';
import SupplierPage from '@/app/supplier/page';
import RiwayatPage from '@/app/riwayat/page';
import OpnamePage from '@/app/opname/page';

const PAGES: [string, React.ComponentType][] = [
  ['/dashboard', DashboardPage],
  ['/produk', ProdukPage],
  ['/supplier', SupplierPage],
  ['/riwayat', RiwayatPage],
  ['/opname', OpnamePage]
];

const HYDRATION_RE = /hydrat|did not match|server rendered|Text content does not match/i;

beforeEach(() => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  // Semua fetch "menggantung": yang diuji hanya render pertama + hidrasi.
  vi.stubGlobal('fetch', vi.fn(() => new Promise(() => {})));
  sessionStorage.clear();
});
afterEach(() => {
  vi.unstubAllGlobals();
  document.body.innerHTML = '';
});

describe('hidrasi DashboardLayout', () => {
  for (const [path, Page] of PAGES) {
    it(`${path}: render pertama client sama dengan server`, async () => {
      // 1) "Server": belum ada cache login.
      const html = renderToString(<Page />);
      expect(html).toContain('Memuat Warung Prapatan');

      // 2) "Client": tab ini sudah pernah terverifikasi login.
      sessionStorage.setItem('wp_authenticated', 'true');
      const container = document.createElement('div');
      container.innerHTML = html;
      document.body.appendChild(container);

      const recoverable: unknown[] = [];
      const consoleErrors: string[] = [];
      const spy = vi.spyOn(console, 'error').mockImplementation((...args: unknown[]) => {
        consoleErrors.push(args.map(String).join(' '));
      });

      await act(async () => {
        hydrateRoot(container, <Page />, {
          onRecoverableError: (err) => recoverable.push(err),
          onCaughtError: (err) => recoverable.push(err)
        });
      });
      spy.mockRestore();

      expect(recoverable).toEqual([]);
      expect(consoleErrors.filter((m) => HYDRATION_RE.test(m))).toEqual([]);
      // Setelah mount, cache dibaca di useEffect dan isi halaman tampil tanpa menunggu /api/auth/me.
      expect(container.querySelector('aside')).not.toBeNull();
      expect(container.textContent).not.toContain('Memuat Warung Prapatan');
    });
  }
});
