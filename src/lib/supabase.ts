import { createClient, SupabaseClient } from '@supabase/supabase-js';

// Hanya dipakai di server (route API). Kunci service_role TIDAK boleh diberi awalan NEXT_PUBLIC_.
let admin: SupabaseClient | null = null;

export function getSupabaseAdmin(): SupabaseClient {
  if (admin) return admin;
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const isLocalE2ESupabase =
    url === 'http://127.0.0.1:54321' || url === 'http://localhost:54321';
  if (!url || !key || (!url.startsWith('https://') && !isLocalE2ESupabase)) {
    throw new Error('NEXT_PUBLIC_SUPABASE_URL dan SUPABASE_SERVICE_ROLE_KEY wajib diisi');
  }
  admin = createClient(url, key, { auth: { autoRefreshToken: false, persistSession: false } });
  return admin;
}
