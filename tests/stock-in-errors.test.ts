// Stok masuk ke supplier nonaktif / "Koreksi Stok": pesan jelas, bukan 500. Supabase dan sesi di-mock.
import { describe, it, expect, vi, beforeEach } from 'vitest';

type Result = { data?: unknown; error?: unknown };

const fake = vi.hoisted(() => {
  const state = { queue: [] as Result[], rpc: [] as Result[], rpcCalls: [] as string[] };
  const from = () => {
    const result = state.queue.shift() ?? { data: null, error: null };
    const builder: Record<string, unknown> = {};
    for (const op of ['select', 'eq', 'order', 'limit', 'maybeSingle', 'single', 'range']) builder[op] = () => builder;
    builder.then = (resolve: (r: Result) => unknown) => Promise.resolve({ data: null, error: null, ...result }).then(resolve);
    return builder;
  };
  const rpc = async (name: string) => {
    state.rpcCalls.push(name);
    return { data: null, error: null, ...(state.rpc.shift() ?? {}) };
  };
  return { state, client: { from, rpc } };
});

vi.mock('@/lib/supabase', () => ({ getSupabaseAdmin: () => fake.client }));
vi.mock('@/lib/auth', async () => {
  const { NextResponse } = await import('next/server');
  return {
    getCurrentUser: async () => ({ id: 'u1', username: 'pemilik' }),
    unauthorized: () => NextResponse.json({ error: 'x' }, { status: 401 })
  };
});

import { POST } from '@/app/api/transactions/route';
import { TransactionService } from '@/lib/db';

const PRODUCT = { id: 3, name: 'Indomie', category: 'Mie', unit: 'pcs', stock_current: 5, stock_minimum: 2, is_active: true };
const SUP = { id: 7, name: 'Toko Sinar', jenis: 'utama', is_adjustment: false, is_active: true };

const post = (body: unknown) =>
  POST(new Request('http://x/api/transactions', { method: 'POST', body: JSON.stringify(body) }) as never);

beforeEach(() => {
  fake.state.queue = [];
  fake.state.rpc = [];
  fake.state.rpcCalls = [];
  vi.spyOn(console, 'error').mockImplementation(() => {});
});

describe('POST /api/transactions (stok masuk)', () => {
  it('supplier nonaktif -> 409 dengan pesan jelas, tanpa RPC', async () => {
    fake.state.queue.push({ data: PRODUCT }, { data: { ...SUP, is_active: false } });
    const res = await post({ type: 'in', product_id: 3, qty: 2, supplier_id: 7, confirm_new_pair: true });
    expect(res.status).toBe(409);
    expect(await res.json()).toMatchObject({
      code: 'SUPPLIER_NONAKTIF',
      error: 'Supplier ini sedang nonaktif. Aktifkan dulu di halaman Supplier.'
    });
    expect(fake.state.rpcCalls).toHaveLength(0);
  });

  it('"Koreksi Stok" -> 400, tanpa RPC', async () => {
    fake.state.queue.push({ data: PRODUCT }, { data: { ...SUP, id: 1, name: 'Koreksi Stok', jenis: null, is_adjustment: true } });
    const res = await post({ type: 'in', product_id: 3, qty: 2, supplier_id: 1, confirm_new_pair: true });
    expect(res.status).toBe(400);
    expect(fake.state.rpcCalls).toHaveLength(0);
  });

  it('database menolak (check_violation SUPPLIER_NONAKTIF, balapan) -> 409, bukan 500', async () => {
    fake.state.queue.push({ data: PRODUCT }, { data: SUP });
    fake.state.rpc.push({ error: { code: '23514', message: 'SUPPLIER_NONAKTIF' } });
    const res = await post({ type: 'in', product_id: 3, qty: 2, supplier_id: 7, confirm_new_pair: true });
    expect(res.status).toBe(409);
    expect((await res.json()).error).toContain('nonaktif');
  });
});

describe('TransactionService.create', () => {
  it('check_violation lain pada stok masuk -> pesan "Koreksi Stok", status 400', async () => {
    fake.state.rpc.push({ error: { code: '23514', message: 'koreksi_stok_tidak_boleh_masuk' } });
    await expect(TransactionService.create({ product_id: 3, user_id: 'u1', supplier_id: 1, type: 'in', qty: 1 }))
      .rejects.toMatchObject({ status: 400, code: 'SUPPLIER_SISTEM' });
  });
  it('kode hasil SUPPLIER_NONAKTIF dari fungsi database -> 409', async () => {
    fake.state.rpc.push({ data: { ok: false, code: 'SUPPLIER_NONAKTIF' } });
    await expect(TransactionService.create({ product_id: 3, user_id: 'u1', supplier_id: 7, type: 'in', qty: 1 }))
      .rejects.toMatchObject({ status: 409, code: 'SUPPLIER_NONAKTIF' });
  });
});
