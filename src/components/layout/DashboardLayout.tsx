'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Header } from './Header';
import { readAuthCache, writeAuthCache, hasAppHydrated, markAppHydrated } from './auth-cache';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  title,
  subtitle
}) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  // Selalu mulai dari spinner saat hidrasi pertama, tetapi saat navigasi antar-halaman (SPA),
  // langsung true jika tab sudah terverifikasi sehingga perpindahan menu instan tanpa kedipan!
  const [isAuthReady, setIsAuthReady] = useState(() => {
    if (typeof window !== 'undefined' && hasAppHydrated() && readAuthCache()) {
      return true;
    }
    return false;
  });
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    markAppHydrated();
    let cancelled = false;

    // Sudah terverifikasi di tab ini: tampilkan isi segera, verifikasi ulang di latar belakang.
    if (readAuthCache()) setIsAuthReady(true);

    const fail = () => {
      if (cancelled) return;
      writeAuthCache(false);
      router.push('/login');
    };

    fetch('/api/auth/me', { cache: 'no-store' })
      .then((res) => {
        if (cancelled) return;
        if (!res.ok) return fail();
        writeAuthCache(true);
        setIsAuthReady(true);
      })
      .catch(fail);

    return () => {
      cancelled = true;
    };
  }, [router]);

  return (
    <div className="app-container">
      <Sidebar
        isMobileOpen={isMobileOpen}
        onCloseMobile={() => setIsMobileOpen(false)}
      />

      <div className="main-content">
        <Header
          onToggleMobileMenu={() => setIsMobileOpen(prev => !prev)}
          title={title}
          subtitle={subtitle}
        />

        {isAuthReady ? (
          <main className="page-wrapper">
            <div key={pathname} className="page-route-motion">
              {children}
            </div>
          </main>
        ) : (
          <main className="page-wrapper" aria-busy="true">
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                minHeight: '50vh',
                color: '#64748B',
                gap: '14px'
              }}
            >
              <div
                style={{
                  width: '32px',
                  height: '32px',
                  borderRadius: '50%',
                  border: '2.5px solid #E2E8F0',
                  borderTopColor: '#0F172A',
                  animation: 'spin 0.7s linear infinite'
                }}
              />
              <p style={{ fontSize: '13px', fontWeight: 500 }}>Memuat Warung Prapatan...</p>
            </div>
          </main>
        )}
      </div>

      <style jsx global>{`
        @media (max-width: 768px) {
          .mobile-toggle-btn {
            display: flex !important;
          }
          .date-pill {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
};
