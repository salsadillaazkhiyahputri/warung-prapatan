import { NextRequest, NextResponse } from 'next/server';
import { SupplierService } from '@/lib/db';

interface RouteContext {
  params: Promise<{ id: string }>;
}

export async function PUT(req: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params;
    const supplierId = parseInt(id, 10);
    if (isNaN(supplierId)) {
      return NextResponse.json({ error: 'ID supplier tidak valid' }, { status: 400 });
    }

    const body = await req.json();
    const { name } = body;
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Nama supplier tidak boleh kosong' }, { status: 400 });
    }

    const updated = await SupplierService.updateName(supplierId, name.trim());
    if (!updated) {
      return NextResponse.json({ error: 'Supplier tidak ditemukan' }, { status: 404 });
    }

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating supplier:', error);
    return NextResponse.json({ error: 'Gagal memperbarui nama supplier' }, { status: 500 });
  }
}

// Sesuai Proposal Bab Wireframe Gambar 21: Penghapusan supplier tidak diizinkan agar riwayat transaksi tetap terjaga
export async function DELETE() {
  return NextResponse.json(
    { error: 'Penghapusan supplier tidak diizinkan agar integritas riwayat transaksi tetap terjaga.' },
    { status: 403 }
  );
}
