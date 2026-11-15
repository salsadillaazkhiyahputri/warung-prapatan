import { NextRequest, NextResponse } from 'next/server';
import { ProductService } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { readJson, cleanText, parseInteger, validateCategory, BusinessError } from '@/lib/validate';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

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
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  try {
    const body = await readJson<Record<string, unknown>>(req);

    const name = cleanText(body.name, 'Nama produk', 100, 1);
    const existingCats = await ProductService.getCategories();
    const category = validateCategory(body.category, existingCats);

    const stockCurrent = parseInteger(
      body.stock_current !== undefined && body.stock_current !== null ? body.stock_current : 0,
      'Stok awal',
      0,
      10000000
    );

    const stockMinimum = parseInteger(
      body.stock_minimum !== undefined && body.stock_minimum !== null ? body.stock_minimum : 10,
      'Batas minimum stok',
      0,
      10000000
    );

    const newProduct = await ProductService.create({
      name,
      category,
      unit: 'pcs',
      qty_per_karton: null,
      stock_current: stockCurrent,
      stock_minimum: stockMinimum
    });

    return NextResponse.json(newProduct, { status: 201 });
  } catch (err: any) {
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Error creating product:', err);
    return NextResponse.json({ error: 'Gagal menambahkan produk' }, { status: 500 });
  }
}
