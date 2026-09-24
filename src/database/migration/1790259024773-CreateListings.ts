import type { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Creates the `listings` table and the indexes backing the search endpoint.
 *
 * - `location` is `geography(Point, 4326)` rather than `geometry`, so
 *   distances are computed in metres on the spheroid with no projection maths.
 * - `price` is NUMERIC(14,2): money must not be stored as float.
 * - Listings are soft-deleted (`deleted_at`), so every search index is partial
 *   on `deleted_at IS NULL`. Deleted rows never bloat the hot path.
 * - The GiST index on `location` is what makes `ST_DWithin` an index scan
 *   instead of a full-table distance calculation.
 */
export class CreateListings1790259024773 implements MigrationInterface {
  name = 'CreateListings1790259024773';

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TYPE "listing_type_enum" AS ENUM ('rent', 'sale', 'shortlet')
    `);

    await queryRunner.query(`
      CREATE TABLE IF NOT EXISTS "listings" (
        "id"          UUID                   NOT NULL DEFAULT gen_random_uuid(),
        "title"       VARCHAR(200)           NOT NULL,
        "price"       NUMERIC(14, 2)         NOT NULL,
        "type"        "listing_type_enum"    NOT NULL,
        "bedrooms"    SMALLINT               NOT NULL,
        "location"    geography(Point, 4326) NOT NULL,
        "address"     VARCHAR(300)           NULL,
        "agent_id"    UUID                   NOT NULL,
        "created_at"  TIMESTAMPTZ            NOT NULL DEFAULT now(),
        "updated_at"  TIMESTAMPTZ            NOT NULL DEFAULT now(),
        "deleted_at"  TIMESTAMPTZ            NULL,
        CONSTRAINT "PK_listings_id" PRIMARY KEY ("id"),
        CONSTRAINT "CHK_listings_price_non_negative" CHECK ("price" >= 0),
        CONSTRAINT "CHK_listings_bedrooms_non_negative" CHECK ("bedrooms" >= 0)
      )
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_listings_location"
        ON "listings" USING GIST ("location")
        WHERE "deleted_at" IS NULL
    `);

    // Rent and sale are different markets, so type is almost always filtered
    // first, then a price range.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_listings_type_price"
        ON "listings" ("type", "price")
        WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_listings_bedrooms"
        ON "listings" ("bedrooms")
        WHERE "deleted_at" IS NULL
    `);

    // Default ordering (newest first) with id as the pagination tie-breaker.
    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_listings_created_at_id"
        ON "listings" ("created_at" DESC, "id")
        WHERE "deleted_at" IS NULL
    `);

    await queryRunner.query(`
      CREATE INDEX IF NOT EXISTS "IDX_listings_agent_id"
        ON "listings" ("agent_id")
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_listings_agent_id"');
    await queryRunner.query(
      'DROP INDEX IF EXISTS "IDX_listings_created_at_id"',
    );
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_listings_bedrooms"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_listings_type_price"');
    await queryRunner.query('DROP INDEX IF EXISTS "IDX_listings_location"');
    await queryRunner.query('DROP TABLE IF EXISTS "listings"');
    await queryRunner.query('DROP TYPE IF EXISTS "listing_type_enum"');
  }
}
