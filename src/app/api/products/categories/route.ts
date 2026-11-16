import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, unauthorized } from '@/lib/auth';
import { ProductService } from '@/lib/db';
import { errorResponse } from '@/lib/errors';

// GET /api/products/categories            -> saran kategori untuk form (daftar tetap + kategori yang pernah dipakai).
// GET /api/products/categories?scope=used -> kategori yang dipakai produk aktif saat ini (untuk filter).
export async function GET(req: NextRequest) {
  if (!(await getCurrentUser())) return unauthorized();
  try {
    const used = new URL(req.url).searchParams.get('scope') === 'used';
    return NextResponse.json(used ? await ProductService.getUsedCategories() : await ProductService.getCategorySuggestions());
  } catch (error) {
    return errorResponse(error, 'Gagal mengambil daftar kategori');
  }
}
