import { NextRequest, NextResponse } from 'next/server';
import { ProductService } from '@/lib/db';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const productId = parseInt(id, 10);
    if (isNaN(productId)) {
      return NextResponse.json({ error: 'ID produk tidak valid' }, { status: 400 });
    }

    const body = await req.json();
    if (body.stock_minimum !== undefined &&
      (!Number.isInteger(Number(body.stock_minimum)) || Number(body.stock_minimum) < 0)) {
      return NextResponse.json({ error: 'Batas stok menipis harus berupa angka bulat minimal 0' }, { status: 400 });
    }
    if (body.qty_per_karton !== null && body.qty_per_karton !== undefined &&
      (!Number.isInteger(Number(body.qty_per_karton)) || Number(body.qty_per_karton) < 1)) {
      return NextResponse.json({ error: 'Isi per karton harus berupa angka bulat minimal 1 atau dikosongkan' }, { status: 400 });
    }

    const updated = await ProductService.update(productId, body);
    if (!updated) {
      return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating product:', error);
    return NextResponse.json({ error: 'Gagal memperbarui produk' }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const productId = parseInt(id, 10);
    if (isNaN(productId)) {
      return NextResponse.json({ error: 'ID produk tidak valid' }, { status: 400 });
    }

    const success = await ProductService.delete(productId);
    if (!success) {
      return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json({ success: true, message: 'Produk berhasil dihapus' });
  } catch (error) {
    console.error('Error deleting product:', error);
    return NextResponse.json({ error: 'Gagal menghapus produk' }, { status: 500 });
  }
}
