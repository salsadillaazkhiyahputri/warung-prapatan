import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, unauthorized } from '@/lib/auth';
import { SupplierService } from '@/lib/db';
import { errorResponse } from '@/lib/errors';
import { readJson, cleanText, parseJenis } from '@/lib/validate';

export async function GET() {
  if (!(await getCurrentUser())) return unauthorized();
  try {
    const suppliers = await SupplierService.getAll();
    return NextResponse.json(suppliers);
  } catch (error) {
    return errorResponse(error, 'Gagal mengambil data supplier');
  }
}

export async function POST(req: NextRequest) {
  if (!(await getCurrentUser())) return unauthorized();
  try {
    const body = await readJson(req);
    const name = cleanText(body.name, { field: 'Nama supplier', required: true, max: 100 })!;
    const jenis = parseJenis(body.jenis); // wajib saat tambah

    const newSupplier = await SupplierService.create(name, jenis);
    return NextResponse.json(newSupplier, { status: 201 });
  } catch (error) {
    return errorResponse(error, 'Gagal menambahkan supplier');
  }
}
