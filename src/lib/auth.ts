import { cookies } from 'next/headers';
import { NextResponse } from 'next/server';
import { User } from '@/types';
import { AuthService } from './db';
import { SESSION_COOKIE_NAME, verifySessionToken } from './session';

export { AUTH_COOKIE_OPTIONS, createSessionToken } from './session';

export async function getCurrentUser(): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const session = await verifySessionToken(token);
    if (!session) return null;

    return await AuthService.getUserById(session.userId);
  } catch {
    return null;
  }
}

export function unauthorized() {
  return NextResponse.json({ error: 'Silakan login terlebih dahulu' }, { status: 401 });
}
