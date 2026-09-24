import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import type { Repository, SelectQueryBuilder } from 'typeorm';
import type { SearchListingsQueryDto } from './dto/search-listings.dto.js';
import { Listing } from './entities/listing.entity.js';

export interface ListingSearchHit {
  listing: Listing;
  /** Present only for geo searches. */
  distanceMeters?: number;
}

export interface ListingSearchResult {
  hits: ListingSearchHit[];
  total: number;
}

const ORIGIN = 'ST_SetSRID(ST_MakePoint(:lng, :lat), 4326)::geography';

/**
 * Owns all SQL / PostGIS specifics so the service stays storage-agnostic and
 * easy to unit test.
 */
@Injectable()
export class ListingsRepository {
  constructor(
    @InjectRepository(Listing) private readonly repo: Repository<Listing>,
  ) {}

  findById(id: string): Promise<Listing | null> {
    return this.repo.findOneBy({ id });
  }

  save(listing: Listing): Promise<Listing> {
    return this.repo.save(listing);
  }

  create(data: Partial<Listing>): Listing {
    return this.repo.create(data);
  }

  /** Soft delete. Returns false if no live listing matched. */
  async softDelete(id: string): Promise<boolean> {
    const result = await this.repo.softDelete({ id });
    return (result.affected ?? 0) > 0;
  }

  async search(q: SearchListingsQueryDto): Promise<ListingSearchResult> {
    const qb = this.repo.createQueryBuilder('l');
    const isGeo =
      q.lat !== undefined && q.lng !== undefined && q.radiusKm !== undefined;

    this.applyFilters(qb, q);

    if (isGeo) {
      qb.setParameters({ lat: q.lat, lng: q.lng, radiusM: q.radiusKm! * 1000 })
        // ST_DWithin on geography is index-assisted (GiST) and exact on the
        // spheroid. ST_Distance is only computed for rows that pass it.
        .andWhere(`ST_DWithin(l.location, ${ORIGIN}, :radiusM)`)
        .addSelect(`ST_Distance(l.location, ${ORIGIN})`, 'distance_m');
    }

    this.applySort(qb, q, isGeo);

    const [total, { raw, entities }] = await Promise.all([
      qb.getCount(),
      qb
        .offset((q.page - 1) * q.limit)
        .limit(q.limit)
        .getRawAndEntities<{ l_id: string; distance_m?: string | number }>(),
    ]);

    const distanceById = new Map(
      raw.map((r) => [
        r.l_id,
        r.distance_m == null ? undefined : Number(r.distance_m),
      ]),
    );

    return {
      total,
      hits: entities.map((listing) => ({
        listing,
        distanceMeters: isGeo ? distanceById.get(listing.id) : undefined,
      })),
    };
  }

  private applyFilters(
    qb: SelectQueryBuilder<Listing>,
    q: SearchListingsQueryDto,
  ) {
    if (q.type) qb.andWhere('l.type = :type', { type: q.type });
    if (q.agentId) qb.andWhere('l.agentId = :agentId', { agentId: q.agentId });
    if (q.minPrice !== undefined)
      qb.andWhere('l.price >= :minPrice', { minPrice: q.minPrice });
    if (q.maxPrice !== undefined)
      qb.andWhere('l.price <= :maxPrice', { maxPrice: q.maxPrice });
    if (q.bedrooms !== undefined)
      qb.andWhere('l.bedrooms = :bedrooms', { bedrooms: q.bedrooms });
    if (q.minBedrooms !== undefined)
      qb.andWhere('l.bedrooms >= :minBedrooms', { minBedrooms: q.minBedrooms });
    if (q.maxBedrooms !== undefined)
      qb.andWhere('l.bedrooms <= :maxBedrooms', { maxBedrooms: q.maxBedrooms });
  }

  private applySort(
    qb: SelectQueryBuilder<Listing>,
    q: SearchListingsQueryDto,
    isGeo: boolean,
  ) {
    const sortBy = q.sortBy ?? (isGeo ? 'distance' : 'createdAt');
    const defaultOrder = sortBy === 'createdAt' ? 'desc' : 'asc';
    const direction = (q.order ?? defaultOrder).toUpperCase() as 'ASC' | 'DESC';

    const column = {
      distance: 'distance_m',
      price: 'l.price',
      createdAt: 'l.createdAt',
    }[sortBy];

    // Tie-break on id so pagination is deterministic when sort keys collide.
    qb.orderBy(column, direction).addOrderBy('l.id', 'ASC');
  }
}
