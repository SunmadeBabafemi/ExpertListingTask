import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Enables PostGIS, which the listings radius search depends on (`geography`
 * type, `ST_DWithin`, `ST_Distance`, GiST indexing on points).
 *
 * Kept separate from the table migration because it's a database-level
 * prerequisite: it needs the PostGIS package installed on the server and
 * sufficient privileges, so failures here are an environment problem, not a
 * schema problem.
 *
 * `down` intentionally does not drop the extension: other schemas/objects in
 * the same database may depend on it.
 */
export class EnablePostgisExtension1790259015845 implements MigrationInterface {
  name = 'EnablePostgisExtension1790259015845';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('CREATE EXTENSION IF NOT EXISTS postgis');
  }

  public async down(): Promise<void> {
    // no-op, see class docblock
  }
}
