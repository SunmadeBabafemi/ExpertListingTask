import { NotFoundException } from '@nestjs/common';
import type { Mocked } from 'vitest';
import type { Listing } from './entities/listing.entity.js';
import { ListingType } from './listing-type.enum.js';
import type { ListingsCache } from './listings.cache.js';
import type { ListingsRepository } from './listings.repository.js';
import { ListingsService } from './listings.service.js';

const AGENT_ID = '6f1c1d9e-2b8a-4d7e-9a57-0e3f2c1b4a10';

function makeListing(overrides: Partial<Listing> = {}): Listing {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    title: '3 bedroom flat',
    price: 4_500_000,
    type: ListingType.Rent,
    bedrooms: 3,
    location: { type: 'Point', coordinates: [3.47, 6.4474] },
    address: 'Lekki Phase 1',
    agentId: AGENT_ID,
    createdAt: new Date('2026-01-01T00:00:00Z'),
    updatedAt: new Date('2026-01-01T00:00:00Z'),
    deletedAt: null,
    ...overrides,
  };
}

describe('ListingsService', () => {
  let repo: Mocked<ListingsRepository>;
  let cache: Mocked<ListingsCache>;
  let service: ListingsService;

  beforeEach(() => {
    repo = {
      create: vi.fn((data: Partial<Listing>) => data as Listing),
      save: vi.fn(async (l: Listing) => ({ ...makeListing(), ...l })),
      findById: vi.fn(),
      softDelete: vi.fn(),
      search: vi.fn(),
    } as unknown as Mocked<ListingsRepository>;
    cache = {
      // Pass-through: these tests are about service logic, not caching.
      wrap: vi.fn(
        (_scope: string, _params: unknown, load: () => Promise<unknown>) =>
          load(),
      ),
      invalidateAll: vi.fn(async () => undefined),
    } as unknown as Mocked<ListingsCache>;
    service = new ListingsService(repo, cache);
  });

  describe('create', () => {
    it('stores location as a GeoJSON point in [lng, lat] order and invalidates the cache', async () => {
      const result = await service.create({
        title: '3 bedroom flat',
        price: 4_500_000,
        type: ListingType.Rent,
        bedrooms: 3,
        location: { lat: 6.4474, lng: 3.47, address: 'Lekki Phase 1' },
        agentId: AGENT_ID,
      });

      expect(repo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          location: { type: 'Point', coordinates: [3.47, 6.4474] },
          address: 'Lekki Phase 1',
        }),
      );
      expect(cache.invalidateAll).toHaveBeenCalledOnce();
      expect(result.location).toEqual({
        lat: 6.4474,
        lng: 3.47,
        address: 'Lekki Phase 1',
      });
    });
  });

  describe('findOne', () => {
    it('returns the mapped listing', async () => {
      repo.findById.mockResolvedValue(makeListing());
      const result = await service.findOne(makeListing().id);
      expect(result).toMatchObject({
        id: makeListing().id,
        location: { lat: 6.4474, lng: 3.47 },
      });
      expect(result).not.toHaveProperty('distanceKm');
    });

    it('throws NotFound for a missing listing', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(service.findOne('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });
  });

  describe('search', () => {
    it('maps hits, converts distance to km and builds pagination meta', async () => {
      repo.search.mockResolvedValue({
        hits: [{ listing: makeListing(), distanceMeters: 5732.6 }],
        total: 41,
      });

      const result = await service.search({
        page: 2,
        limit: 20,
        lat: 6.4,
        lng: 3.4,
        radiusKm: 10,
      });

      expect(result.data[0].distanceKm).toBe(5.733);
      expect(result.meta).toEqual({
        page: 2,
        limit: 20,
        total: 41,
        totalPages: 3,
        hasNextPage: true,
      });
    });

    it('goes through the cache with the full query as key material', async () => {
      repo.search.mockResolvedValue({ hits: [], total: 0 });
      const query = { page: 1, limit: 20, type: ListingType.Sale };
      await service.search(query);
      expect(cache.wrap).toHaveBeenCalledWith(
        'search',
        query,
        expect.any(Function),
      );
    });
  });

  describe('update', () => {
    it('applies partial changes and replaces location as a unit', async () => {
      repo.findById.mockResolvedValue(makeListing());

      const result = await service.update(makeListing().id, {
        price: 5_000_000,
        location: { lat: 6.45, lng: 3.48 },
      });

      const saved = repo.save.mock.calls[0][0];
      expect(saved.price).toBe(5_000_000);
      expect(saved.title).toBe('3 bedroom flat');
      expect(saved.location).toEqual({
        type: 'Point',
        coordinates: [3.48, 6.45],
      });
      expect(saved.address).toBeNull();
      expect(result.price).toBe(5_000_000);
      expect(cache.invalidateAll).toHaveBeenCalledOnce();
    });

    it('throws NotFound and does not write or invalidate for a missing listing', async () => {
      repo.findById.mockResolvedValue(null);
      await expect(
        service.update('missing', { price: 1 }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(repo.save).not.toHaveBeenCalled();
      expect(cache.invalidateAll).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('soft deletes and invalidates the cache', async () => {
      repo.softDelete.mockResolvedValue(true);
      await service.remove('id');
      expect(repo.softDelete).toHaveBeenCalledWith('id');
      expect(cache.invalidateAll).toHaveBeenCalledOnce();
    });

    it('throws NotFound when nothing was deleted', async () => {
      repo.softDelete.mockResolvedValue(false);
      await expect(service.remove('missing')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(cache.invalidateAll).not.toHaveBeenCalled();
    });
  });
});
