import { existsSync } from 'node:fs';
import { defineConfig } from 'vitest/config';

/**
 * e2e tests run against a real PostgreSQL + PostGIS database, because the
 * geo search can only be meaningfully tested against PostGIS itself.
 *
 * The test database defaults to DATABASE_URL (from .env) with "-test"
 * appended to the database name, e.g. expert-listing -> expert-listing-test.
 * Override with TEST_DATABASE_URL. The global setup creates it if missing and
 * runs the migrations. Tests TRUNCATE tables, hence the name guard below.
 */
if (existsSync('.env')) process.loadEnvFile('.env');

function resolveTestDatabaseUrl(): string {
  if (process.env.TEST_DATABASE_URL) return process.env.TEST_DATABASE_URL;
  if (!process.env.DATABASE_URL) {
    throw new Error('Set DATABASE_URL or TEST_DATABASE_URL to run e2e tests');
  }
  const url = new URL(process.env.DATABASE_URL);
  url.pathname = `${url.pathname}-test`;
  return url.toString();
}

const testDatabaseUrl = resolveTestDatabaseUrl();
const dbName = decodeURIComponent(new URL(testDatabaseUrl).pathname.slice(1));
if (!dbName.includes('test')) {
  throw new Error(
    `Refusing to run e2e tests against "${dbName}": name must contain "test"`,
  );
}

// Visible to the global setup (this process) and, via test.env, to workers.
process.env.DATABASE_URL = testDatabaseUrl;

export default defineConfig({
  resolve: { tsconfigPaths: true },
  test: {
    globals: true,
    root: './',
    include: ['test/**/*.e2e-spec.ts'],
    globalSetup: ['test/global-setup.ts'],
    env: { NODE_ENV: 'test', DATABASE_URL: testDatabaseUrl },
    // Test files share one database.
    fileParallelism: false,
    hookTimeout: 180_000,
  },
});
