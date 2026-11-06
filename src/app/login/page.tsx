'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Store, Lock, User, ArrowRight, AlertCircle, Shield } from 'lucide-react';

export default function LoginPage() {
  const [username, setUsername] = useState('pemilik');
  const [password, setPassword] = useState('warung123');
  const [errorMsg, setErrorMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
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

      router.push('/dashboard');
      router.refresh();
    } catch {
      setErrorMsg('Gagal terhubung ke server');
      setIsLoading(false);
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '24px',
        background: '#F4F6F9'
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: '400px',
          background: '#FFFFFF',
          border: '1px solid #E2E8F0',
          borderRadius: 'var(--radius-md)',
          padding: '32px 28px',
          boxShadow: 'var(--shadow-card)'
        }}
        className="animate-fade-in"
      >
        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: '26px' }}>
          <div
            style={{
              width: '54px',
              height: '54px',
              borderRadius: 'var(--radius-sm)',
              background: '#1E2C3A',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#FFFFFF',
              margin: '0 auto 14px'
            }}
          >
            <Store size={26} />
          </div>

          <h2 style={{ fontSize: '20px', fontWeight: 700, color: '#1E2C3A', letterSpacing: '-0.015em' }}>
            Warung Prapatan
          </h2>
          <p style={{ fontSize: '13px', color: '#64748B', marginTop: '3px' }}>
            Sistem Manajemen Stok Toko
          </p>
        </div>

        {errorMsg && (
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
              marginBottom: '18px'
            }}
          >
            <AlertCircle size={16} />
            <span>{errorMsg}</span>
          </div>
        )}

        <form onSubmit={handleLogin}>
          <div className="form-group">
            <label className="form-label" htmlFor="username">
              Username
            </label>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94A3B8'
                }}
              >
                <User size={16} />
              </span>
              <input
                id="username"
                type="text"
                className="form-input"
                style={{ paddingLeft: '38px', height: '40px' }}
                placeholder="Masukkan username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label" htmlFor="password">
              Password
            </label>
            <div style={{ position: 'relative' }}>
              <span
                style={{
                  position: 'absolute',
                  left: '12px',
                  top: '50%',
                  transform: 'translateY(-50%)',
                  color: '#94A3B8'
                }}
              >
                <Lock size={16} />
              </span>
              <input
                id="password"
                type="password"
                className="form-input"
                style={{ paddingLeft: '38px', height: '40px' }}
                placeholder="Masukkan password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>
          </div>

          <button
            type="submit"
            className="btn btn-primary"
            style={{ width: '100%', marginTop: '12px', height: '42px', fontSize: '14px' }}
            disabled={isLoading}
          >
            {isLoading ? (
              <span>Masuk...</span>
            ) : (
              <>
                <span>Masuk ke Dashboard</span>
                <ArrowRight size={16} />
              </>
            )}
          </button>
        </form>

        {/* Demo Credentials Helper */}
        <div
          style={{
            marginTop: '22px',
            padding: '12px 14px',
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            borderRadius: 'var(--radius-sm)',
            fontSize: '13px',
            color: '#64748B',
            textAlign: 'center'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '5px', fontWeight: 600, color: '#1E2C3A' }}>
            <Shield size={13} />
            <span>Kredensial Login</span>
          </div>
          <div style={{ marginTop: '4px', color: '#475569' }}>
            User: <code style={{ color: '#1E2C3A', fontWeight: 600 }}>pemilik</code> | Pass: <code style={{ color: '#1E2C3A', fontWeight: 600 }}>warung123</code>
          </div>
        </div>
      </div>
    </div>
  );
}
