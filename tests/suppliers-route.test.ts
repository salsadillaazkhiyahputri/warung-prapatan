// PATCH (aktif/nonaktif) dan DELETE (hapus permanen) /api/suppliers/[id], dengan Supabase dan sesi di-mock.
import { describe, it, expect, vi, beforeEach } from 'vitest';

type Result = { data?: unknown; error?: unknown };
interface Call { table: string; ops: { op: string; args: unknown[] }[] }

// Builder palsu ala PostgREST: setiap from() mengambil satu hasil dari antrean dan mencatat operasinya.
const fake = vi.hoisted(() => {
  const state = { queue: [] as Result[], calls: [] as Call[] };
  const from = (table: string) => {
    const call: Call = { table, ops: [] };
    state.calls.push(call);
    const result = state.queue.shift() ?? { data: null, error: null };
    const builder: Record<string, unknown> = {};
    for (const op of ['select', 'eq', 'update', 'delete', 'insert', 'ilike', 'limit', 'order', 'maybeSingle', 'single']) {
      builder[op] = (...args: unknown[]) => {
        call.ops.push({ op, args });
        return builder;
      };
    }
    builder.then = (resolve: (r: Result) => unknown, reject: (e: unknown) => unknown) =>
      Promise.resolve({ data: null, error: null, ...result }).then(resolve, reject);
    return builder;
  };
  return { state, client: { from, rpc: vi.fn() } };
});

const auth = vi.hoisted(() => ({ user: { id: 'u1', username: 'pemilik' } as unknown }));

vi.mock('@/lib/supabase', () => ({ getSupabaseAdmin: () => fake.client }));
vi.mock('@/lib/auth', async () => {
  const { NextResponse } = await import('next/server');
  return {
    getCurrentUser: async () => auth.user,
    unauthorized: () => NextResponse.json({ error: 'Silakan login terlebih dahulu' }, { status: 401 })
  };
});

import { PATCH, DELETE } from '@/app/api/suppliers/[id]/route';

const SUP = { id: 7, name: 'Toko Sinar', jenis: 'utama', created_at: '2026-01-01T00:00:00Z', is_adjustment: false, is_active: true };
const KOREKSI = { ...SUP, id: 1, name: 'Koreksi Stok', jenis: null, is_adjustment: true };

const ctx = (id: string) => ({ params: Promise.resolve({ id }) });
const patchReq = (body: unknown) =>
  new Request('http://x/api/suppliers/7', { method: 'PATCH', body: typeof body === 'string' ? body : JSON.stringify(body) }) as never;
const delReq = () => new Request('http://x/api/suppliers/7', { method: 'DELETE' }) as never;

const queue = (...results: Result[]) => fake.state.queue.push(...results);
const writes = () => fake.state.calls.filter((c) => c.ops.some((o) => o.op === 'update' || o.op === 'delete'));

beforeEach(() => {
  fake.state.queue = [];
  fake.state.calls = [];
  auth.user = { id: 'u1', username: 'pemilik' };
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('PATCH /api/suppliers/[id]', () => {
  it('200: menonaktifkan dan mengembalikan baris terbaru', async () => {
    queue({ data: SUP }, { data: { ...SUP, is_active: false } });
    const res = await PATCH(patchReq({ is_active: false }), ctx('7'));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ id: 7, is_active: false });
    const upd = writes()[0];
    expect(upd.table).toBe('suppliers');
    expect(upd.ops.find((o) => o.op === 'update')?.args[0]).toEqual({ is_active: false });
  });

  it('200: mengaktifkan lagi', async () => {
    queue({ data: { ...SUP, is_active: false } }, { data: SUP });
    const res = await PATCH(patchReq({ is_active: true }), ctx('7'));
    expect(res.status).toBe(200);
    expect(await res.json()).toMatchObject({ is_active: true });
  });

  it('401 tanpa sesi, tanpa menyentuh database', async () => {
    auth.user = null;
    const res = await PATCH(patchReq({ is_active: false }), ctx('7'));
    expect(res.status).toBe(401);
    expect(fake.state.calls).toHaveLength(0);
  });

  it.each(['abc', '0', '-3', '1.5'])('400 untuk id tidak sah (%s)', async (id) => {
    const res = await PATCH(patchReq({ is_active: false }), ctx(id));
    expect(res.status).toBe(400);
    expect(fake.state.calls).toHaveLength(0);
  });

  it.each([
    ['field tambahan is_adjustment', { is_active: false, is_adjustment: false }],
    ['field tambahan name', { is_active: true, name: 'X' }],
    ['is_active bukan boolean', { is_active: 'false' }],
    ['is_active angka', { is_active: 0 }],
    ['body kosong', {}],
    ['hanya is_adjustment', { is_adjustment: true }],
    ['JSON rusak', '{oops']
  ])('400: %s', async (_label, body) => {
    const res = await PATCH(patchReq(body), ctx('7'));
    expect(res.status).toBe(400);
    expect(fake.state.calls).toHaveLength(0);
  });

  it('403 untuk "Koreksi Stok", tanpa UPDATE', async () => {
    queue({ data: KOREKSI });
    const res = await PATCH(patchReq({ is_active: false }), ctx('1'));
    expect(res.status).toBe(403);
    expect(writes()).toHaveLength(0);
  });

  it('404 bila supplier tidak ada', async () => {
    queue({ data: null });
    const res = await PATCH(patchReq({ is_active: false }), ctx('99'));
    expect(res.status).toBe(404);
    expect(writes()).toHaveLength(0);
  });

  it('403 (bukan 500) bila database menolak dengan check_violation', async () => {
    queue({ data: SUP }, { error: { code: '23514', message: 'supplier sistem' } });
    const res = await PATCH(patchReq({ is_active: false }), ctx('7'));
    expect(res.status).toBe(403);
  });
});

describe('DELETE /api/suppliers/[id]', () => {
  it('200: hapus supplier tanpa transaksi, tanpa menghitung transaksi lebih dulu', async () => {
    queue({ data: SUP }, { data: [{ id: 7 }] });
    const res = await DELETE(delReq(), ctx('7'));
    expect(res.status).toBe(200);
    expect(fake.state.calls.some((c) => c.table === 'transactions' || c.table === 'v_supplier_stats')).toBe(false);
    const del = writes()[0];
    expect(del.table).toBe('suppliers');
    expect(del.ops.map((o) => o.op)).toContain('delete');
  });

  it('401 tanpa sesi', async () => {
    auth.user = null;
    const res = await DELETE(delReq(), ctx('7'));
    expect(res.status).toBe(401);
    expect(fake.state.calls).toHaveLength(0);
  });

  it.each(['x', '0', '2147483648'])('400 untuk id tidak sah (%s)', async (id) => {
    const res = await DELETE(delReq(), ctx(id));
    expect(res.status).toBe(400);
    expect(fake.state.calls).toHaveLength(0);
  });

  it('403 untuk "Koreksi Stok", tanpa DELETE', async () => {
    queue({ data: KOREKSI });
    const res = await DELETE(delReq(), ctx('1'));
    expect(res.status).toBe(403);
    expect(writes()).toHaveLength(0);
  });

  it('409 bila sudah punya transaksi (foreign key 23503)', async () => {
    queue({ data: SUP }, { error: { code: '23503', message: 'violates foreign key constraint' } });
    const res = await DELETE(delReq(), ctx('7'));
    expect(res.status).toBe(409);
    expect((await res.json()).error).toBe('Supplier ini sudah punya riwayat, jadi tidak bisa dihapus. Nonaktifkan saja.');
  });

  it('404 bila supplier tidak ada', async () => {
    queue({ data: null });
    const res = await DELETE(delReq(), ctx('99'));
    expect(res.status).toBe(404);
  });

  it('404 bila DELETE tidak menghapus baris apa pun (misalnya sudah dihapus di tab lain)', async () => {
    queue({ data: SUP }, { data: [] });
    const res = await DELETE(delReq(), ctx('7'));
    expect(res.status).toBe(404);
  });
});
