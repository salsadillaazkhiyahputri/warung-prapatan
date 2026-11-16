import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, unauthorized } from '@/lib/auth';
import { TransactionService } from '@/lib/db';
import { errorResponse } from '@/lib/errors';
import { requiredId } from '@/lib/validate';

// GET /api/transactions/pair-check?product_id=&supplier_id= -> { is_new: boolean }
export async function GET(req: NextRequest) {
  if (!(await getCurrentUser())) return unauthorized();
  try {
    const { searchParams } = new URL(req.url);
    const productId = requiredId(searchParams.get('product_id'), 'Produk');
    const supplierId = requiredId(searchParams.get('supplier_id'), 'Supplier');
    const isNew = await TransactionService.isNewPair(productId, supplierId);
    return NextResponse.json({ is_new: isNew });
  } catch (error) {
    return errorResponse(error, 'Gagal memeriksa riwayat supplier');
  }
}
