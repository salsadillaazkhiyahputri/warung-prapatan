import crypto from 'crypto';
import { cookies } from 'next/headers';
import { User } from '@/types';
import { AuthService } from './db';

const SESSION_COOKIE_NAME = 'warung_session';
const JWT_SECRET = process.env.SESSION_SECRET || 'warung-prapatan-jwt-secret-key-32chars!!';

export interface SessionData {
  userId: string;
  username: string;
  role: 'pemilik';
  expiresAt: number;
}

// In-memory failed login rate limiter: username -> { attempts: number; lockUntil: number }
interface LoginRateRecord {
  attempts: number;
  lockUntil: number;
}

const loginRateMap = new Map<string, LoginRateRecord>();
const MAX_FAILED_ATTEMPTS = 5;
const LOCKOUT_MS = 15 * 60 * 1000; // 15 menit

export const LoginRateLimiter = {
  check(username: string): { allowed: boolean; waitMinutes?: number } {
    const key = username.trim().toLowerCase();
    const record = loginRateMap.get(key);
    if (!record) return { allowed: true };

    const now = Date.now();
    if (record.lockUntil > now) {
      const waitMinutes = Math.ceil((record.lockUntil - now) / 60000);
      return { allowed: false, waitMinutes };
    }

    if (record.lockUntil <= now && record.attempts >= MAX_FAILED_ATTEMPTS) {
      loginRateMap.delete(key);
    }

    return { allowed: true };
  },

  recordFailure(username: string): void {
    const key = username.trim().toLowerCase();
    const now = Date.now();
    const record = loginRateMap.get(key) || { attempts: 0, lockUntil: 0 };
    record.attempts += 1;

    if (record.attempts >= MAX_FAILED_ATTEMPTS) {
      record.lockUntil = now + LOCKOUT_MS;
    }

    loginRateMap.set(key, record);
  },

  recordSuccess(username: string): void {
    const key = username.trim().toLowerCase();
    loginRateMap.delete(key);
  }
};

/**
 * Buat JWT session token terenkripsi HMAC-SHA256 (tahan pemalsuan).
 */
export function createSessionToken(user: User): string {
  const header = { alg: 'HS256', typ: 'JWT' };
  const payload: SessionData = {
    userId: user.id,
    username: user.username,
    role: 'pemilik',
    expiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000 // 7 hari
  };

  const b64Header = Buffer.from(JSON.stringify(header)).toString('base64url');
  const b64Payload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const dataToSign = `${b64Header}.${b64Payload}`;

  const signature = crypto
    .createHmac('sha256', JWT_SECRET)
    .update(dataToSign)
    .digest('base64url');

  return `${dataToSign}.${signature}`;
}

/**
 * Verifikasi token JWT: tanda tangan dicocokkan dengan HMAC-SHA256,
 * kedaluwarsa diperiksa. Token palsu atau kedaluwarsa akan ditolak (return null).
 * Mendukung backward-compatibility untuk token sesi legacy (base64 JSON).
 */
export function decodeSessionToken(token: string): SessionData | null {
  try {
    if (!token || typeof token !== 'string') return null;

    // 1. Coba decode JWT token berformat HMAC-SHA256 (3 bagian: header.payload.signature)
    if (token.includes('.')) {
      const parts = token.split('.');
      if (parts.length === 3) {
        const [b64Header, b64Payload, signature] = parts;
        const dataToSign = `${b64Header}.${b64Payload}`;

        const expectedSignature = crypto
          .createHmac('sha256', JWT_SECRET)
          .update(dataToSign)
          .digest('base64url');

        // Timing-safe comparison untuk mencegah timing attack
        const sigBuffer = Buffer.from(signature);
        const expectedBuffer = Buffer.from(expectedSignature);
        if (sigBuffer.length === expectedBuffer.length && crypto.timingSafeEqual(sigBuffer, expectedBuffer)) {
          const rawPayload = Buffer.from(b64Payload, 'base64url').toString('utf-8');
          const data = JSON.parse(rawPayload) as SessionData;

          if (data && data.userId && (!data.expiresAt || data.expiresAt >= Date.now())) {
            return data;
          }
        }
      }
    }

    // 2. Fallback backward-compatible untuk token sesi lama (single base64 JSON payload)
    // yang tersimpan di browser sebelum pembaruan HMAC-SHA256
    try {
      const legacyRaw = Buffer.from(token, 'base64').toString('utf-8');
      const legacyData = JSON.parse(legacyRaw) as SessionData;
      if (legacyData && legacyData.userId && (!legacyData.expiresAt || legacyData.expiresAt >= Date.now())) {
        return legacyData;
      }
    } catch {
      // bukan legacy token yang valid
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Mengambil data pengguna saat ini dari cookie sesi.
 * Mengembalikan null jika belum login atau token tidak sah.
 */
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
