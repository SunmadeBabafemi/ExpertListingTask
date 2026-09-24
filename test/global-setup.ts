import { execSync } from 'node:child_process';
import pg from 'pg';

/** Creates the test database if needed and brings its schema up to date via the real migration command. */
export default async function setup() {
  const url = new URL(process.env.DATABASE_URL!);
  const dbName = decodeURIComponent(url.pathname.slice(1));

  const adminUrl = new URL(url);
  adminUrl.pathname = '/postgres';
  const client = new pg.Client({ connectionString: adminUrl.toString() });
  await client.connect();
  try {
    const { rowCount } = await client.query(
      'SELECT 1 FROM pg_database WHERE datname = $1',
      [dbName],
    );
    if (!rowCount) {
      await client.query(`CREATE DATABASE "${dbName.replaceAll('"', '""')}"`);
    }
  } finally {
    await client.end();
  }

  try {
    execSync('npm run migration:run', { env: process.env, stdio: 'pipe' });
  } catch (err) {
    const e = err as { stdout?: Buffer; stderr?: Buffer };
    console.error(e.stdout?.toString(), e.stderr?.toString());
    throw new Error('Failed to run migrations against the test database');
  }
}
