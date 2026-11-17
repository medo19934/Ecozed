import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Client } from 'pg';

export interface Migration {
  name: string;
  sql: string;
}

/** Reads `prisma/migrations/<name>/migration.sql` in order. */
export async function readMigrations(
  dir = join(__dirname, '..', 'prisma', 'migrations'),
): Promise<Migration[]> {
  const names = (await readdir(dir, { withFileTypes: true }))
    .filter((d) => d.isDirectory())
    .map((d) => d.name)
    .sort();
  return Promise.all(
    names.map(async (name) => ({
      name,
      sql: await readFile(join(dir, name, 'migration.sql'), 'utf8'),
    })),
  );
}

/**
 * Applies migrations that have not run yet (Netlify Function cold start: no Prisma CLI there).
 * Serialised with an advisory lock; each migration runs in its own transaction.
 */
export async function migrate(
  connectionString: string,
  migrations?: Migration[],
): Promise<string[]> {
  const list = migrations ?? (await readMigrations());
  const client = new Client({ connectionString });
  await client.connect();
  const applied: string[] = [];
  try {
    await client.query('SELECT pg_advisory_lock(727274)');
    await client.query(
      'CREATE TABLE IF NOT EXISTS "_latif_migrations" (name text PRIMARY KEY, applied_at timestamptz NOT NULL DEFAULT now())',
    );
    const done = new Set(
      (await client.query<{ name: string }>('SELECT name FROM "_latif_migrations"')).rows.map(
        (r) => r.name,
      ),
    );
    for (const { name, sql } of list) {
      if (done.has(name)) continue;
      await client.query('BEGIN');
      try {
        await client.query(sql);
        await client.query('INSERT INTO "_latif_migrations" (name) VALUES ($1)', [name]);
        await client.query('COMMIT');
        applied.push(name);
      } catch (e) {
        await client.query('ROLLBACK');
        throw e;
      }
    }
  } finally {
    await client.query('SELECT pg_advisory_unlock(727274)').catch(() => undefined);
    await client.end();
  }
  return applied;
}

/**
 * One-time data wipe (e.g. leaving the public demo for real use): when PURGE_DATA_ONCE is set,
 * empties every app table once per distinct value (recorded in "_latif_flags"). Schema is kept;
 * branches are recreated on start.
 */
export async function purgeOnce(
  connectionString: string,
  key: string | undefined,
): Promise<boolean> {
  if (!key) return false;
  const client = new Client({ connectionString });
  await client.connect();
  try {
    await client.query('SELECT pg_advisory_lock(727275)');
    await client.query(
      'CREATE TABLE IF NOT EXISTS "_latif_flags" (name text PRIMARY KEY, at timestamptz NOT NULL DEFAULT now())',
    );
    const done = await client.query('SELECT 1 FROM "_latif_flags" WHERE name = $1', [
      `purge:${key}`,
    ]);
    if (done.rowCount) return false;
    const tables = (
      await client.query<{ tablename: string }>(
        "SELECT tablename FROM pg_tables WHERE schemaname = 'public' AND tablename NOT IN ('_latif_migrations', '_latif_flags', '_prisma_migrations')",
      )
    ).rows.map((r) => `"${r.tablename}"`);
    await client.query('BEGIN');
    if (tables.length) await client.query(`TRUNCATE ${tables.join(', ')} CASCADE`);
    await client.query('INSERT INTO "_latif_flags" (name) VALUES ($1)', [`purge:${key}`]);
    await client.query('COMMIT');
    return true;
  } finally {
    await client.query('SELECT pg_advisory_unlock(727275)').catch(() => undefined);
    await client.end();
  }
}
