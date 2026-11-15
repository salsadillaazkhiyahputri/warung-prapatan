import { NextRequest, NextResponse } from 'next/server';
import { SupplierService } from '@/lib/db';

export async function GET() {
  try {
    const suppliers = await SupplierService.getAll();
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
  } catch (error: any) {
    console.error('Error creating supplier:', error);
    return NextResponse.json(
      { error: error.message || 'Gagal menambahkan supplier' },
      { status: error.message?.includes('sudah terdaftar') ? 400 : 500 }
    );
  }
}
