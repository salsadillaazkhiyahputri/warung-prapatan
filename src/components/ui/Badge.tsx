import React from 'react';

export interface BadgeProps {
  type?: 'in' | 'out' | 'warning' | 'neutral';
  variant?: 'primary' | 'secondary' | 'success' | 'warning' | 'danger' | 'in' | 'out' | 'neutral';
  children: React.ReactNode;
  className?: string;
  style?: React.CSSProperties;
}

export const Badge: React.FC<BadgeProps> = ({
  type,
  variant,
  children,
  className = '',
  style
}) => {
  const effectiveVariant = variant || type || 'neutral';

  const variantStyles: Record<string, React.CSSProperties> = {
    primary: { background: '#EFF6FF', color: '#1D4ED8', border: '1px solid #BFDBFE' },
    secondary: { background: '#F1F5F9', color: '#475569', border: '1px solid #CBD5E1' },
    success: { background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0' },
    warning: { background: '#FFFBEB', color: '#B45309', border: '1px solid #FDE68A' },
    danger: { background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' },
    in: { background: '#ECFDF5', color: '#047857', border: '1px solid #A7F3D0' },
    out: { background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' },
    neutral: { background: '#F8FAFC', color: '#64748B', border: '1px solid #E2E8F0' }
  };

  const defaultStyle: React.CSSProperties = {
    display: 'inline-flex',
    alignItems: 'center',
    padding: '3px 9px',
    borderRadius: '12px',
    fontSize: '11.5px',
    fontWeight: 600,
    lineHeight: 1.2,
    ...variantStyles[effectiveVariant],
    ...style
  };

  return (
    <span className={`badge ${className}`} style={defaultStyle}>
      {children}
    </span>
  );
};
