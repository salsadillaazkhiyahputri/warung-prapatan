import { createClient, SupabaseClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

export const isSupabaseConfigured = Boolean(
  supabaseUrl &&
  supabaseServiceRoleKey &&
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('your-project')
);

let cachedAdminClient: SupabaseClient | null = null;

/**
 * Mengembalikan Supabase client dengan hak akses service role (hanya dipanggil dari kode server).
 */
export function getSupabaseAdmin(): SupabaseClient | null {
  if (!isSupabaseConfigured) return null;

  if (!cachedAdminClient) {
    cachedAdminClient = createClient(supabaseUrl!, supabaseServiceRoleKey!, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  return cachedAdminClient;
}

// Backward compatibility alias for server code
export const supabaseAdmin = getSupabaseAdmin();
