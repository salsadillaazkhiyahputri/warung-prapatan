import { NextRequest, NextResponse } from 'next/server';
import { AuthService } from '@/lib/db';
import { createSessionToken, AUTH_COOKIE_OPTIONS } from '@/lib/auth';

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

    const user = await AuthService.login(username, password);
    if (!user) {
      return NextResponse.json(
        { error: 'Username atau password salah' },
        { status: 401 }
      );
    }

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
  } catch (error: any) {
    console.error('Error saat login:', error);
    return NextResponse.json(
      { error: 'Terjadi kesalahan pada server' },
      { status: 500 }
    );
  }
}
