import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, unauthorized } from '@/lib/auth';
import { OpnameService, wibDaysAgo, wibToday } from '@/lib/db';
import { errorResponse } from '@/lib/errors';
import { cleanText, dateRange } from '@/lib/validate';

// GET /api/opname/keluar-per-hari?startDate=&endDate=&category=
// Rentang bawaan: 30 hari terakhir (WIB). Hasil diurutkan rata-rata terbesar.
export async function GET(req: NextRequest) {
  if (!(await getCurrentUser())) return unauthorized();
  try {
    const { searchParams } = new URL(req.url);
    const range = dateRange(
      searchParams.get('startDate') || wibDaysAgo(29),
      searchParams.get('endDate') || wibToday()
    );
    const rawCategory = cleanText(searchParams.get('category'), { field: 'Kategori', max: 50 });
    const category = rawCategory && rawCategory !== 'Semua' ? rawCategory : null;
    const rows = await OpnameService.keluarPerHari(range, category);
    return NextResponse.json({ rows, range });
  } catch (error) {
    return errorResponse(error, 'Gagal menghitung rata-rata keluar per hari');
  }
}
