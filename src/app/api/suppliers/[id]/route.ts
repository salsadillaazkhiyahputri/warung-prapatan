import { NextRequest, NextResponse } from 'next/server';
import { SupplierService } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { readJson, cleanText, parseInteger, validateSupplierJenis, BusinessError } from '@/lib/validate';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(req: NextRequest, context: RouteContext) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  try {
    const { id } = await context.params;
    const supplierId = parseInteger(id, 'ID supplier', 1);

    const body = await readJson<Record<string, unknown>>(req);

    const updateData: { name?: string; jenis?: any; phone?: string | null } = {};

    if (body.name !== undefined) {
      updateData.name = cleanText(body.name, 'Nama supplier', 100, 1);
    }

    if (body.jenis !== undefined) {
      updateData.jenis = validateSupplierJenis(body.jenis);
    }

    if (body.phone !== undefined) {
      updateData.phone = body.phone ? cleanText(body.phone, 'Nomor telepon', 50, 0) : null;
    }

    const updated = await SupplierService.update(supplierId, updateData);
    return NextResponse.json(updated);
  } catch (err: any) {
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Error updating supplier:', err);
    return NextResponse.json({ error: 'Gagal memperbarui supplier' }, { status: 500 });
  }
}

export async function DELETE() {
  return NextResponse.json(
    { error: 'Penghapusan supplier tidak diizinkan agar integritas riwayat transaksi tetap terjaga.' },
    { status: 403 }
  );
}
