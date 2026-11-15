import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/lib/db';
import { createSessionToken, AUTH_COOKIE_OPTIONS, LoginRateLimiter } from '@/lib/auth';
import { readJson, cleanText, BusinessError } from '@/lib/validate';

export async function POST(req: NextRequest) {
  try {
    const body = await readJson<{ username?: unknown; password?: unknown }>(req);
    const username = cleanText(body.username, 'Username', 100, 1);
    const password = cleanText(body.password, 'Password', 100, 1);

    // Cek batas percobaan gagal (Rate Limiting)
    const rateCheck = LoginRateLimiter.check(username);
    if (!rateCheck.allowed) {
      return NextResponse.json(
        {
          error: `Terlalu banyak percobaan login yang gagal. Akun dibatasi sementara, silakan coba lagi dalam ${rateCheck.waitMinutes || 15} menit.`
        },
        { status: 429 }
      );
    }

    const user = await AuthService.login(username, password);
    if (!user) {
      LoginRateLimiter.recordFailure(username);
      // Pesan tidak membocorkan apakah username ada
      return NextResponse.json(
        { error: 'Username atau password salah' },
        { status: 401 }
      );
    }

    LoginRateLimiter.recordSuccess(username);

    const token = createSessionToken(user);
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
  } catch (err: any) {
    if (err instanceof BusinessError) {
      return NextResponse.json({ error: err.message }, { status: err.status });
    }
    console.error('Error saat login:', err);
    return NextResponse.json({ error: 'Terjadi kesalahan pada server' }, { status: 500 });
  }
}
