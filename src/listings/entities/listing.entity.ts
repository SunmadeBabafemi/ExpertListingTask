import {
  Check,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
  type Point,
  type ValueTransformer,
} from 'typeorm';
import { ListingType } from '../listing-type.enum.js';

/** pg returns NUMERIC as a string to avoid precision loss; prices fit safely in a JS number. */
const numericTransformer: ValueTransformer = {
  to: (value?: number | null) => value,
  from: (value?: string | null) => (value == null ? value : Number(value)),
};

const LIVE_ROWS = '"deleted_at" IS NULL';

/**
 * Schema is created by migrations (src/database/migration). Indexes and
 * checks are mirrored here so `migration:generate` sees no drift. The
 * reasoning behind each one lives in the CreateListings migration.
 */
@Entity('listings')
@Index('IDX_listings_location', ['location'], {
  spatial: true,
  where: LIVE_ROWS,
})
@Index('IDX_listings_type_price', ['type', 'price'], { where: LIVE_ROWS })
@Index('IDX_listings_bedrooms', ['bedrooms'], { where: LIVE_ROWS })
@Index('IDX_listings_created_at_id', ['createdAt', 'id'], { where: LIVE_ROWS })
@Index('IDX_listings_agent_id', ['agentId'])
@Check('CHK_listings_price_non_negative', '"price" >= 0')
@Check('CHK_listings_bedrooms_non_negative', '"bedrooms" >= 0')
export class Listing {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'varchar', length: 200 })
  title: string;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: numericTransformer,
  })
  price: number;

  @Column({ type: 'enum', enum: ListingType, enumName: 'listing_type_enum' })
  type: ListingType;

  @Column({ type: 'smallint' })
  bedrooms: number;

  /**
   * `geography` (not `geometry`) so distance functions work in metres on the
   * spheroid without any projection maths. GeoJSON order: [lng, lat].
   */
  @Column({ type: 'geography', spatialFeatureType: 'Point', srid: 4326 })
  location: Point;

  @Column({ type: 'varchar', length: 300, nullable: true })
  address: string | null;

  @Column({ type: 'uuid', name: 'agent_id' })
  agentId: string;

  @CreateDateColumn({ type: 'timestamptz', name: 'created_at' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz', name: 'updated_at' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz', name: 'deleted_at' })
  deletedAt: Date | null;
}
