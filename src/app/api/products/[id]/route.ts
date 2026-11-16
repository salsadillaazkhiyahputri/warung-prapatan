import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, unauthorized } from '@/lib/auth';
import { ProductService } from '@/lib/db';
import { errorResponse } from '@/lib/errors';
import { readJson, cleanText, parseInteger, parseCategory, requiredId } from '@/lib/validate';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(req: NextRequest, context: RouteContext) {
  if (!(await getCurrentUser())) return unauthorized();
  try {
    const productId = requiredId((await context.params).id, 'ID produk');
    const body = await readJson(req);

    // Hanya nama, kategori, dan batas minimum yang bisa diubah. Stok, satuan, dan isi karton diabaikan.
    const patch: { name?: string; category?: string; stock_minimum?: number } = {};
    if (body.name !== undefined) patch.name = cleanText(body.name, { field: 'Nama produk', required: true, max: 100 })!;
    if (body.category !== undefined) patch.category = parseCategory(body.category, await ProductService.getCategorySuggestions());
    if (body.stock_minimum !== undefined) {
      patch.stock_minimum = parseInteger(body.stock_minimum, { field: 'Batas stok menipis', required: true, min: 0, max: 1_000_000 });
    }

    const updated = await ProductService.update(productId, patch);
    if (!updated) {
      return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (error) {
    return errorResponse(error, 'Gagal memperbarui produk');
  }
}

export async function DELETE(_req: NextRequest, context: RouteContext) {
  if (!(await getCurrentUser())) return unauthorized();
  try {
    const productId = requiredId((await context.params).id, 'ID produk');
    const success = await ProductService.delete(productId);
    if (!success) {
      return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 });
    }
    return NextResponse.json({ success: true, message: 'Produk berhasil dihapus' });
  } catch (error) {
    return errorResponse(error, 'Gagal menghapus produk');
  }
}
