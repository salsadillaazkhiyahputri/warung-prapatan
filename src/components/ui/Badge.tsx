import React from 'react';

export type BadgeType =
  | 'in' | 'out' | 'warning' | 'neutral'
  | 'koreksi' | 'utama' | 'cadangan' | 'grosir';

interface BadgeProps {
  type: BadgeType;
  children: React.ReactNode;
  className?: string;
  title?: string;
}

export const Badge: React.FC<BadgeProps> = ({ type, children, className = '', title }) => {
  return (
    <span className={`badge badge-${type} ${className}`} title={title}>
      {children}
    </span>
  );
};
