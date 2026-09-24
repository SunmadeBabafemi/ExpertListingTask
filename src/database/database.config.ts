import { existsSync } from 'node:fs';
import type { DataSourceOptions } from 'typeorm';

type PostgresConnectionOptions = Extract<
  DataSourceOptions,
  { type: 'postgres' }
>;

export interface DatabaseEnv {
  DATABASE_URL: string;
  DB_SSL?: boolean;
  DB_LOGGING?: boolean;
}

/**
 * Options shared by the Nest app (TypeOrmModule) and the CLI DataSource
 * (ormconfig.ts), so both always talk to the database the same way.
 * Entities/migrations are added by each consumer.
 */
export function baseDatabaseOptions(
  env: DatabaseEnv,
): PostgresConnectionOptions {
  return {
    type: 'postgres',
    url: env.DATABASE_URL,
    // Schema changes only ever happen through migrations.
    synchronize: false,
    logging: env.DB_LOGGING ?? false,
    ssl: env.DB_SSL ? { rejectUnauthorized: false } : false,
  };
}

export const ENV_FILE = '.env';

/**
 * Loads `.env` for standalone scripts (CLI, seeds, test config) that run
 * outside Nest's ConfigModule. Variables already in process.env win.
 */
export function loadEnvFile(): void {
  if (existsSync(ENV_FILE)) process.loadEnvFile(ENV_FILE);
}
