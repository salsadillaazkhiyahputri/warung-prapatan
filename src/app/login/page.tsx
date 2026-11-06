'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Lock,
  User,
  AlertCircle,
  ArrowRight,
  Shield,
  Check,
  Store
} from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('pemilik');
  const [password, setPassword] = useState('warung123');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [appliedDemo, setAppliedDemo] = useState(false);
  const router = useRouter();

  const handleLogin = async (e?: React.FormEvent, customUser?: string, customPass?: string) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    const userToLogin = customUser || username;
    const passToLogin = customPass || password;

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: userToLogin, password: passToLogin })
      });

      const data = await res.json();

      if (!res.ok) {
        setErrorMsg(data.error || 'Username atau password salah');
        setIsLoading(false);
        return;
      }

      if (typeof window !== 'undefined') {
        sessionStorage.setItem('wp_authenticated', 'true');
      }

      router.push('/dashboard');
      router.refresh();
    } catch {
      setErrorMsg('Gagal terhubung ke server');
      setIsLoading(false);
    }
  };

  const handleFillDemo = () => {
    setUsername('pemilik');
    setPassword('warung123');
    setAppliedDemo(true);
    setTimeout(() => setAppliedDemo(false), 2000);
  };

  return (
    <div className="login-page-viewport">
      {/* Kartu Horizontal Ditengah Layar, Tidak Selayar Penuh & Tidak Terlalu Kecil */}
      <div className="login-card-balanced animate-fade-in">
        
        {/* ========================================================
            SISI KIRI: Background Deep Navy Berombak & 3D Spheres
            ======================================================== */}
        <div className="login-banner-left">
          {/* Bola 3D Gradien Biru Toko Sesuai Gambar Referensi */}
          <div className="login-sphere-main" />
          <div className="login-sphere-sub" />

          <div className="login-banner-content">
            <div style={{ display: 'flex', alignItems: 'center', gap: '11px', marginBottom: '24px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '11px',
                  background: 'linear-gradient(135deg, #1E293B 0%, #334155 100%)',
                  border: '1px solid rgba(255, 255, 255, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: '#38BDF8',
                  boxShadow: '0 4px 10px rgba(0, 0, 0, 0.25)'
                }}
              >
                <Store size={20} />
              </div>
              <div>
                <span style={{ fontSize: '12px', fontWeight: 600, color: '#38BDF8', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Capstone 2 TI UMY
                </span>
                <p style={{ fontSize: '11.5px', color: '#94A3B8', marginTop: '1px' }}>Sistem Manajemen Stok Toko</p>
              </div>
            </div>

            <h1
              style={{
                fontSize: '28px',
                fontWeight: 800,
                letterSpacing: '0.04em',
                color: '#FFFFFF',
                lineHeight: 1.15,
                margin: 0
              }}
            >
              SELAMAT DATANG
            </h1>

            <h2
              style={{
                fontSize: '15px',
                fontWeight: 700,
                letterSpacing: '0.08em',
                color: '#38BDF8',
                marginTop: '6px',
                textTransform: 'uppercase'
              }}
            >
              WARUNG PRAPATAN
            </h2>

            <p
              style={{
                fontSize: '13px',
                lineHeight: 1.6,
                color: '#CBD5E1',
                marginTop: '14px'
              }}
            >
              Sistem pencatatan persediaan barang dan riwayat transaksi masuk-keluar toko secara terstruktur, cepat, dan akurat.
            </p>
          </div>
        </div>

        {/* ========================================================
            SISI KANAN: Formulir Masuk 1-Role (Pemilik Toko)
            ======================================================== */}
        <div className="login-card-right">
          {/* Aksen lingkaran kecil di sudut kanan bawah kartu */}
          <div className="login-sphere-accent" />

          <div className="login-card-form">
            <div style={{ marginBottom: '22px' }}>
              <h2
                style={{
                  fontSize: '25px',
                  fontWeight: 800,
                  color: '#0F172A',
                  letterSpacing: '-0.02em',
                  margin: 0
                }}
              >
                Masuk Akun
              </h2>
              <p
                style={{
                  fontSize: '13px',
                  color: '#64748B',
                  marginTop: '5px',
                  lineHeight: 1.45
                }}
              >
                Khusus akses Pemilik Toko untuk mengelola data inventaris toko.
              </p>
            </div>

            {/* Error Alert */}
            {errorMsg && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '9px 12px',
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: '8px',
                  color: '#DC2626',
                  fontSize: '12.5px',
                  marginBottom: '16px'
                }}
              >
                <AlertCircle size={15} style={{ flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleLogin}>
              {/* Field Username */}
              <div style={{ marginBottom: '15px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#334155',
                    marginBottom: '5px'
                  }}
                  htmlFor="username"
                >
                  Username
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span
                    style={{
                      position: 'absolute',
                      left: '14px',
                      color: '#64748B',
                      display: 'flex',
                      alignItems: 'center',
                      pointerEvents: 'none'
                    }}
                  >
                    <User size={16} />
                  </span>
                  <input
                    id="username"
                    type="text"
                    placeholder="Username Pemilik"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    required
                    style={{
                      width: '100%',
                      height: '44px',
                      padding: '0 14px 0 40px',
                      background: '#F8FAFC',
                      border: '1px solid #CBD5E1',
                      borderRadius: '10px',
                      fontSize: '13.5px',
                      color: '#0F172A',
                      outline: 'none',
                      transition: 'all 0.2s ease'
                    }}
                  />
                </div>
              </div>

              {/* Field Password */}
              <div style={{ marginBottom: '15px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: 600,
                    color: '#334155',
                    marginBottom: '5px'
                  }}
                  htmlFor="password"
                >
                  Password
                </label>
                <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
                  <span
                    style={{
                      position: 'absolute',
                      left: '14px',
                      color: '#64748B',
                      display: 'flex',
                      alignItems: 'center',
                      pointerEvents: 'none'
                    }}
                  >
                    <Lock size={16} />
                  </span>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    style={{
                      width: '100%',
                      height: '44px',
                      padding: '0 85px 0 40px',
                      background: '#F8FAFC',
                      border: '1px solid #CBD5E1',
                      borderRadius: '10px',
                      fontSize: '13.5px',
                      color: '#0F172A',
                      outline: 'none',
                      transition: 'all 0.2s ease'
                    }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    style={{
                      position: 'absolute',
                      right: '12px',
                      fontSize: '10.5px',
                      fontWeight: 700,
                      letterSpacing: '0.04em',
                      color: '#0F172A',
                      background: 'transparent',
                      border: 'none',
                      cursor: 'pointer',
                      padding: '4px'
                    }}
                  >
                    {showPassword ? 'SEMBUNYIKAN' : 'LIHAT'}
                  </button>
                </div>
              </div>

              {/* Checkbox Ingat Saya */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '20px' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '7px', fontSize: '12.5px', color: '#475569', cursor: 'pointer', userSelect: 'none' }}>
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={{ accentColor: '#0F172A', cursor: 'pointer', width: '14px', height: '14px' }}
                  />
                  <span>Ingat akun di perangkat ini</span>
                </label>
              </div>

              {/* Tombol Masuk Utama */}
              <button
                type="submit"
                disabled={isLoading}
                style={{
                  width: '100%',
                  height: '44px',
                  background: '#0F172A',
                  color: '#FFFFFF',
                  border: '1px solid #0F172A',
                  borderRadius: '10px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                  boxShadow: '0 2px 4px rgba(15, 23, 42, 0.15)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: '7px'
                }}
                className="btn-navy-hover"
              >
                {isLoading ? (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <div style={{ width: '15px', height: '15px', border: '2px solid rgba(255, 255, 255, 0.3)', borderTopColor: '#FFFFFF', borderRadius: '50%', animation: 'spin 0.6s linear infinite' }} />
                    <span>Memverifikasi...</span>
                  </div>
                ) : (
                  <>
                    <span>Masuk ke Dashboard</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            {/* Kredensial Demo Rapi (1 Role Pemilik Toko) */}
            <div
              style={{
                marginTop: '18px',
                padding: '9px 12px',
                background: '#F8FAFC',
                border: '1px solid #E2E8F0',
                borderRadius: '8px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                gap: '8px'
              }}
            >
              <div style={{ display: 'flex', alignItems: 'center', gap: '7px' }}>
                <Shield size={14} style={{ color: '#0F172A' }} />
                <span style={{ fontSize: '12px', fontFamily: 'monospace', color: '#0F172A', fontWeight: 600 }}>
                  pemilik / warung123
                </span>
              </div>
              <button
                type="button"
                onClick={handleFillDemo}
                style={{
                  fontSize: '11px',
                  fontWeight: 600,
                  color: '#0F172A',
                  background: '#FFFFFF',
                  border: '1px solid #CBD5E1',
                  padding: '3px 8px',
                  borderRadius: '5px',
                  cursor: 'pointer',
                  display: 'inline-flex',
                  alignItems: 'center',
                  gap: '4px',
                  whiteSpace: 'nowrap'
                }}
              >
                {appliedDemo ? (
                  <>
                    <Check size={12} style={{ color: '#059669' }} />
                    <span style={{ color: '#059669' }}>Terisi</span>
                  </>
                ) : (
                  <span>Isi Otomatis</span>
                )}
              </button>
            </div>

            {/* Footer Bawah */}
            <p
              style={{
                fontSize: '11px',
                color: '#94A3B8',
                textAlign: 'center',
                marginTop: '20px',
                marginBottom: 0
              }}
            >
              Warung Prapatan · Capstone 2 TI UMY © 2026
            </p>
          </div>
        </div>

      </div>

      <style jsx global>{`
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        .btn-navy-hover:hover:not(:disabled) {
          background: #1E293B !important;
          border-color: #1E293B !important;
          transform: translateY(-0.5px) !important;
          box-shadow: 0 4px 12px rgba(15, 23, 42, 0.25) !important;
        }
      `}</style>
    </div>
  );
}
