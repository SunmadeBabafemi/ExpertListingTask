import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { AppModule } from '../src/app.module.js';
import { configureApp } from '../src/app.setup.js';
import { ListingsCache } from '../src/listings/listings.cache.js';

const AGENT_A = '6f1c1d9e-2b8a-4d7e-9a57-0e3f2c1b4a10';
const AGENT_B = 'b3a0e7c2-5d14-4f6a-8c1e-2f9d7a6b5c40';
const BASE = '/api/v1/listings';

/** Search centre: Victoria Island, Lagos. Distances below are measured from here. */
const VI = { lat: 6.4281, lng: 3.4219 };

const FIXTURES = {
  // ~3.3 km from VI
  ikoyi: {
    title: 'Ikoyi 2 bed',
    price: 6_000_000,
    type: 'rent',
    bedrooms: 2,
    location: { lat: 6.4549, lng: 3.4346 },
  },
  // ~5.7 km from VI
  lekki: {
    title: 'Lekki 3 bed',
    price: 4_500_000,
    type: 'rent',
    bedrooms: 3,
    location: { lat: 6.4474, lng: 3.47 },
  },
  // ~18 km from VI
  ikeja: {
    title: 'Ikeja duplex',
    price: 250_000_000,
    type: 'sale',
    bedrooms: 4,
    location: { lat: 6.5779, lng: 3.3515 },
  },
  // ~5.4 km from VI, but a shortlet
  lekkiShortlet: {
    title: 'Lekki studio',
    price: 65_000,
    type: 'shortlet',
    bedrooms: 1,
    location: { lat: 6.4298, lng: 3.4705 },
  },
  // ~500 km away
  abuja: {
    title: 'Maitama mansion',
    price: 600_000_000,
    type: 'sale',
    bedrooms: 5,
    location: { lat: 9.0833, lng: 7.4966 },
  },
} as const;

describe('Listings API (e2e)', () => {
  let app: INestApplication;
  let http: ReturnType<typeof request>;

  const create = async (body: object, agentId = AGENT_A) => {
    const res = await http
      .post(BASE)
      .send({ agentId, ...body })
      .expect(201);
    return res.body.data as { id: string; [k: string]: unknown };
  };

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = configureApp(moduleRef.createNestApplication());
    await app.init();
    http = request(app.getHttpServer());
  });

  beforeEach(async () => {
    await app.get(DataSource).query('TRUNCATE TABLE "listings"');
    await app.get(ListingsCache).invalidateAll();
  });

  afterAll(async () => {
    await app?.close();
  });

  describe('POST /listings', () => {
    it('creates a listing and returns it', async () => {
      const res = await http
        .post(BASE)
        .send({
          ...FIXTURES.lekki,
          location: { ...FIXTURES.lekki.location, address: 'Lekki Phase 1' },
          agentId: AGENT_A,
        })
        .expect(201);

      expect(res.body).toMatchObject({
        status: 201,
        success: true,
        message: 'Listing created successfully',
      });
      expect(res.body.data).toMatchObject({
        id: expect.any(String),
        title: 'Lekki 3 bed',
        price: 4_500_000,
        type: 'rent',
        bedrooms: 3,
        location: { lat: 6.4474, lng: 3.47, address: 'Lekki Phase 1' },
        agentId: AGENT_A,
      });
      expect(res.body.data).not.toHaveProperty('deletedAt');
    });

    it('returns 400 with per-field errors for invalid input', async () => {
      const res = await http
        .post(BASE)
        .send({
          title: 'ab',
          price: -5,
          type: 'lease',
          bedrooms: 1.5,
          location: { lat: 95, lng: 3 },
          agentId: 'x',
        })
        .expect(400);

      expect(res.body).toMatchObject({
        status: 'failed',
        success: false,
        error: 'Bad Request',
        message: 'Validation failed',
        errorCode: 400,
      });
      expect(res.body.errors.map((e: { field: string }) => e.field)).toEqual(
        expect.arrayContaining([
          'title',
          'price',
          'type',
          'bedrooms',
          'location.lat',
          'agentId',
        ]),
      );
    });

    it('rejects unknown properties', async () => {
      const res = await http
        .post(BASE)
        .send({ ...FIXTURES.lekki, agentId: AGENT_A, isFeatured: true })
        .expect(400);
      expect(res.body.errors).toEqual([
        {
          field: 'isFeatured',
          messages: ['property isFeatured should not exist'],
        },
      ]);
    });

    it('requires a location', async () => {
      const { location: _omit, ...noLocation } = FIXTURES.lekki;
      const res = await http
        .post(BASE)
        .send({ ...noLocation, agentId: AGENT_A })
        .expect(400);
      expect(res.body.errors.map((e: { field: string }) => e.field)).toContain(
        'location',
      );
    });
  });

  describe('GET /listings/:id', () => {
    it('returns the listing', async () => {
      const created = await create(FIXTURES.ikoyi);
      const res = await http.get(`${BASE}/${created.id}`).expect(200);
      expect(res.body.data).toEqual(created);
    });

    it('returns 404 for an unknown id', async () => {
      const res = await http
        .get(`${BASE}/2b6f0c1e-9d3a-4c5b-8e7f-1a2b3c4d5e6f`)
        .expect(404);
      expect(res.body).toEqual({
        status: 'failed',
        success: false,
        error: 'Not Found',
        message: 'Listing 2b6f0c1e-9d3a-4c5b-8e7f-1a2b3c4d5e6f not found',
        errorCode: 404,
      });
    });

    it('returns 400 for a malformed id', async () => {
      await http.get(`${BASE}/not-a-uuid`).expect(400);
    });
  });

  describe('errors raised outside services use the same envelope', () => {
    const envelope = (errorCode: number) => ({
      status: 'failed',
      success: false,
      error: expect.any(String),
      message: expect.any(String),
      errorCode,
    });

    it('malformed uuid', async () => {
      const res = await http.get(`${BASE}/not-a-uuid`).expect(400);
      expect(res.body).toEqual(envelope(400));
    });

    it('malformed JSON body', async () => {
      const res = await http
        .post(BASE)
        .set('content-type', 'application/json')
        .send('{bad json')
        .expect(400);
      expect(res.body).toEqual(envelope(400));
    });

    it('unknown route', async () => {
      const res = await http.get('/api/v1/nope').expect(404);
      expect(res.body).toEqual(envelope(404));
    });
  });

  describe('PATCH /listings/:id', () => {
    it('updates only the provided fields', async () => {
      const created = await create(FIXTURES.lekki);
      const res = await http
        .patch(`${BASE}/${created.id}`)
        .send({ price: 5_000_000 })
        .expect(200);

      expect(res.body.data).toMatchObject({
        price: 5_000_000,
        title: 'Lekki 3 bed',
        bedrooms: 3,
      });
      expect(
        new Date(res.body.data.updatedAt).getTime(),
      ).toBeGreaterThanOrEqual(new Date(created.updatedAt as string).getTime());
    });

    it('moves the listing when location changes (reflected in geo search)', async () => {
      const created = await create(FIXTURES.ikeja);
      await http
        .patch(`${BASE}/${created.id}`)
        .send({ location: FIXTURES.ikoyi.location })
        .expect(200);

      const res = await http
        .get(`${BASE}/search`)
        .query({ ...VI, radiusKm: 5 })
        .expect(200);
      expect(res.body.data.map((l: { id: string }) => l.id)).toEqual([
        created.id,
      ]);
    });

    it('does not allow changing the owning agent', async () => {
      const created = await create(FIXTURES.lekki);
      await http
        .patch(`${BASE}/${created.id}`)
        .send({ agentId: AGENT_B })
        .expect(400);
    });

    it('returns 404 for an unknown id', async () => {
      await http
        .patch(`${BASE}/2b6f0c1e-9d3a-4c5b-8e7f-1a2b3c4d5e6f`)
        .send({ price: 1 })
        .expect(404);
    });
  });

  describe('DELETE /listings/:id', () => {
    it('deletes the listing and hides it from reads and searches', async () => {
      const created = await create(FIXTURES.ikoyi);
      const del = await http.delete(`${BASE}/${created.id}`).expect(200);
      expect(del.body).toEqual({
        status: 200,
        success: true,
        message: 'Listing deleted successfully',
        data: null,
      });

      await http.get(`${BASE}/${created.id}`).expect(404);
      await http.delete(`${BASE}/${created.id}`).expect(404);
      const search = await http
        .get(`${BASE}/search`)
        .query({ ...VI, radiusKm: 10 })
        .expect(200);
      expect(search.body.meta.total).toBe(0);
    });
  });

  describe('GET /listings (pagination)', () => {
    it('paginates newest first with accurate metadata', async () => {
      const ids: string[] = [];
      for (const fixture of Object.values(FIXTURES))
        ids.push((await create(fixture)).id);

      const page1 = await http
        .get(BASE)
        .query({ limit: 2, page: 1 })
        .expect(200);
      const page3 = await http
        .get(BASE)
        .query({ limit: 2, page: 3 })
        .expect(200);

      expect(page1.body.meta).toEqual({
        page: 1,
        limit: 2,
        total: 5,
        totalPages: 3,
        hasNextPage: true,
      });
      expect(page1.body.data.map((l: { id: string }) => l.id)).toEqual([
        ids[4],
        ids[3],
      ]);
      expect(page3.body.meta.hasNextPage).toBe(false);
      expect(page3.body.data.map((l: { id: string }) => l.id)).toEqual([
        ids[0],
      ]);
    });

    it('returns an empty page past the end rather than an error', async () => {
      await create(FIXTURES.lekki);
      const res = await http.get(BASE).query({ page: 5 }).expect(200);
      expect(res.body).toMatchObject({ data: [], meta: { total: 1, page: 5 } });
    });

    it('caps the page size', async () => {
      await http.get(BASE).query({ limit: 1000 }).expect(400);
    });
  });

  describe('GET /listings/search', () => {
    beforeEach(async () => {
      await create(FIXTURES.ikoyi);
      await create(FIXTURES.lekki);
      await create(FIXTURES.ikeja, AGENT_B);
      await create(FIXTURES.lekkiShortlet);
      await create(FIXTURES.abuja, AGENT_B);
    });

    const titles = (res: request.Response) =>
      res.body.data.map((l: { title: string }) => l.title);

    it('filters by type', async () => {
      const res = await http
        .get(`${BASE}/search`)
        .query({ type: 'sale' })
        .expect(200);
      expect(titles(res).sort()).toEqual(['Ikeja duplex', 'Maitama mansion']);
    });

    it('filters by price range (inclusive)', async () => {
      const res = await http
        .get(`${BASE}/search`)
        .query({ minPrice: 4_500_000, maxPrice: 250_000_000, sortBy: 'price' })
        .expect(200);
      expect(titles(res)).toEqual([
        'Lekki 3 bed',
        'Ikoyi 2 bed',
        'Ikeja duplex',
      ]);
    });

    it('filters by exact and minimum bedrooms', async () => {
      const exact = await http
        .get(`${BASE}/search`)
        .query({ bedrooms: 3 })
        .expect(200);
      expect(titles(exact)).toEqual(['Lekki 3 bed']);

      const min = await http
        .get(`${BASE}/search`)
        .query({ minBedrooms: 4 })
        .expect(200);
      expect(titles(min).sort()).toEqual(['Ikeja duplex', 'Maitama mansion']);
    });

    it('filters by agent', async () => {
      const res = await http
        .get(`${BASE}/search`)
        .query({ agentId: AGENT_B })
        .expect(200);
      expect(res.body.meta.total).toBe(2);
    });

    it('returns only listings within the radius, nearest first, with distances', async () => {
      const res = await http
        .get(`${BASE}/search`)
        .query({ ...VI, radiusKm: 6 })
        .expect(200);

      expect(titles(res)).toEqual([
        'Ikoyi 2 bed',
        'Lekki studio',
        'Lekki 3 bed',
      ]);
      const distances = res.body.data.map(
        (l: { distanceKm: number }) => l.distanceKm,
      );
      expect(distances[0]).toBeCloseTo(3.3, 0);
      expect(distances[2]).toBeCloseTo(5.7, 0);
      expect(distances).toEqual([...distances].sort((a, b) => a - b));
      distances.forEach((d: number) => expect(d).toBeLessThanOrEqual(6));
    });

    it('tightening the radius excludes farther listings', async () => {
      const res = await http
        .get(`${BASE}/search`)
        .query({ ...VI, radiusKm: 4 })
        .expect(200);
      expect(titles(res)).toEqual(['Ikoyi 2 bed']);
    });

    it('combines geo and attribute filters', async () => {
      const res = await http
        .get(`${BASE}/search`)
        .query({ ...VI, radiusKm: 25, type: 'rent', minBedrooms: 3 })
        .expect(200);
      expect(titles(res)).toEqual(['Lekki 3 bed']);
    });

    it('can sort a geo search by price instead of distance', async () => {
      const res = await http
        .get(`${BASE}/search`)
        .query({ ...VI, radiusKm: 6, sortBy: 'price', order: 'desc' })
        .expect(200);
      expect(titles(res)).toEqual([
        'Ikoyi 2 bed',
        'Lekki 3 bed',
        'Lekki studio',
      ]);
      expect(res.body.data[0]).toHaveProperty('distanceKm');
    });

    it('omits distanceKm for non-geo searches', async () => {
      const res = await http
        .get(`${BASE}/search`)
        .query({ type: 'rent' })
        .expect(200);
      expect(res.body.data[0]).not.toHaveProperty('distanceKm');
    });

    it('paginates search results', async () => {
      const res = await http
        .get(`${BASE}/search`)
        .query({ ...VI, radiusKm: 6, limit: 2, page: 2 })
        .expect(200);
      expect(titles(res)).toEqual(['Lekki 3 bed']);
      expect(res.body.meta).toMatchObject({
        total: 3,
        totalPages: 2,
        hasNextPage: false,
      });
    });

    it.each([
      [{ lat: VI.lat, lng: VI.lng }, 'lat'],
      [{ ...VI, radiusKm: 500 }, 'radiusKm'],
      [{ minPrice: 10, maxPrice: 5 }, 'maxPrice'],
      [{ sortBy: 'distance' }, 'sortBy'],
    ])('rejects invalid search %o', async (query, field) => {
      const res = await http.get(`${BASE}/search`).query(query).expect(400);
      expect(res.body.errors.map((e: { field: string }) => e.field)).toContain(
        field,
      );
    });

    it('never serves stale cached results after a write', async () => {
      const query = { ...VI, radiusKm: 4 };
      const before = await http.get(`${BASE}/search`).query(query).expect(200);
      expect(before.body.meta.total).toBe(1);

      const added = await create({
        ...FIXTURES.ikoyi,
        title: 'New Ikoyi flat',
      });
      const afterCreate = await http
        .get(`${BASE}/search`)
        .query(query)
        .expect(200);
      expect(afterCreate.body.meta.total).toBe(2);

      await http.delete(`${BASE}/${added.id}`).expect(200);
      const afterDelete = await http
        .get(`${BASE}/search`)
        .query(query)
        .expect(200);
      expect(afterDelete.body.meta.total).toBe(1);
    });
  });

  describe('GET /health', () => {
    it('reports the database as up', async () => {
      const res = await http.get('/health').expect(200);
      expect(res.body).toMatchObject({
        status: 'ok',
        info: { database: { status: 'up' } },
      });
    });
  });
});
