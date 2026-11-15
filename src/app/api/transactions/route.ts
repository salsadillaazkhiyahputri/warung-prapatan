import { NextRequest, NextResponse } from 'next/server';
import { TransactionService, ProductService } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { TransactionType } from '@/types';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const startDate = searchParams.get('startDate') || undefined;
    const endDate = searchParams.get('endDate') || undefined;
    const prodIdParam = searchParams.get('productId');
    const typeParam = searchParams.get('type') as TransactionType | 'all' | null;

    const productId = prodIdParam && prodIdParam !== 'all' ? parseInt(prodIdParam, 10) : undefined;
    const type = typeParam && typeParam !== 'all' ? typeParam : 'all';

    const transactions = await TransactionService.getHistory({
      startDate,
      endDate,
      productId: isNaN(productId as number) ? undefined : productId,
      type
    });

    return NextResponse.json(transactions);
  } catch (error) {
    console.error('Error fetching transactions:', error);
    return NextResponse.json({ error: 'Gagal mengambil riwayat transaksi' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { product_id, type, qty, supplier_id, note } = body;

    if (!product_id || !type || !qty) {
      return NextResponse.json({ error: 'product_id, type, dan qty wajib diisi' }, { status: 400 });
    }

    if (type !== 'in' && type !== 'out') {
      return NextResponse.json({ error: 'Tipe transaksi harus "in" atau "out"' }, { status: 400 });
    }

    const numQty = parseInt(qty, 10);
    if (isNaN(numQty) || numQty <= 0) {
      return NextResponse.json({ error: 'Jumlah (qty) harus angka positif' }, { status: 400 });
    }

    // Aturan bisnis: supplier_id wajib untuk transaksi bertipe masuk ('in')
    if (type === 'in' && !supplier_id) {
      return NextResponse.json({ error: 'Supplier wajib dipilih untuk transaksi stok masuk' }, { status: 400 });
    }

    const product = await ProductService.getById(parseInt(product_id, 10));
    if (!product) {
      return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 });
    }

    // Aturan bisnis: untuk transaksi keluar, stok harus mencukupi
    if (type === 'out' && product.stock_current < numQty) {
      return NextResponse.json({
        error: `Stok tidak mencukupi. Stok saat ini: ${product.stock_current} ${product.unit}`
      }, { status: 400 });
    }

    const user = await getCurrentUser();
    const newTrx = await TransactionService.create({
      product_id: product.id,
      user_id: user?.id,
      supplier_id: type === 'in' ? parseInt(supplier_id, 10) : null,
      type,
      qty: numQty,
      note: note || null
    });

    return NextResponse.json(newTrx, { status: 201 });
  } catch (error) {
    console.error('Error creating transaction:', error);
    return NextResponse.json({ error: 'Gagal membuat transaksi' }, { status: 500 });
  }
}
