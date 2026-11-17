'use client';

import { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PaginationProps {
  currentPage: number;
  pageSize: number;
  totalItems: number;
  onPageChange: (page: number) => void;
}

export function usePagination<T>(items: T[], pageSize = 10, resetKey = '') {
  const [currentPage, setCurrentPage] = useState(1);
  const totalPages = Math.max(1, Math.ceil(items.length / pageSize));
  const safePage = Math.min(currentPage, totalPages);

  useEffect(() => {
    setCurrentPage(1);
  }, [resetKey]);

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [currentPage, totalPages]);

  return {
    currentPage: safePage,
    pageItems: items.slice((safePage - 1) * pageSize, safePage * pageSize),
    pageSize,
    totalItems: items.length,
    totalPages,
    setCurrentPage
  };
}

export function Pagination({ currentPage, pageSize, totalItems, onPageChange }: PaginationProps) {
  const totalPages = Math.ceil(totalItems / pageSize);
  if (totalPages <= 1) return null;

  const firstItem = (currentPage - 1) * pageSize + 1;
  const lastItem = Math.min(currentPage * pageSize, totalItems);
  const pages: Array<number | 'start-ellipsis' | 'end-ellipsis'> = totalPages <= 7
    ? Array.from({ length: totalPages }, (_, index) => index + 1)
    : currentPage <= 4
      ? [1, 2, 3, 4, 5, 'end-ellipsis', totalPages]
      : currentPage >= totalPages - 3
        ? [1, 'start-ellipsis', totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
        : [1, 'start-ellipsis', currentPage - 1, currentPage, currentPage + 1, 'end-ellipsis', totalPages];

  return (
    <nav className="pagination" aria-label="Navigasi halaman daftar">
      <span className="pagination-summary">
        Menampilkan {firstItem}–{lastItem} dari {totalItems}
      </span>
      <div className="pagination-controls">
        <button
          type="button"
          className="pagination-button pagination-arrow"
          aria-label="Halaman sebelumnya"
          onClick={() => onPageChange(currentPage - 1)}
          disabled={currentPage <= 1}
        >
          <ChevronLeft size={16} />
        </button>
        {pages.map((page) => page === 'start-ellipsis' || page === 'end-ellipsis' ? (
          <span key={page} className="pagination-ellipsis" aria-hidden="true">…</span>
        ) : (
          <button
            key={page}
            type="button"
            className={`pagination-button${page === currentPage ? ' is-current' : ''}`}
            aria-label={`Halaman ${page}`}
            aria-current={page === currentPage ? 'page' : undefined}
            onClick={() => onPageChange(page)}
          >
            {page}
          </button>
        ))}
        <button
          type="button"
          className="pagination-button pagination-arrow"
          aria-label="Halaman berikutnya"
          onClick={() => onPageChange(currentPage + 1)}
          disabled={currentPage >= totalPages}
        >
          <ChevronRight size={16} />
        </button>
      </div>
    </nav>
  );
}
