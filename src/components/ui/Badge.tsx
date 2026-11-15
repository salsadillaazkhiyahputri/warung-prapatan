import React from 'react';

interface BadgeProps {
  type: 'in' | 'out' | 'warning' | 'neutral';
  children: React.ReactNode;
  className?: string;
}

export const Badge: React.FC<BadgeProps> = ({ type, children, className = '' }) => {
  const typeClass = {
    in: 'badge-in',
    out: 'badge-out',
    warning: 'badge-warning',
    neutral: 'badge-neutral'
  }[type];

  return (
    <span className={`badge ${typeClass} ${className}`}>
      {children}
    </span>
  );
};
