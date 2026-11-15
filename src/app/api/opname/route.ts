import { NextRequest, NextResponse } from 'next/server';
import { OpnameService } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { dateRange, optionalId, BusinessError } from '@/lib/validate';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const tab = searchParams.get('tab') || 'sessions';

    if (tab === 'keluar_per_hari') {
      const category = searchParams.get('category') || undefined;
      const data = await OpnameService.getKeluarPerHari(category);
      return NextResponse.json(data);
    }

    // Default: tab sesi
    const startDateParam = searchParams.get('startDate') || undefined;
    const endDateParam = searchParams.get('endDate') || undefined;
    const prodIdParam = searchParams.get('productId');

    const { startDate, endDate } = dateRange(startDateParam, endDateParam);
    const productId = optionalId(prodIdParam, 'ID produk');

    const data = await OpnameService.getSessions({
      startDate,
      endDate,
      productId: productId ?? undefined
    });

    return NextResponse.json(data);
  } catch (err: any) {
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Error fetching opname data:', err);
    return NextResponse.json({ error: 'Gagal mengambil data stok opname' }, { status: 500 });
  }
}

