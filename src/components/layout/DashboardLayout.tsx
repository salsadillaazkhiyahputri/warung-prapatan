'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { Sidebar } from './Sidebar';
import { Header } from './Header';

interface DashboardLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle?: string;
}

// Global cache to avoid full-screen loading spinner on client-side route transitions
let isGlobalAuthKnown = false;

export const DashboardLayout: React.FC<DashboardLayoutProps> = ({
  children,
  title,
  subtitle
}) => {
  const [isMobileOpen, setIsMobileOpen] = useState(false);
  // If already verified in this session, render immediately with 0 delay!
  const [isLoadingAuth, setIsLoadingAuth] = useState(() => {
    if (typeof window !== 'undefined' && (isGlobalAuthKnown || sessionStorage.getItem('wp_authenticated') === 'true')) {
      return false;
    }
    return true;
  });
  const router = useRouter();

  useEffect(() => {
    // Quick background verification
    fetch('/api/auth/me')
      .then(res => {
        if (!res.ok) {
          isGlobalAuthKnown = false;
          if (typeof window !== 'undefined') sessionStorage.removeItem('wp_authenticated');
          router.push('/login');
        } else {
          isGlobalAuthKnown = true;
          if (typeof window !== 'undefined') sessionStorage.setItem('wp_authenticated', 'true');
          setIsLoadingAuth(false);
        }
      })
      .catch(() => {
        isGlobalAuthKnown = false;
        if (typeof window !== 'undefined') sessionStorage.removeItem('wp_authenticated');
        router.push('/login');
      });
  }, [router]);

  if (isLoadingAuth) {
    return (
      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          minHeight: '100vh',
          background: '#F8FAFC',
          color: '#64748B',
          gap: '14px'
        }}
      >
        <div
          style={{
            width: '36px',
            height: '36px',
            borderRadius: '50%',
            border: '2.5px solid #E2E8F0',
            borderTopColor: '#0F172A',
            animation: 'spin 0.7s linear infinite'
          }}
        />
        <p style={{ fontSize: '13px', fontWeight: 500 }}>Memuat Warung Prapatan...</p>
        <style jsx>{`
          @keyframes spin {
            to { transform: rotate(360deg); }
          }
        `}</style>
      </div>
    );
  }

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

        <main className="page-wrapper animate-fade-in">
          {children}
        </main>
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
