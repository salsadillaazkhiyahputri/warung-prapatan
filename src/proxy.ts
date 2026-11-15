import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const token = request.cookies.get('warung_session')?.value;

  // Bypass asset statis Next.js
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/favicon.ico') ||
    pathname.startsWith('/public') ||
    pathname.startsWith('/api/bot') // Telegram webhook bot n8n
  ) {
    return NextResponse.next();
  }

  // Jika membuka halaman /login tapi sudah memiliki token sesi, arahkan langsung ke dashboard
  if (pathname === '/login') {
    if (token) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.next();
  }

  // Jika membuka root /, arahkan sesuai status sesi
  if (pathname === '/') {
    if (token) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // Endpoint API login bebas diakses
  if (pathname === '/api/auth/login') {
    return NextResponse.next();
  }

  // Proteksi halaman dashboard utama
  const protectedPages = ['/dashboard', '/produk', '/supplier', '/riwayat', '/opname'];
  const isProtectedPage = protectedPages.some(p => pathname === p || pathname.startsWith(p + '/'));

  if (isProtectedPage) {
    if (!token) {
      const loginUrl = new URL('/login', request.url);
      return NextResponse.redirect(loginUrl);
    }
    return NextResponse.next();
  }

  // Proteksi rute API lainnya
  if (pathname.startsWith('/api/')) {
    if (!token) {
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
