import pg from "pg";
const globalDb = globalThis as unknown as { pool?: pg.Pool };
export const pool =
  globalDb.pool ??
  new pg.Pool({
    max: 10,
    connectionTimeoutMillis: 5000,
    idleTimeoutMillis: 30000,
  });
globalDb.pool = pool;
if (pool.listenerCount('error')===0) pool.on('error',()=>console.error(JSON.stringify({event:'database_pool_connection_lost'})));
export async function query<T extends pg.QueryResultRow = pg.QueryResultRow>(
  sql: string,
  params: unknown[] = [],
): Promise<T[]> {
  return (await pool.query<T>(sql, params)).rows;
}
