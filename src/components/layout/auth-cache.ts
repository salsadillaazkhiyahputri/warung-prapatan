// Cache "sudah terverifikasi login" per tab, supaya pindah halaman tidak menunggu /api/auth/me.
// PENTING: hanya boleh dipanggil dari useEffect atau event handler, TIDAK saat render,
// agar render pertama di client identik dengan render server (tanpa hydration mismatch).
const AUTH_CACHE_KEY = 'wp_authenticated';
let authVerifiedInTab = false;

export function readAuthCache(): boolean {
  if (authVerifiedInTab) return true;
  try {
    return sessionStorage.getItem(AUTH_CACHE_KEY) === 'true';
  } catch {
    return false;
  }
}

export function writeAuthCache(ok: boolean) {
  authVerifiedInTab = ok;
  try {
    if (ok) sessionStorage.setItem(AUTH_CACHE_KEY, 'true');
    else sessionStorage.removeItem(AUTH_CACHE_KEY);
  } catch {
    // sessionStorage bisa diblokir (mode privat); cache modul tetap jalan.
  }
}

export function clearAuthCache() {
  writeAuthCache(false);
}
