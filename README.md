# Property Listings API

A small REST API for property listings: CRUD, plus a search endpoint that filters by type, price, and bedrooms and finds listings within _X_ km of a point.

**Stack:** NestJS 12 (TypeScript, native ESM) · PostgreSQL + PostGIS · TypeORM · class-validator · Vitest + Supertest · Swagger/OpenAPI

---

## Quick start

### Prerequisites

- **Node.js ≥ 22.12** (`.nvmrc` provided)
- **PostgreSQL ≥ 14 with the PostGIS extension available**. The first migration runs `CREATE EXTENSION postgis`, so only the package needs to be installed:
  - Ubuntu/Debian: `sudo apt install postgresql-16-postgis-3` (match your PG major version)
  - macOS (Homebrew): `brew install postgis`
  - Windows: tick PostGIS in the Stack Builder of the EDB installer

### Setup

```bash
npm install
cp .env.example .env            # then set DATABASE_URL to your local database
createdb expert-listing         # or create it in any client

npm run migration:run           # builds, then applies migrations
npm run seed                    # optional: 12 sample listings in Lagos & Abuja
npm run start:dev
```

- API: `http://localhost:3000/api/v1/listings`
- Swagger UI: `http://localhost:3000/docs` (raw spec at `/docs-json`)
- Health: `http://localhost:3000/health`

### Tests

```bash
npm test            # unit tests (no database needed)
npm run test:e2e    # integration tests against a real PostGIS database
```

The e2e suite uses a **separate database**: your `DATABASE_URL` with `-test` appended to the name (e.g. `expert-listing-test`), or `TEST_DATABASE_URL` if set. It creates that database if it's missing and runs the real migrations against it before the tests. The tests `TRUNCATE` tables, so the config refuses to run unless the database name contains `test`.

### Scripts

| Script | What it does |
| --- | --- |
| `start:dev` / `start:prod` | Watch mode / run migrations, then `node dist/main.js` |
| `migration:run` / `:revert` / `:show` | Build, then run the TypeORM CLI against `dist/` |
| `migration:generate -- src/database/migration/<Name>` | Diff entities against the DB and write a migration |
| `migration:create -- src/database/migration/<Name>` | Empty migration |
| `seed` | Insert sample listings (skips if the table isn't empty) |
| `lint` / `typecheck` / `format` | oxlint / `tsc --noEmit` (incl. tests) / prettier |

---

## API

All routes are versioned under `/api/v1`. Every success is wrapped in `ResponseObject.Ok` (`{ status, success: true, message, data, meta? }`) and every error in `ResponseObject.Error` (see [Error handling](#error-handling)).

| Method | Path | Description |
| --- | --- | --- |
| `POST` | `/listings` | Create a listing → `201` |
| `GET` | `/listings?page=&limit=` | List, newest first |
| `GET` | `/listings/search?…` | Filtered and/or geo search (below) |
| `GET` | `/listings/:id` | Fetch one → `404` if missing/deleted |
| `PATCH` | `/listings/:id` | Partial update |
| `DELETE` | `/listings/:id` | Soft delete → `200` with `data: null` |

### Create

```bash
curl -X POST localhost:3000/api/v1/listings -H 'content-type: application/json' -d '{
  "title": "3 bedroom flat with BQ",
  "price": 4500000,
  "type": "rent",
  "bedrooms": 3,
  "location": { "lat": 6.4474, "lng": 3.4700, "address": "Lekki Phase 1, Lagos" },
  "agentId": "6f1c1d9e-2b8a-4d7e-9a57-0e3f2c1b4a10"
}'
```

`type` is one of `rent | sale | shortlet`. `price` ≥ 0 with at most 2 decimals. `bedrooms` is an integer 0–50. `lat`/`lng` are range-checked. `agentId` is a UUID.

### Search

```
GET /api/v1/listings/search?type=rent&minPrice=1000000&maxPrice=8000000&minBedrooms=2&lat=6.4281&lng=3.4219&radiusKm=5
```

| Param | Notes |
| --- | --- |
| `type` | `rent`, `sale`, `shortlet` |
| `minPrice`, `maxPrice` | Inclusive; `maxPrice ≥ minPrice` is validated |
| `bedrooms` | Exact match |
| `minBedrooms`, `maxBedrooms` | Inclusive range |
| `agentId` | A given agent's listings |
| `lat`, `lng`, `radiusKm` | **All three or none.** `radiusKm` must be > 0 and ≤ 100 |
| `sortBy` | `createdAt` · `price` · `distance` (geo only). Default: `distance` for geo searches, `createdAt` otherwise |
| `order` | `asc` · `desc`. Default: `desc` for `createdAt`, `asc` otherwise |
| `page`, `limit` | Defaults `1` / `20`, `limit` ≤ 100 |

Geo results include `distanceKm`. Response shape (list and search):

```json
{
  "status": 200,
  "success": true,
  "message": "Listings fetched successfully",
  "data": [
    {
      "id": "…", "title": "3 bedroom flat with BQ", "price": 4500000, "type": "rent", "bedrooms": 3,
      "location": { "lat": 6.4474, "lng": 3.47, "address": "Lekki Phase 1, Lagos" },
      "agentId": "…", "createdAt": "…", "updatedAt": "…",
      "distanceKm": 5.733
    }
  ],
  "meta": { "page": 1, "limit": 20, "total": 1, "totalPages": 1, "hasNextPage": false }
}
```

### Error handling

```json
{
  "status": "failed",
  "success": false,
  "error": "Bad Request",
  "message": "Validation failed",
  "errorCode": 400,
  "errors": [
    { "field": "location.lat", "messages": ["lat must be a latitude string or number"] },
    { "field": "maxPrice", "messages": ["maxPrice must be greater than or equal to minPrice"] }
  ]
}
```

The pattern lives in [`src/common/helpers/response`](src/common/helpers/response):

- **`ErrorResponse(message, code)`** throws an expected business error, e.g. `ErrorResponse('Listing … not found', HttpCodesEnum.HTTP_NOT_FOUND)`.
- **`catchBlockResponse(error, context)`** is called in the `catch` of **every service method**. Errors already produced by `ErrorResponse` pass through unchanged, so a 404 stays a 404. Postgres errors are mapped to client errors. Anything else is logged once, with the stack and the method name, and becomes a generic 500.
- **`AllExceptionsFilter`** is the global safety net for errors that never reach a service (validation pipe, malformed UUIDs, bad JSON, unknown routes). It renders them in the same envelope, using the same conversion function as `catchBlockResponse`.

- `400`: validation failures. Field paths are flattened (`location.lat`) so clients can map them onto form fields. Unknown properties are rejected, not silently dropped, and malformed UUIDs in the path return 400, not 500.
- `404`: missing or soft-deleted listings.
- Postgres constraint errors are translated (unique → `409`, check/invalid input → `400`).
- Anything unexpected is logged with its stack and returned as a generic `500`. Internal messages never reach the client. Expected 4xx errors aren't logged as errors, which keeps alerting clean.

---

## Design choices

**PostGIS `geography(Point, 4326)` for location.** Radius search uses `ST_DWithin` against a GiST index, and `ST_Distance` is only computed for rows that pass that filter. `geography` rather than `geometry` means distances are in metres on the spheroid, with no projection or hand-written haversine. On 50k synthetic Lagos listings, a 3 km radius query uses the GiST index (237 candidates → 72 rows) and runs in about 13 ms. I also considered a haversine formula with a lat/lng bounding-box prefilter. It avoids the extension, but it's more code, less accurate, and doesn't get you polygons, nearest-neighbour, or clustering later.

**Migrations own the schema.** `synchronize` is off everywhere. Migrations are hand-written SQL in `src/database/migration/<epoch-ms>-<Name>.ts`: PostGIS enablement is split from table creation, and each has a docblock explaining why. Indexes and checks are mirrored on the entity, and `migration:generate --check` reports no drift, so future generated migrations won't try to drop them. Migrations run as an explicit step (`migration:run`, or as part of `start:prod`), never implicitly on app boot. That keeps them out of the race when several instances start at once.

**Indexes match the query patterns.** They are GiST on `location`, `(type, price)` (rent and sale are different markets, so type is almost always filtered first), `bedrooms`, `(created_at DESC, id)` for the default sort, and `agent_id`. All search indexes are **partial on `deleted_at IS NULL`**, so soft-deleted rows cost nothing on the hot path.

**Money is `NUMERIC(14,2)`, not float**, mapped to a JS number at the edge. CHECK constraints (`price >= 0`, `bedrooms >= 0`) back up the DTO validation at the database level.

**Soft delete.** In a marketplace, deleted listings are usually still needed for audit, disputes, and analytics. TypeORM excludes them from every query automatically.

**Layering.** Controller (HTTP + validation) → service (business rules, cache) → repository (all SQL/PostGIS). The service has no SQL in it, so it's unit-tested with plain mocks, and the SQL is covered by e2e tests against a real PostGIS instance. Mocking the geo query would test nothing useful.

**Validation.** DTOs are class-validator classes that also drive the Swagger docs. The global `ValidationPipe` whitelists input and rejects extras. Cross-field rules (`lat`/`lng`/`radiusKm` all-or-none, `min ≤ max`, `sortBy=distance` needs a point) are small reusable decorators in `common/validation`. `agentId` is deliberately not updatable through `PATCH`: reassigning ownership is a privileged operation.

**Pagination.** Offset-based with total counts, which fits the UI need of "page N of M". A stable sort with an `id` tie-breaker keeps pages deterministic when sort keys collide.

**Caching with O(1) invalidation.** Reads (`GET /:id`, list, search) are cached for `CACHE_TTL_SECONDS` under keys that embed a "listings version" counter. Every write bumps the counter, which instantly orphans all cached reads, so a search can never return stale data after a write, and there's no need to track which searches a listing appeared in. The trade-off is a lower hit rate on write-heavy traffic. The backing store is Redis when `REDIS_URL` is set and in-process memory otherwise. The cache fails open: if Redis is down, requests go to Postgres and a warning is logged.

**Operational basics.** Env validation at boot (fail fast on bad config), `/health` readiness probe with a DB ping, helmet, CORS, graceful shutdown hooks, and URI versioning (`/api/v1`). CI (GitHub Actions) runs lint, typecheck, build, unit tests, e2e tests, and a migration down/up round-trip against PostgreSQL + PostGIS on the runner.

---

## What I'd improve with more time

- **Auth and ownership.** JWT auth, with `agentId` taken from the token instead of the body, and only the owning agent (or an admin) allowed to update or delete.
- **Keyset (cursor) pagination** for deep pages and infinite scroll. `OFFSET` and `COUNT(*)` get expensive on large result sets. I might also return an approximate count for broad searches.
- **Richer domain model.** Currency, a price period (shortlet per night vs rent per year, since comparing those prices directly is misleading), status (draft/active/let/sold), images, amenities, and a real `agents` table with a foreign key.
- **Search engine for text and facets.** Full-text search on title/description with facet counts. Postgres `tsvector` would do at first. At marketplace scale I'd move to Meilisearch or Elasticsearch fed by an outbox/CDC, keeping Postgres as the source of truth.
- **More geo features.** Search within a polygon (draw on a map), bounding-box queries for map viewports, and clustering of results.
- **Finer-grained caching.** Per-listing invalidation for `GET /:id`, HTTP caching headers (`ETag`/`Cache-Control`), and cache-stampede protection.
- **Production hardening.** Rate limiting, request IDs and structured JSON logs, OpenTelemetry tracing and metrics, and idempotency keys on `POST`.
- **Tests.** Property-based tests for the validators and a load test for the search endpoint.
