import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, unauthorized } from '@/lib/auth';
import { ProductService } from '@/lib/db';
import { errorResponse } from '@/lib/errors';
import { readJson, cleanText, parseInteger, parseCategory } from '@/lib/validate';

export async function GET(req: NextRequest) {
  if (!(await getCurrentUser())) return unauthorized();
  try {
    const { searchParams } = new URL(req.url);
    const q = cleanText(searchParams.get('q'), { field: 'Kata kunci', max: 100 }) ?? undefined;
    const rawCategory = cleanText(searchParams.get('category'), { field: 'Kategori', max: 50 });
    const category = rawCategory && rawCategory !== 'Semua' ? rawCategory : undefined;

    // Produk + supplier terakhir digabung di server (view hanya bisa dibaca service_role).
    const products = await ProductService.getCatalog(q, category);
    return NextResponse.json(products);
  } catch (error) {
    return errorResponse(error, 'Gagal mengambil data produk');
  }
}

export async function POST(req: NextRequest) {
  if (!(await getCurrentUser())) return unauthorized();
  try {
    const body = await readJson(req);
    const name = cleanText(body.name, { field: 'Nama produk', required: true, max: 100 })!;
    const category = parseCategory(body.category, await ProductService.getCategorySuggestions());
    const stock_current = parseInteger(body.stock_current, { field: 'Stok awal', min: 0, max: 1_000_000 }) ?? 0;
    const stock_minimum = parseInteger(body.stock_minimum, { field: 'Batas stok menipis', min: 0, max: 1_000_000 }) ?? 10;

    const newProduct = await ProductService.create({ name, category, stock_current, stock_minimum });
    return NextResponse.json(newProduct, { status: 201 });
  } catch (error) {
    return errorResponse(error, 'Gagal menambahkan produk');
  }
}
