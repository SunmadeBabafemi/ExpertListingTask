import { createHash } from 'node:crypto';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { CacheStore } from '../common/cache/cache.store.js';

const VERSION_KEY = 'listings:version';

/**
 * Read-through cache for listing reads with namespace-version invalidation.
 *
 * Every cache key embeds the current "listings version". Any write bumps the
 * version, which orphans every previously cached read in O(1). Old keys are
 * never read again and simply expire via TTL. This trades hit rate for
 * simplicity and correctness: there is no way to serve a stale search
 * after a write, and no need to track which searches a listing appeared in.
 *
 * Cache failures are logged and treated as misses (fail-open): the cache
 * must never take the API down.
 */
@Injectable()
export class ListingsCache {
  private readonly logger = new Logger(ListingsCache.name);
  private readonly ttlSeconds: number;

  constructor(
    private readonly store: CacheStore,
    config: ConfigService,
  ) {
    this.ttlSeconds = config.get<number>('CACHE_TTL_SECONDS', 60);
  }

  async wrap<T>(
    scope: string,
    params: unknown,
    load: () => Promise<T>,
  ): Promise<T> {
    if (this.ttlSeconds <= 0) return load();

    const key = await this.buildKey(scope, params);
    if (key) {
      const cached = await this.safely(() => this.store.get<T>(key));
      if (cached !== undefined && cached !== null) return cached;
    }

    const value = await load();
    if (key) {
      await this.safely(() => this.store.set(key, value, this.ttlSeconds));
    }
    return value;
  }

  async invalidateAll(): Promise<void> {
    await this.safely(() => this.store.incr(VERSION_KEY));
  }

  private async buildKey(
    scope: string,
    params: unknown,
  ): Promise<string | undefined> {
    const version = await this.safely(() =>
      this.store.get<number>(VERSION_KEY),
    );
    // If we can't read the version we can't guarantee freshness, so skip caching.
    if (version === null) return undefined;
    const hash = createHash('sha1')
      .update(stableStringify(params))
      .digest('hex');
    return `listings:v${version ?? 0}:${scope}:${hash}`;
  }

  /** Returns `null` on failure so callers can tell "error" from "miss". */
  private async safely<T>(fn: () => Promise<T>): Promise<T | null> {
    try {
      return await fn();
    } catch (err) {
      this.logger.warn(`Cache operation failed: ${(err as Error).message}`);
      return null;
    }
  }
}

/** JSON.stringify with sorted keys and undefined dropped, so equivalent queries share a key. */
export function stableStringify(value: unknown): string {
  if (value === null || typeof value !== 'object')
    return JSON.stringify(value) ?? 'null';
  if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
  const entries = Object.entries(value as Record<string, unknown>)
    .filter(([, v]) => v !== undefined)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([k, v]) => `${JSON.stringify(k)}:${stableStringify(v)}`);
  return `{${entries.join(',')}}`;
}
