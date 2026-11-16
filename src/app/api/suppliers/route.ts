import { NextRequest, NextResponse } from 'next/server';
import { SupplierService } from '@/lib/db';

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q') || undefined;

    const suppliers = await SupplierService.getAll(q);
    return NextResponse.json(suppliers);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    return NextResponse.json({ error: 'Gagal mengambil data supplier' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { name } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Nama supplier wajib diisi' }, { status: 400 });
    }

    const newSupplier = await SupplierService.create(name.trim());
    return NextResponse.json(newSupplier, { status: 201 });
  } catch (error: unknown) {
    console.error('Error creating supplier:', error);
    const errorMessage = error instanceof Error ? error.message : 'Gagal menambahkan supplier';
    return NextResponse.json(
      { error: errorMessage },
      { status: errorMessage.includes('sudah terdaftar') ? 400 : 500 }
    );
  }
}
