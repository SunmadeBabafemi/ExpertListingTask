import { join } from 'node:path';
import { DataSource } from 'typeorm';
import { baseDatabaseOptions, loadEnvFile } from './database.config.js';

loadEnvFile();

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
  throw new Error(
    'DATABASE_URL is required to initialize the TypeORM datasource',
  );
}

/**
 * DataSource used by the TypeORM CLI (migrations) and the seed script.
 *
 * The project is native ESM, so the CLI runs against the compiled output in
 * `dist/`, and the globs below only match `.js` files. (`*.js` rather than
 * `*{.ts,.js}` also keeps emitted `.d.ts` files from being picked up.)
 */
export const AppDataSource = new DataSource({
  ...baseDatabaseOptions({
    DATABASE_URL: databaseUrl,
    DB_SSL: process.env.DB_SSL === 'true',
    DB_LOGGING: process.env.DB_LOGGING === 'true',
  }),
  entities: [join(import.meta.dirname, '..', '**', '*.entity.js')],
  migrations: [join(import.meta.dirname, 'migration', '*.js')],
});

export default AppDataSource;
