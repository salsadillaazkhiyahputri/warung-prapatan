import React from 'react';

export type BadgeType =
  | 'in' | 'out' | 'warning' | 'neutral'
  | 'koreksi' | 'utama' | 'cadangan' | 'grosir';

interface BadgeProps {
  type: BadgeType;
  children: React.ReactNode;
  className?: string;
  title?: string;
  style?: React.CSSProperties;
}

export const Badge: React.FC<BadgeProps> = ({ type, children, className = '', title, style }) => {
  return (
    <span className={`badge badge-${type} ${className}`} title={title} style={style}>
      {children}
    </span>
  );
};
