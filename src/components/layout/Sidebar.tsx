'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { clearAuthCache } from './auth-cache';
import {
  LayoutDashboard,
  Package,
  Truck,
  History,
  ClipboardCheck,
  LogOut,
  Store,
  ChevronRight
} from 'lucide-react';

interface SidebarProps {
  isMobileOpen?: boolean;
  onCloseMobile?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ isMobileOpen, onCloseMobile }) => {
  const pathname = usePathname();
  const router = useRouter();

  const handleLogout = async () => {
    try {
      clearAuthCache();
      await fetch('/api/auth/logout', { method: 'POST' });
      router.push('/login');
      router.refresh();
    } catch (err) {
      console.error('Logout error:', err);
      clearAuthCache();
      router.push('/login');
    }
  };

  const navItems = [
    {
      label: 'Dashboard',
      href: '/dashboard',
      icon: <LayoutDashboard size={18} />
    },
    {
      label: 'Produk',
      href: '/produk',
      icon: <Package size={18} />
    },
    {
      label: 'Supplier',
      href: '/supplier',
      icon: <Truck size={18} />
    },
    {
      label: 'Riwayat Transaksi',
      href: '/riwayat',
      icon: <History size={18} />
    },
    {
      label: 'Stok Opname',
      href: '/opname',
      icon: <ClipboardCheck size={18} />
    }
  ];

  return (
    <>
      {/* Mobile Backdrop */}
      {isMobileOpen && (
        <div
          onClick={onCloseMobile}
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(15, 23, 42, 0.5)',
            zIndex: 40
          }}
        />
      )}

      <aside
        style={{
          width: '260px',
          background: '#0F172A',
          borderRight: '1px solid rgba(255, 255, 255, 0.08)',
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          flexShrink: 0,
          transition: 'transform var(--transition-normal)',
          zIndex: 50,
          // Tetap di tempat saat halaman digulir; menu yang panjang punya scroll sendiri.
          position: 'sticky',
          top: 0,
          height: '100vh',
          alignSelf: 'flex-start',
          overflowY: 'auto',
          ...(isMobileOpen ? {
            position: 'fixed',
            top: 0,
            bottom: 0,
            left: 0,
            transform: 'translateX(0)'
          } : {})
        }}
      >
        {/* Brand Header */}
        <div>
          <div
            style={{
              padding: '22px 20px',
              borderBottom: '1px solid rgba(255, 255, 255, 0.08)',
              display: 'flex',
              alignItems: 'center',
              gap: '12px'
            }}
          >
            <div
              style={{
                width: '40px',
                height: '40px',
                borderRadius: '10px',
                background: '#FFFFFF',
                border: '1px solid rgba(255, 255, 255, 0.15)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                boxShadow: '0 2px 6px rgba(0, 0, 0, 0.2)',
                overflow: 'hidden',
                flexShrink: 0
              }}
            >
              <img
                src="/logo-icon.png?v=2"
                alt="Warung Prapatan"
                style={{ width: '32px', height: '32px', objectFit: 'contain' }}
              />
            </div>
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                <h1 style={{ fontSize: '15.5px', fontWeight: 700, color: '#FFFFFF', lineHeight: 1.2, letterSpacing: '-0.01em' }}>
                  Warung Prapatan
                </h1>
              </div>
              <p style={{ fontSize: '11.5px', color: '#94A3B8', marginTop: '2px', fontWeight: 500 }}>
                Sistem Manajemen Stok
              </p>
            </div>
          </div>

          {/* Navigation Items */}
          <nav style={{ padding: '16px 12px', display: 'flex', flexDirection: 'column', gap: '4px' }}>
            {navItems.map((item) => {
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={onCloseMobile}
                  prefetch={true}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: '10px 14px',
                    borderRadius: 'var(--radius-md)',
                    fontSize: '13.5px',
                    fontWeight: isActive ? 600 : 500,
                    color: isActive ? '#FFFFFF' : '#94A3B8',
                    border: isActive ? '1px solid rgba(255, 255, 255, 0.08)' : '1px solid transparent',
                    boxShadow: isActive ? '0 1px 2px rgba(0, 0, 0, 0.2)' : 'none',
                    transition: 'all var(--transition-fast)'
                  }}
                  className={`nav-link${isActive ? ' active' : ''}`}
                  aria-current={isActive ? 'page' : undefined}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '11px' }}>
                    <span style={{ color: isActive ? '#38BDF8' : '#64748B', display: 'flex' }}>
                      {item.icon}
                    </span>
                    <span>{item.label}</span>
                  </div>

                  {isActive ? (
                    <span
                      className="nav-active-indicator"
                      style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#38BDF8' }}
                    />
                  ) : null}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* User Card & Logout */}
        <div
          style={{
            padding: '16px 14px',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            background: 'rgba(0, 0, 0, 0.15)'
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '11px',
              padding: '10px 12px',
              borderRadius: 'var(--radius-md)',
              background: '#1E293B',
              border: '1px solid rgba(255, 255, 255, 0.06)',
              marginBottom: '10px'
            }}
          >
            <div
              style={{
                width: '34px',
                height: '34px',
                borderRadius: 'var(--radius-sm)',
                background: '#334155',
                color: '#F8FAFC',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontWeight: 700,
                fontSize: '12px'
              }}
            >
              WP
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: '13px', fontWeight: 600, color: '#FFFFFF', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                Pemilik Toko
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px', marginTop: '1px' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#10B981' }} />
                <span style={{ fontSize: '11px', color: '#94A3B8' }}>Online</span>
              </div>
            </div>
          </div>

          <button
            onClick={handleLogout}
            style={{
              width: '100%',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '7px',
              padding: '9px 12px',
              fontSize: '13px',
              fontWeight: 500,
              color: '#F87171',
              background: 'rgba(239, 68, 68, 0.08)',
              border: '1px solid rgba(239, 68, 68, 0.2)',
              borderRadius: 'var(--radius-md)',
              transition: 'all var(--transition-fast)'
            }}
            className="logout-btn"
          >
            <LogOut size={14} />
            <span>Keluar Akun</span>
          </button>
        </div>
      </aside>

      <style jsx global>{`
        .logout-btn:hover {
          background: #DC2626 !important;
          color: #FFFFFF !important;
          border-color: #DC2626 !important;
        }
      `}</style>
    </>
  );
};
