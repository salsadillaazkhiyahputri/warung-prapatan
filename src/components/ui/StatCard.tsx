import React from 'react';

interface StatCardProps {
  title: string;
  value: number | string;
  icon: React.ReactNode;
  subtitle?: string;
  isAlert?: boolean;
}

export const StatCard: React.FC<StatCardProps> = ({
  title,
  value,
  icon,
  subtitle,
  isAlert = false
}) => {
  return (
    <div
      style={{
        background: '#FFFFFF',
        border: `1px solid ${isAlert ? '#FECACA' : '#E2E8F0'}`,
        borderRadius: 'var(--radius-lg)',
        padding: '22px 24px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: isAlert
          ? '0 1px 3px 0 rgba(220, 38, 38, 0.08)'
          : 'var(--shadow-card)',
        transition: 'all var(--transition-fast)'
      }}
      className="stat-card"
    >
      <div>
        <p style={{ color: '#64748B', fontSize: '13px', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.04em', marginBottom: '8px' }}>
          {title}
        </p>
        <h3
          style={{
            fontSize: '30px',
            fontWeight: 800,
            letterSpacing: '-0.03em',
            color: isAlert ? '#DC2626' : '#0F172A',
            lineHeight: 1
          }}
        >
          {value}
        </h3>
        {subtitle && (
          <p style={{ fontSize: '13px', color: '#64748B', marginTop: '7px' }}>
            {subtitle}
          </p>
        )}
      </div>

      <div
        style={{
          width: '48px',
          height: '48px',
          borderRadius: 'var(--radius-md)',
          background: isAlert ? '#FEF2F2' : '#F1F5F9',
          color: isAlert ? '#DC2626' : '#0F172A',
          border: `1px solid ${isAlert ? '#FECACA' : '#E2E8F0'}`,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
          boxShadow: '0 1px 2px rgba(15, 23, 42, 0.04)'
        }}
      >
        {icon}
      </div>

      <style jsx>{`
        .stat-card:hover {
          transform: translateY(-1px);
          border-color: ${isAlert ? '#F87171' : '#CBD5E1'};
          box-shadow: 0 4px 12px 0 rgba(15, 23, 42, 0.06);
        }
      `}</style>
    </div>
  );
};
