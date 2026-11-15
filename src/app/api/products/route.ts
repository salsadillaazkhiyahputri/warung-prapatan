import { NextRequest, NextResponse } from 'next/server';
import { ProductService } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || undefined;
    const category = searchParams.get('category') || undefined;

    const products = await ProductService.getAll(q, category);
    return NextResponse.json(products);
  } catch (error) {
    console.error('Error fetching products:', error);
    return NextResponse.json({ error: 'Gagal mengambil data produk' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name, category, unit, qty_per_karton, stock_current, stock_minimum } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Nama produk wajib diisi' }, { status: 400 });
    }
    if (!category || !category.trim()) {
      return NextResponse.json({ error: 'Kategori produk wajib diisi' }, { status: 400 });
    }
    if (stock_minimum !== undefined && (!Number.isInteger(Number(stock_minimum)) || Number(stock_minimum) < 0)) {
      return NextResponse.json({ error: 'Batas stok menipis harus berupa angka bulat minimal 0' }, { status: 400 });
    }
    if (qty_per_karton !== null && qty_per_karton !== undefined &&
      (!Number.isInteger(Number(qty_per_karton)) || Number(qty_per_karton) < 1)) {
      return NextResponse.json({ error: 'Isi per karton harus berupa angka bulat minimal 1 atau dikosongkan' }, { status: 400 });
    }

    const newProduct = await ProductService.create({
      name: name.trim(),
      category: category.trim(),
      unit: unit?.trim() || 'pcs',
      qty_per_karton: qty_per_karton ? Number(qty_per_karton) : null,
      stock_current: Math.max(0, Number(stock_current) || 0),
      stock_minimum: Number(stock_minimum ?? 10)
    });

    return NextResponse.json(newProduct, { status: 201 });
  } catch (error) {
    console.error('Error creating product:', error);
    return NextResponse.json({ error: 'Gagal menambahkan produk' }, { status: 500 });
  }
}
