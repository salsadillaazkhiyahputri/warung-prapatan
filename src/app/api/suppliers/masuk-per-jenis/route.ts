import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, unauthorized } from '@/lib/auth';
import { SupplierService, wibDaysAgo, wibToday } from '@/lib/db';
import { errorResponse } from '@/lib/errors';
import { dateRange } from '@/lib/validate';

// GET /api/suppliers/masuk-per-jenis?startDate=&endDate= (bawaan 30 hari terakhir, WIB)
export async function GET(req: NextRequest) {
  if (!(await getCurrentUser())) return unauthorized();
  try {
    const { searchParams } = new URL(req.url);
    const range = dateRange(
      searchParams.get('startDate') || wibDaysAgo(29),
      searchParams.get('endDate') || wibToday()
    );
    const rows = await SupplierService.masukPerJenis(range);
    return NextResponse.json({ rows, range });
  } catch (error) {
    return errorResponse(error, 'Gagal memuat ringkasan barang masuk');
  }
}
