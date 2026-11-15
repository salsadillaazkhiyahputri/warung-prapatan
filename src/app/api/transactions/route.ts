import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import { TransactionService, ProductService, SupplierService } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import {
  readJson,
  cleanText,
  parseInteger,
  optionalId,
  dateRange,
  mapRpcError,
  BusinessError
} from '@/lib/validate';

export async function GET(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  try {
    const { searchParams } = new URL(req.url);
    const startDateParam = searchParams.get('startDate') || undefined;
    const endDateParam = searchParams.get('endDate') || undefined;
    const prodIdParam = searchParams.get('productId');
    const typeParam = searchParams.get('type') || 'all';

    // Validasi ketat rentang tanggal kalender
    const { startDate, endDate } = dateRange(startDateParam, endDateParam);
    const productId = optionalId(prodIdParam, 'ID produk');

    const transactions = await TransactionService.getHistory({
      startDate,
      endDate,
      productId: productId ?? undefined,
      type: typeParam !== 'all' ? typeParam : undefined
    });

    return NextResponse.json(transactions);
  } catch (err: any) {
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Error fetching transactions:', err);
    return NextResponse.json({ error: 'Gagal mengambil riwayat transaksi' }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const user = await getCurrentUser();
  if (!user) {
    return NextResponse.json({ error: 'Tidak terautentikasi' }, { status: 401 });
  }

  try {
    const body = await readJson<Record<string, any>>(req);

    const productId = parseInteger(body.product_id, 'ID produk', 1);
    const rawType = cleanText(body.type, 'Tipe transaksi', 10, 1).toLowerCase();
    if (rawType !== 'in' && rawType !== 'out') {
      throw new BusinessError('Tipe transaksi harus "in" atau "out"', 400, 'INVALID_TYPE');
    }
    const type = rawType as 'in' | 'out';

    // Validasi ketat jumlah 1 sampai 100.000 (menolak pecahan, negatif, 0, teks 5abc)
    const qty = parseInteger(body.qty, 'Jumlah barang', 1, 100000);

    // Kunci Idempotensi wajib berbentuk web:<uuid>
    let idemKey = body.idem_key ? String(body.idem_key).trim() : '';
    if (!idemKey || !/^web:[0-9a-fA-F-]{36}$/.test(idemKey)) {
      idemKey = `web:${crypto.randomUUID()}`;
    }

    let supplierId: number | null = null;
    let note: string | null = null;

    if (type === 'in') {
      supplierId = parseInteger(body.supplier_id, 'Supplier', 1);

      // Cek apakah produk dan supplier valid
      const [product, supplier] = await Promise.all([
        ProductService.getById(productId),
        SupplierService.getById(supplierId)
      ]);

      if (!product) {
        throw new BusinessError('Produk tidak ditemukan', 404, 'PRODUCT_NOT_FOUND');
      }
      if (!supplier) {
        throw new BusinessError('Supplier tidak ditemukan', 404, 'SUPPLIER_UNKNOWN');
      }

      // Cek apakah pasangan produk + supplier merupakan pasangan baru
      const isNewPair = await TransactionService.checkNewPair(productId, supplierId);
      if (isNewPair && body.confirm_new_pair !== true) {
        return NextResponse.json(
          {
            need_confirmation: true,
            code: 'CONFIRM_NEW_PAIR',
            message: `"${product.name}" belum pernah masuk dari "${supplier.name}". Lanjutkan mencatat?`,
            product_name: product.name,
            supplier_name: supplier.name,
            idem_key: idemKey
          },
          { status: 409 }
        );
      }

      if (body.note) {
        note = cleanText(body.note, 'Catatan', 200, 0);
      }
    } else {
      // Transaksi 'out' tidak boleh punya supplier
      supplierId = null;

      // Alasan keluar manual wajib diisi minimal 3 karakter (barang rusak/hilang)
      note = cleanText(body.note, 'Alasan barang keluar', 200, 3);
    }

    // Catat pergerakan stok via RPC (Stok tidak pernah diubah via UPDATE langsung)
    const rpcResult = await TransactionService.recordMovement({
      userId: user.id,
      type,
      productId,
      qty,
      supplierId,
      note,
      idemKey
    });

    if (!rpcResult.ok) {
      const mapped = mapRpcError(rpcResult.code || 'UNKNOWN_ERROR', rpcResult as any);
      return NextResponse.json({ error: mapped.message, code: rpcResult.code }, { status: mapped.status });
    }

    // Tangani kemungkinan duplikasi idempotensi
    if (rpcResult.duplicate) {
      return NextResponse.json(
        {
          success: true,
          duplicate: true,
          message: 'Transaksi telah berhasil dicatat sebelumnya (duplikat diabaikan)',
          ...rpcResult
        },
        { status: 200 }
      );
    }

    return NextResponse.json(
      {
        success: true,
        message: type === 'in' ? 'Stok masuk berhasil dicatat' : 'Stok keluar berhasil dicatat',
        ...rpcResult
      },
      { status: 201 }
    );
  } catch (err: any) {
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message, code: err.code }, { status: err.status });
    }
    console.error('Error creating transaction:', err);
    return NextResponse.json({ error: 'Gagal mencatat transaksi stok' }, { status: 500 });
  }
}
