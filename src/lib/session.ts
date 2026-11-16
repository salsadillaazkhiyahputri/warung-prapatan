// Sesi login berbasis JWT bertanda tangan (HS256). Tidak mengimpor database supaya aman dipakai di proxy.ts.
import { SignJWT, jwtVerify } from 'jose';

export const SESSION_COOKIE_NAME = 'warung_session';
const SESSION_MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 hari

function getSecret(): Uint8Array {
  const secret = process.env.SESSION_SECRET;
  if (!secret || secret.length < 32) {
    throw new Error('SESSION_SECRET belum diatur atau kurang dari 32 karakter');
  }
  return new TextEncoder().encode(secret);
}

export const AUTH_COOKIE_OPTIONS = {
  name: SESSION_COOKIE_NAME,
  httpOnly: true,
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax' as const,
  path: '/',
  maxAge: SESSION_MAX_AGE_SECONDS
};

export async function createSessionToken(userId: string, username: string): Promise<string> {
  return new SignJWT({ username })
    .setProtectedHeader({ alg: 'HS256' })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${SESSION_MAX_AGE_SECONDS}s`)
    .sign(getSecret());
}

export async function verifySessionToken(token: string): Promise<{ userId: string; username: string } | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret(), { algorithms: ['HS256'] });
    if (!payload.sub) return null;
    return { userId: payload.sub, username: String(payload.username ?? '') };
  } catch {
    return null;
  }
}
