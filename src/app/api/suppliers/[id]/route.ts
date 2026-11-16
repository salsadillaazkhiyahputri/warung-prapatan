import { NextRequest, NextResponse } from 'next/server';
import { getCurrentUser, unauthorized } from '@/lib/auth';
import { SupplierService } from '@/lib/db';
import { errorResponse, BusinessError } from '@/lib/errors';
import { readJson, cleanText, parseJenis, requiredId } from '@/lib/validate';
import { SupplierJenis } from '@/types';

interface RouteContext {
  params: Promise<{ id: string }>;
}

const NOT_FOUND = () => NextResponse.json({ error: 'Supplier tidak ditemukan' }, { status: 404 });

// Ubah nama dan/atau jenis.
export async function PUT(req: NextRequest, context: RouteContext) {
  if (!(await getCurrentUser())) return unauthorized();
  try {
    const supplierId = requiredId((await context.params).id, 'ID supplier');
    const body = await readJson(req);

    const patch: { name?: string; jenis?: SupplierJenis } = {};
    if (body.name !== undefined) patch.name = cleanText(body.name, { field: 'Nama supplier', required: true, max: 100 })!;
    if (body.jenis !== undefined) patch.jenis = parseJenis(body.jenis);
    if (Object.keys(patch).length === 0) throw new BusinessError('Tidak ada perubahan yang dikirim');

    const updated = await SupplierService.update(supplierId, patch);
    if (!updated) return NOT_FOUND();
    return NextResponse.json(updated);
  } catch (error) {
    return errorResponse(error, 'Gagal memperbarui supplier');
  }
}

// Aktifkan / nonaktifkan. Body HANYA { "is_active": true|false }; field lain (misalnya is_adjustment) ditolak.
export async function PATCH(req: NextRequest, context: RouteContext) {
  if (!(await getCurrentUser())) return unauthorized();
  try {
    const supplierId = requiredId((await context.params).id, 'ID supplier');
    const body = await readJson(req);
    const keys = Object.keys(body);
    if (keys.length !== 1 || keys[0] !== 'is_active') {
      throw new BusinessError('Hanya field "is_active" yang boleh dikirim');
    }
    if (typeof body.is_active !== 'boolean') throw new BusinessError('"is_active" harus true atau false');

    const updated = await SupplierService.setActive(supplierId, body.is_active);
    if (!updated) return NOT_FOUND();
    return NextResponse.json(updated);
  } catch (error) {
    return errorResponse(error, 'Gagal mengubah status supplier');
  }
}

// Hapus permanen (hanya supplier tanpa transaksi). Database yang memutuskan lewat foreign key:
// 23503 -> 409 "sudah punya riwayat". Tidak ada pra-hitung transaksi di sini.
export async function DELETE(_req: NextRequest, context: RouteContext) {
  if (!(await getCurrentUser())) return unauthorized();
  try {
    const supplierId = requiredId((await context.params).id, 'ID supplier');
    const deleted = await SupplierService.deletePermanent(supplierId);
    if (!deleted) return NOT_FOUND();
    return NextResponse.json({ success: true, message: 'Supplier dihapus permanen' });
  } catch (error) {
    return errorResponse(error, 'Gagal menghapus supplier');
  }
}
