'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Lock,
  User,
  AlertCircle,
  ArrowRight,
  Shield,
  Eye,
  EyeOff
} from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');
    setIsLoading(true);

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
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

  return (
    <div className="login-page-viewport">
      {/* Kartu Login Simetris 2 Sisi dengan Tema Deep Navy SaaS */}
      <div className="login-card-balanced animate-fade-in">
        
        {/* ========================================================
            SISI KIRI: Visual Hero Banner (Deep Navy & Slate)
            ======================================================== */}
        <div className="login-banner-left">
          <div className="login-banner-content">
            {/* Identitas Brand Toko (Konsisten dengan Sidebar Dashboard) */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <div
                style={{
                  width: '42px',
                  height: '42px',
                  borderRadius: '10px',
                  background: '#FFFFFF',
                  border: '1px solid rgba(255, 255, 255, 0.2)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
                  flexShrink: 0,
                  overflow: 'hidden'
                }}
              >
                <img
                  src="/logo-icon.png?v=2"
                  alt="Warung Prapatan"
                  style={{ width: '34px', height: '34px', objectFit: 'contain' }}
                />
              </div>
              <div>
                <div
                  style={{
                    fontSize: '17.5px',
                    fontWeight: 700,
                    letterSpacing: '-0.01em',
                    color: '#FFFFFF',
                    lineHeight: 1.2
                  }}
                >
                  Warung Prapatan
                </div>
                <div
                  style={{
                    fontSize: '11px',
                    fontWeight: 600,
                    color: '#38BDF8',
                    letterSpacing: '0.04em'
                  }}
                >
                  Sistem Manajemen Stok & AI Bot
                </div>
              </div>
            </div>

            {/* Bagian Tengah: Sapaan Hangat & Deskripsi Sistem yang Berisi */}
            <div className="login-hero-body">
              <h1 className="login-hero-title">
                Halo,<br />
                Selamat Datang!
              </h1>
              <p className="login-hero-desc">
                Sistem pencatatan persediaan barang dan pemantauan transaksi toko secara terstruktur, cepat, dan akurat.
              </p>
              <div className="login-hero-pill">
                <Shield size={14} style={{ color: '#38BDF8', flexShrink: 0 }} />
                <span>Akses Khusus Pemilik Toko</span>
              </div>
            </div>

            {/* Bagian Bawah: Catatan Sistem Terpusat */}
            <div
              style={{
                paddingTop: '16px',
                borderTop: '1px solid rgba(255, 255, 255, 0.08)',
                display: 'flex',
                alignItems: 'center',
                gap: '8px'
              }}
            >
              <span style={{ fontSize: '11.5px', color: '#94A3B8', letterSpacing: '0.02em' }}>
                Sistem Inventaris Terpadu · Warung Prapatan
              </span>
            </div>
          </div>
        </div>

        {/* ========================================================
            SISI KANAN: Formulir Masuk Akun
            ======================================================== */}
        <div className="login-card-right">
          <div className="login-card-form">
            {/* Header Formulir */}
            <div style={{ marginBottom: '24px' }}>
              <h2
                style={{
                  fontSize: '23px',
                  fontWeight: 700,
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
                Silakan masukkan username dan password Anda.
              </p>
            </div>

            {/* Pesan Error Jika Kredensial Salah */}
            {errorMsg && (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: '8px',
                  padding: '10px 14px',
                  background: '#FEF2F2',
                  border: '1px solid #FECACA',
                  borderRadius: '10px',
                  color: '#DC2626',
                  fontSize: '13px',
                  marginBottom: '18px'
                }}
              >
                <AlertCircle size={16} style={{ flexShrink: 0 }} />
                <span>{errorMsg}</span>
              </div>
            )}

            <form onSubmit={handleLogin}>
              {/* Field Username: Card Modern dengan Kotak Icon di Kiri */}
              <div className="login-input-card">
                <div className="login-input-icon-box">
                  <User size={17} />
                </div>
                <div className="login-input-field-wrap">
                  <label htmlFor="username" className="login-input-label">
                    Username
                  </label>
                  <input
                    id="username"
                    type="text"
                    placeholder="Masukkan username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    autoComplete="username"
                    required
                    className="login-input-element"
                  />
                </div>
              </div>

              {/* Field Password: Card Modern dengan Kotak Icon & Toggle Mata */}
              <div className="login-input-card">
                <div className="login-input-icon-box">
                  <Lock size={17} />
                </div>
                <div className="login-input-field-wrap">
                  <label htmlFor="password" className="login-input-label">
                    Password
                  </label>
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Masukkan password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    className="login-input-element"
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="login-password-toggle"
                  title={showPassword ? 'Sembunyikan password' : 'Lihat password'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>

              {/* Checkbox Ingat Akun */}
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  marginTop: '16px',
                  marginBottom: '22px'
                }}
              >
                <label
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    fontSize: '13px',
                    color: '#475569',
                    cursor: 'pointer',
                    userSelect: 'none'
                  }}
                >
                  <input
                    type="checkbox"
                    checked={rememberMe}
                    onChange={(e) => setRememberMe(e.target.checked)}
                    style={{ accentColor: '#0F172A', cursor: 'pointer', width: '15px', height: '15px' }}
                  />
                  <span>Ingat akun di perangkat ini</span>
                </label>
              </div>

              {/* Tombol Masuk Utama (Konsisten dengan Desain Web) */}
              <button
                type="submit"
                disabled={isLoading}
                className="login-submit-btn"
              >
                {isLoading ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                    <span className="login-spinner" />
                    <span>Memverifikasi...</span>
                  </span>
                ) : (
                  <>
                    <span>Masuk</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            {/* Footer Form */}
            <p
              style={{
                fontSize: '12px',
                color: '#94A3B8',
                textAlign: 'center',
                marginTop: '28px',
                marginBottom: 0
              }}
            >
              Warung Prapatan · Capstone 2 TI UMY © 2026
            </p>
          </div>
        </div>

      </div>
    </div>
  );
}
