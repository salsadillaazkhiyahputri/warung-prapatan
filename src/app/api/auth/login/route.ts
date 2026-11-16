import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/lib/db';
import { createSessionToken, AUTH_COOKIE_OPTIONS } from '@/lib/auth';

// Pembatas percobaan login sederhana (per instance server). Cukup untuk menahan tebak-tebakan password.
const attempts = new Map<string, { count: number; resetAt: number }>();
const MAX_ATTEMPTS = 5;
const WINDOW_MS = 15 * 60 * 1000;

function isBlocked(key: string): boolean {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) return false;
  return entry.count >= MAX_ATTEMPTS;
}
function recordFailure(key: string) {
  const now = Date.now();
  const entry = attempts.get(key);
  if (!entry || entry.resetAt < now) attempts.set(key, { count: 1, resetAt: now + WINDOW_MS });
  else entry.count += 1;
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { username, password } = body;

    if (!username || !password) {
      return NextResponse.json(
        { error: 'Username dan password wajib diisi' },
        { status: 400 }
      );
    }

    const ip = req.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'unknown';
    const key = `${ip}|${String(username).toLowerCase()}`;
    if (isBlocked(key)) {
      return NextResponse.json({ error: 'Terlalu banyak percobaan. Coba lagi dalam 15 menit.' }, { status: 429 });
    }

    const user = await AuthService.login(String(username), String(password));
    if (!user) {
      recordFailure(key);
      return NextResponse.json(
        { error: 'Username atau password salah' },
        { status: 401 }
      );
    }

    const token = await createSessionToken(user.id, user.username);
    const response = NextResponse.json({
      success: true,
      user: {
        id: user.id,
        username: user.username,
        telegram_chat_id: user.telegram_chat_id
      }
    });

    response.cookies.set({
      ...AUTH_COOKIE_OPTIONS,
      value: token
    });

    return response;
  } catch (error: any) {
    console.error('Error saat login:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server' },
      { status: 500 }
    );
  }
}
