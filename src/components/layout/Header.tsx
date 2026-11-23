'use client';

import React from 'react';
import { Menu, Calendar } from 'lucide-react';

interface HeaderProps {
  onToggleMobileMenu: () => void;
  title: string;
  subtitle?: string;
}

export const Header: React.FC<HeaderProps> = ({
  onToggleMobileMenu,
  title,
  subtitle
}) => {
  const [todayFormatted, setTodayFormatted] = React.useState('');

  React.useEffect(() => {
    setTodayFormatted(
      new Intl.DateTimeFormat('id-ID', {
        weekday: 'long',
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'Asia/Jakarta'
      }).format(new Date())
    );
  }, []);

  return (
    <header className="header-bar">
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', minWidth: 0, flex: 1 }}>
        <button
          onClick={onToggleMobileMenu}
          className="mobile-toggle-btn"
          title="Buka Menu Navigasi"
          aria-label="Buka Menu Navigasi"
        >
          <Menu size={18} />
        </button>

        <div style={{ minWidth: 0, flex: 1 }}>
          <h2
            style={{
              fontSize: '20px',
              fontWeight: 700,
              color: '#0F172A',
              lineHeight: 1.25,
              letterSpacing: '-0.02em',
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis'
            }}
          >
            {title}
          </h2>
          {subtitle && (
            <p
              style={{
                fontSize: '12.5px',
                color: '#64748B',
                marginTop: '2px',
                fontWeight: 400,
                lineHeight: 1.35,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis'
              }}
            >
              {subtitle}
            </p>
          )}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: '10px', flexShrink: 0 }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '7px',
            padding: '6px 14px',
            borderRadius: 'var(--radius-full)',
            background: '#F8FAFC',
            border: '1px solid #E2E8F0',
            fontSize: '12.5px',
            fontWeight: 500,
            color: '#475569'
          }}
          className="date-pill"
        >
          <Calendar size={13} style={{ color: '#64748B' }} />
          <span>{todayFormatted || ' '}</span>
        </div>
      </div>
    </header>
  );
};
