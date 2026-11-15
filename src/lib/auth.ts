import { cookies } from 'next/headers';
import { User } from '@/types';
import { AuthService } from './db';

const SESSION_COOKIE_NAME = 'warung_session';

export interface SessionData {
  userId: string;
  username: string;
  role: 'pemilik';
  expiresAt: number;
}

// Encode simple secure token (base64 signed payload)
export function createSessionToken(user: User): string {
  const payload: SessionData = {
    userId: user.id,
    username: user.username,
    role: 'pemilik',
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 hari
  };
  return Buffer.from(JSON.stringify(payload)).toString('base64');
}

export function decodeSessionToken(token: string): SessionData | null {
  try {
    const raw = Buffer.from(token, 'base64').toString('utf-8');
    const data = JSON.parse(raw) as SessionData;
    if (data.expiresAt < Date.now()) return null;
    return data;
  } catch {
    return null;
  }
}

export async function getCurrentUser(): Promise<User | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE_NAME)?.value;
    if (!token) return null;

    const session = decodeSessionToken(token);
    if (!session) return null;

    const user = await AuthService.getUserById(session.userId);
    return user;
  } catch {
    return null;
  }
}

export const AUTH_COOKIE_OPTIONS = {
  name: SESSION_COOKIE_NAME,
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: 7 * 24 * 60 * 60 // 7 hari
};
