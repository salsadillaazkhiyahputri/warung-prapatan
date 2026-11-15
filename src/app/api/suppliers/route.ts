import { NextRequest, NextResponse } from 'next/server';
import { SupplierService } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { readJson, cleanText, validateSupplierJenis, BusinessError } from '@/lib/validate';

export async function GET() {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  try {
    const suppliers = await SupplierService.getAll();
    return NextResponse.json(suppliers);
  } catch (error) {
    console.error('Error fetching suppliers:', error);
    return NextResponse.json({ error: 'Gagal mengambil data supplier' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  try {
    const body = await readJson<Record<string, unknown>>(req);

    const name = cleanText(body.name, 'Nama supplier', 100, 1);
    const jenis = validateSupplierJenis(body.jenis);
    const phone = body.phone ? cleanText(body.phone, 'Nomor telepon', 50, 0) : null;

    const newSupplier = await SupplierService.create({
      name,
      jenis,
      phone
    });

    return NextResponse.json(newSupplier, { status: 201 });
  } catch (err: any) {
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Error creating supplier:', err);
    return NextResponse.json({ error: 'Gagal menambahkan supplier' }, { status: 500 });
  }
}
