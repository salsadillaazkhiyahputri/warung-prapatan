import { Pool, QueryResultRow } from 'pg';

let pool: Pool | null = null;

type SqlParameter = string | number | boolean | Date | Buffer | Uint8Array | null | SqlParameter[] | Record<string, unknown>;

/**
 * Sanitasi string koneksi PostgreSQL:
 * Menangani karakter khusus (seperti '#' pada password) agar tidak menyebabkan error URL parser.
 */
function sanitizeConnectionString(url?: string): string {
  if (!url) return '';
  return url.replace(/:([^:@]+)@/, (_, pwd) => {
    return ':' + encodeURIComponent(decodeURIComponent(pwd)) + '@';
  });
}

export function isPostgresConfigured(): boolean {
  return Boolean(process.env.DATABASE_URL);
}

export function getPostgresPool(): Pool | null {
  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) return null;

  if (!pool) {
    const connectionString = sanitizeConnectionString(rawUrl);
    pool = new Pool({
      connectionString,
      ssl: {
        rejectUnauthorized: false
      },
      max: 10,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 5000
    });

    pool.on('error', (err) => {
      console.warn('PostgreSQL Pool unexpected error:', err.message);
    });
  }

  return pool;
}

export async function sqlQuery<T extends QueryResultRow = QueryResultRow>(
  text: string,
  params?: SqlParameter[]
): Promise<T[]> {
  const p = getPostgresPool();
  if (!p) return [];
  try {
    const res = await p.query<T>(text, params);
    return res.rows;
  } catch (err: unknown) {
    console.warn(`PostgreSQL Query Error [${text.slice(0, 60)}...]:`, err instanceof Error ? err.message : String(err));
    throw err;
  }
}
