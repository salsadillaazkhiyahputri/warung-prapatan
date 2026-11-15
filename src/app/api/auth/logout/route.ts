import { NextResponse } from 'next/server';
import { AUTH_COOKIE_OPTIONS } from '@/lib/auth';

export async function POST() {
  const response = NextResponse.json({ success: true, message: 'Berhasil logout' });
  response.cookies.set({
    ...AUTH_COOKIE_OPTIONS,
    value: '',
    maxAge: 0
  });
  return response;
}
