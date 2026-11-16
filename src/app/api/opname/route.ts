import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, unauthorized } from '@/lib/auth';
import { OpnameService } from '@/lib/db';
import { errorResponse } from '@/lib/errors';
import { dateRange, optionalId } from '@/lib/validate';

// GET /api/opname?startDate=&endDate=&productId= -> daftar sesi opname (hanya baca).
export async function GET(req: NextRequest) {
  if (!(await getCurrentUser())) return unauthorized();
  try {
    const { searchParams } = new URL(req.url);
    const range = dateRange(searchParams.get('startDate'), searchParams.get('endDate'));
    const productId = optionalId(searchParams.get('productId'), 'Produk');
    const sessions = await OpnameService.list({ ...range, productId });
    return NextResponse.json(sessions);
  } catch (error) {
    return errorResponse(error, 'Gagal mengambil riwayat stok opname');
  }
}
