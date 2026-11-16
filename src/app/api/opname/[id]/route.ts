import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, unauthorized } from '@/lib/auth';
import { OpnameService } from '@/lib/db';
import { errorResponse } from '@/lib/errors';
import { requiredId } from '@/lib/validate';

interface RouteContext {
  params: Promise<{ id: string }>;
}

// GET /api/opname/[id] -> detail satu sesi opname beserta itemnya.
export async function GET(_req: NextRequest, context: RouteContext) {
  if (!(await getCurrentUser())) return unauthorized();
  try {
    const id = requiredId((await context.params).id, 'ID opname');
    const detail = await OpnameService.detail(id);
    if (!detail) return NextResponse.json({ error: 'Sesi opname tidak ditemukan' }, { status: 404 });
    return NextResponse.json(detail);
  } catch (error) {
    return errorResponse(error, 'Gagal mengambil detail stok opname');
  }
}
