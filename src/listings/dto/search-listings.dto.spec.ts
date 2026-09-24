import { plainToInstance } from 'class-transformer';
import { validateSync } from 'class-validator';
import { flattenValidationErrors } from '../../common/validation/validation.exception.js';
import { SearchListingsQueryDto } from './search-listings.dto.js';

/** Mirrors the global ValidationPipe: query strings in, transformed DTO + field errors out. */
function parse(query: Record<string, string>) {
  const dto = plainToInstance(SearchListingsQueryDto, query);
  const errors = flattenValidationErrors(
    validateSync(dto, { whitelist: true, forbidNonWhitelisted: true }),
  );
  return { dto, errors, fields: errors.map((e) => e.field) };
}

describe('SearchListingsQueryDto', () => {
  it('applies pagination defaults and converts numeric query strings', () => {
    const { dto, errors } = parse({ minPrice: '1000', bedrooms: '2' });
    expect(errors).toEqual([]);
    expect(dto).toMatchObject({
      page: 1,
      limit: 20,
      minPrice: 1000,
      bedrooms: 2,
    });
  });

  it('accepts a complete geo query', () => {
    const { dto, errors } = parse({
      lat: '6.4281',
      lng: '3.4219',
      radiusKm: '5',
    });
    expect(errors).toEqual([]);
    expect(dto).toMatchObject({ lat: 6.4281, lng: 3.4219, radiusKm: 5 });
  });

  it.each([
    [{ lat: '6.4' }, ['lat']],
    [{ lat: '6.4', lng: '3.4' }, ['lat', 'lng']],
    [{ radiusKm: '5' }, ['radiusKm']],
  ])('requires lat, lng and radiusKm together (%o)', (query, expected) => {
    expect(parse(query).fields).toEqual(expect.arrayContaining(expected));
  });

  it.each([
    [{ lat: '91', lng: '0', radiusKm: '1' }, 'lat'],
    [{ lat: '0', lng: '181', radiusKm: '1' }, 'lng'],
    [{ lat: '0', lng: '0', radiusKm: '0' }, 'radiusKm'],
    [{ lat: '0', lng: '0', radiusKm: '101' }, 'radiusKm'],
    [{ type: 'lease' }, 'type'],
    [{ minPrice: '-1' }, 'minPrice'],
    [{ minPrice: 'abc' }, 'minPrice'],
    [{ bedrooms: '2.5' }, 'bedrooms'],
    [{ limit: '101' }, 'limit'],
    [{ page: '0' }, 'page'],
    [{ agentId: 'not-a-uuid' }, 'agentId'],
    [{ sortBy: 'title' }, 'sortBy'],
  ])('rejects out-of-range or malformed input %o', (query, field) => {
    expect(parse(query).fields).toContain(field);
  });

  it('rejects inverted ranges', () => {
    expect(parse({ minPrice: '500', maxPrice: '100' }).fields).toContain(
      'maxPrice',
    );
    expect(parse({ minBedrooms: '4', maxBedrooms: '2' }).fields).toContain(
      'maxBedrooms',
    );
  });

  it('allows equal range bounds', () => {
    expect(parse({ minPrice: '100', maxPrice: '100' }).errors).toEqual([]);
  });

  it('only allows sortBy=distance for geo searches', () => {
    expect(parse({ sortBy: 'distance' }).fields).toContain('sortBy');
    expect(parse({ sortBy: 'price' }).errors).toEqual([]);
    expect(
      parse({ sortBy: 'distance', lat: '6.4', lng: '3.4', radiusKm: '5' })
        .errors,
    ).toEqual([]);
  });

  it('rejects unknown query parameters', () => {
    expect(parse({ foo: 'bar' }).fields).toContain('foo');
  });
});
