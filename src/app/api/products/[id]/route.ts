import { NextRequest, NextResponse } from 'next/server';
import { ProductService } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { readJson, cleanText, parseInteger, validateCategory, BusinessError } from '@/lib/validate';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(req: NextRequest, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const productId = parseInteger(id, 'ID produk', 1);

    const body = await readJson<Record<string, unknown>>(req);

    const updateData: { name?: string; category?: string; stock_minimum?: number } = {};

    if (body.name !== undefined) {
      updateData.name = cleanText(body.name, 'Nama produk', 100, 1);
    }

    if (body.category !== undefined) {
      const existingCats = await ProductService.getCategories();
      updateData.category = validateCategory(body.category, existingCats);
    }

    if (body.stock_minimum !== undefined) {
      updateData.stock_minimum = parseInteger(body.stock_minimum, 'Batas minimum stok', 0, 10000000);
    }

    // Catatan: Stok tidak bisa diubah lewat form ubah produk (Sesuai Aturan Kerja & Bagian 5)
    const updated = await ProductService.update(productId, updateData);
    if (!updated) {
      return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (err: any) {
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Error updating product:', err);
    return NextResponse.json({ error: 'Gagal memperbarui produk' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const productId = parseInteger(id, 'ID produk', 1);

    // Hapus = nonaktifkan (is_active = false)
    const success = await ProductService.delete(productId);
    if (!success) {
      return NextResponse.json({ error: 'Produk tidak ditemukan atau gagal dinonaktifkan' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Produk berhasil dinonaktifkan' });
  } catch (err: any) {
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Error deleting product:', err);
    return NextResponse.json({ error: 'Gagal menghapus produk' }, { status: 500 });
  }
}
