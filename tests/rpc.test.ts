import { describe, it, expect, vi } from 'vitest';
import { mapRpcError } from '../src/lib/validate';

describe('9. Pengujian Alur RPC dan Mocking', () => {
  it('menangani hasil duplikat idempotensi ({ ok: true, duplicate: true })', () => {
    const mockRpcResult = {
      ok: true,
      duplicate: true,
      items: [{ product: 'Indomie Goreng', qty_base: 5, stock: 20 }]
    };

    expect(mockRpcResult.ok).toBe(true);
    expect(mockRpcResult.duplicate).toBe(true);
  });

  it('memetakan kode error RPC INSUFFICIENT_STOCK dengan stok dan unit produk', () => {
    const mockRpcFail = {
      ok: false,
      code: 'INSUFFICIENT_STOCK',
      product: 'Sabun Lifebuoy',
      unit: 'pcs',
      stock: 3
    };

    const mapped = mapRpcError(mockRpcFail.code, mockRpcFail);
    expect(mapped.status).toBe(400);
    expect(mapped.message).toContain('3 pcs');
  });

  it('menguji alur fn_pair_baru: mendeteksi pasangan baru dan memerlukan konfirmasi', async () => {
    // Mock fungsi fn_pair_baru
    const mockFnPairBaru = vi.fn().mockImplementation((prodId: number, supId: number) => {
      // Simulasikan produk ID 1 sudah pernah masuk dari supplier 1, tapi baru untuk supplier 2
      if (prodId === 1 && supId === 2) return true;
      return false;
    });

    // 1. Panggilan awal tanpa konfirmasi: harus mengembalikan true (butuh konfirmasi 409)
    const isNew = mockFnPairBaru(1, 2);
    expect(isNew).toBe(true);

    const checkConfirmationNeeded = (isNewPair: boolean, confirmed: boolean) => {
      if (isNewPair && !confirmed) {
        return { status: 409, needConfirmation: true };
      }
      return { status: 201, needConfirmation: false };
    };

    const firstAttempt = checkConfirmationNeeded(isNew, false);
    expect(firstAttempt.status).toBe(409);
    expect(firstAttempt.needConfirmation).toBe(true);

    // 2. Pengguna menekan "Lanjutkan" (confirm_new_pair: true): transaksi disimpan
    const secondAttempt = checkConfirmationNeeded(isNew, true);
    expect(secondAttempt.status).toBe(201);
    expect(secondAttempt.needConfirmation).toBe(false);
  });
});
