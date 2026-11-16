import { NextResponse } from 'next/server';

// Kesalahan aturan bisnis / validasi yang aman ditampilkan ke pengguna.
// `code` opsional dipakai UI untuk alur khusus (misalnya NEW_PAIR).
export class BusinessError extends Error {
  status: number;
  code?: string;
  constructor(message: string, status = 400, code?: string) {
    super(message);
    this.name = 'BusinessError';
    this.status = status;
    this.code = code;
  }
}

// Ubah error menjadi respons JSON. Error selain BusinessError tidak pernah dibocorkan ke klien.
export function errorResponse(error: unknown, fallback: string, logLabel?: string) {
  if (error instanceof BusinessError) {
    const body: { error: string; code?: string } = { error: error.message };
    if (error.code) body.code = error.code;
    return NextResponse.json(body, { status: error.status });
  }
  console.error(logLabel ?? fallback, error);
  return NextResponse.json({ error: fallback }, { status: 500 });
}
