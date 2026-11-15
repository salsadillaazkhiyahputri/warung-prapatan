import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Validasi ringkas token sesi di level proxy/middleware edge:
 * Mendukung format HMAC-SHA256 (3 bagian) dan fallback legacy base64.
 */
function isTokenValid(token?: string): boolean {
  if (!token || typeof token !== 'string') return false;
  try {
    let payloadJson: string;
    if (token.includes('.')) {
      const parts = token.split('.');
      if (parts.length !== 3) return false;
      payloadJson = Buffer.from(parts[1], 'base64url').toString('utf-8');
    } else {
      payloadJson = Buffer.from(token, 'base64').toString('utf-8');
    }
    const data = JSON.parse(payloadJson);
    if (!data || !data.userId) return false;
    if (data.expiresAt && data.expiresAt < Date.now()) return false;
    return true;
  } catch {
    return false;
  }
}

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('warung_session')?.value;
  const hasValidToken = isTokenValid(token);

  // Bypass asset statis Next.js & bot webhook
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/public') ||
    pathname.startsWith('/api/bot') // Telegram webhook bot n8n
  ) {
    return NextResponse.next();
  }

  // Jika membuka halaman /login tapi sudah login sah, arahkan ke dashboard
  if (pathname === '/login') {
    if (hasValidToken) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    // Jika ada token tetapi tidak valid / kedaluwarsa, bersihkan dan tampilkan login
    const response = NextResponse.next();
    if (token && !hasValidToken) {
      response.cookies.delete('warung_session');
    }
    return response;
  }

  // Jika membuka root /, arahkan sesuai status sesi
  if (pathname === '/') {
    if (hasValidToken) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    const response = NextResponse.redirect(new URL('/login', request.url));
    if (token && !hasValidToken) {
      response.cookies.delete('warung_session');
    }
    return response;
  }

  // Endpoint API login bebas diakses
  if (pathname === '/api/auth/login') {
    return NextResponse.next();
  }

  // Proteksi halaman dashboard utama
  const protectedPages = ['/dashboard', '/produk', '/supplier', '/riwayat', '/opname'];
  const isProtectedPage = protectedPages.some(p => pathname === p || pathname.startsWith(p + '/'));

  if (isProtectedPage) {
    if (!hasValidToken) {
      const loginUrl = new URL('/login', request.url);
      const res = NextResponse.redirect(loginUrl);
      if (token && !hasValidToken) {
        res.cookies.delete('warung_session');
      }
      return res;
    }
    return NextResponse.next();
  }

  // Proteksi rute API lainnya
  if (pathname.startsWith('/api/')) {
    if (!hasValidToken) {
      return NextResponse.json(
        { error: 'Sesi tidak sah atau telah kedaluwarsa. Silakan login kembali.' },
        { status: 401 }
      );
    }
    return NextResponse.next();
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)']
};
