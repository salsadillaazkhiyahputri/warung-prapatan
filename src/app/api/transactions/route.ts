import { NextRequest, NextResponse } from 'next/server';
import { TransactionService, ProductService, assertSupplierForStockIn } from '@/lib/db';
import { getCurrentUser, unauthorized } from '@/lib/auth';
import { errorResponse, BusinessError } from '@/lib/errors';
import { readJson, cleanText, parseInteger, requiredId, optionalId, parseBoolean, parseHistoryFilters } from '@/lib/validate';

export async function GET(req: NextRequest) {
  if (!(await getCurrentUser())) return unauthorized();
  try {
    const filters = parseHistoryFilters(new URL(req.url).searchParams);
    const transactions = await TransactionService.getHistory(filters);
    return NextResponse.json(transactions);
  } catch (error) {
    return errorResponse(error, 'Gagal mengambil riwayat transaksi');
  }
}

const NEW_PAIR_MESSAGE = 'Belum pernah masuk dari supplier ini. Lanjutkan?';

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) return unauthorized();
  try {
    const body = await readJson(req);
    const type = body.type;
    if (type !== 'in' && type !== 'out') throw new BusinessError('Tipe transaksi harus "in" atau "out"');

    const productId = requiredId(body.product_id, 'Produk');
    const qty = parseInteger(body.qty, { field: 'Jumlah', required: true, min: 1, max: 100_000 });
    const confirmNewPair = parseBoolean(body.confirm_new_pair);
    const idempotencyKey = typeof body.idempotency_key === 'string' ? body.idempotency_key : undefined;

    // Keluar manual (barang rusak/hilang) wajib diberi alasan di catatan.
    const note = type === 'out'
      ? cleanText(body.note, { field: 'Alasan barang keluar', required: true, min: 3, max: 200 })
      : cleanText(body.note, { field: 'Catatan', max: 200 });

    const supplierId = type === 'in' ? optionalId(body.supplier_id, 'Supplier') : null;
    if (type === 'in' && !supplierId) throw new BusinessError('Supplier wajib dipilih untuk transaksi stok masuk');

    const product = await ProductService.getById(productId);
    if (!product) return NextResponse.json({ error: 'Produk tidak ditemukan' }, { status: 404 });

    // Stok masuk: supplier harus ada, aktif, dan bukan "Koreksi Stok" (database juga menolak, check_violation).
    if (type === 'in') await assertSupplierForStockIn(supplierId!);

    // Peringatan lunak: kombinasi produk + supplier baru perlu dikonfirmasi. Tidak ada yang disimpan.
    if (type === 'in' && !confirmNewPair && (await TransactionService.isNewPair(productId, supplierId!))) {
      return NextResponse.json({ code: 'NEW_PAIR', error: NEW_PAIR_MESSAGE }, { status: 409 });
    }

    // Pemeriksaan stok final tetap di database (fungsi RPC mengunci baris).
    const newTrx = await TransactionService.create({
      product_id: product.id,
      user_id: user.id,
      supplier_id: supplierId,
      type,
      qty,
      note,
      idempotency_key: idempotencyKey
    });

    return NextResponse.json(newTrx, { status: 201 });
  } catch (error) {
    return errorResponse(error, 'Gagal membuat transaksi');
  }
}
