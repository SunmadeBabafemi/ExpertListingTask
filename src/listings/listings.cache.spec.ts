import type { ConfigService } from '@nestjs/config';
import { InMemoryCacheStore } from '../common/cache/cache.store.js';
import { ListingsCache, stableStringify } from './listings.cache.js';

const config = (ttl = 60) => ({ get: () => ttl }) as unknown as ConfigService;

describe('ListingsCache', () => {
  it('serves repeated reads from cache', async () => {
    const cache = new ListingsCache(new InMemoryCacheStore(), config());
    const load = vi.fn(async () => ({ n: 1 }));

    await cache.wrap('search', { page: 1 }, load);
    const second = await cache.wrap('search', { page: 1 }, load);

    expect(load).toHaveBeenCalledOnce();
    expect(second).toEqual({ n: 1 });
  });

  it('treats equivalent params with different key order as the same entry', async () => {
    const cache = new ListingsCache(new InMemoryCacheStore(), config());
    const load = vi.fn(async () => 'x');

    await cache.wrap('search', { a: 1, b: 2 }, load);
    await cache.wrap('search', { b: 2, a: 1, c: undefined }, load);

    expect(load).toHaveBeenCalledOnce();
  });

  it('invalidateAll makes every previously cached read miss', async () => {
    const cache = new ListingsCache(new InMemoryCacheStore(), config());
    const load = vi.fn(async () => 'x');

    await cache.wrap('search', { page: 1 }, load);
    await cache.wrap('one', { id: 'a' }, load);
    await cache.invalidateAll();
    await cache.wrap('search', { page: 1 }, load);
    await cache.wrap('one', { id: 'a' }, load);

    expect(load).toHaveBeenCalledTimes(4);
  });

  it('bypasses the cache entirely when TTL is 0', async () => {
    const store = new InMemoryCacheStore();
    const getSpy = vi.spyOn(store, 'get');
    const cache = new ListingsCache(store, config(0));

    await cache.wrap('search', {}, async () => 'x');

    expect(getSpy).not.toHaveBeenCalled();
  });

  it('fails open: a broken store falls back to loading from the source', async () => {
    const store = new InMemoryCacheStore();
    vi.spyOn(store, 'get').mockRejectedValue(new Error('redis down'));
    vi.spyOn(store, 'set').mockRejectedValue(new Error('redis down'));
    vi.spyOn(store, 'incr').mockRejectedValue(new Error('redis down'));
    const cache = new ListingsCache(store, config());

    await expect(cache.wrap('search', {}, async () => 'fresh')).resolves.toBe(
      'fresh',
    );
    await expect(cache.invalidateAll()).resolves.toBeUndefined();
  });

  it('does not propagate errors thrown by the loader into the cache', async () => {
    const cache = new ListingsCache(new InMemoryCacheStore(), config());
    await expect(
      cache.wrap('one', { id: 'x' }, async () => {
        throw new Error('not found');
      }),
    ).rejects.toThrow('not found');
    await expect(
      cache.wrap('one', { id: 'x' }, async () => 'found'),
    ).resolves.toBe('found');
  });
});

describe('stableStringify', () => {
  it('sorts keys recursively and drops undefined', () => {
    expect(stableStringify({ b: 1, a: { d: undefined, c: [2, 1] } })).toBe(
      '{"a":{"c":[2,1]},"b":1}',
    );
  });
});
