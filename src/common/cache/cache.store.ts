import { Logger, type OnModuleDestroy } from '@nestjs/common';
import { Redis } from 'ioredis';

/**
 * Minimal cache abstraction: only what the app needs, so swapping the backing
 * store (or faking it in tests) is trivial.
 */
export abstract class CacheStore {
  abstract get<T>(key: string): Promise<T | undefined>;
  abstract set(key: string, value: unknown, ttlSeconds: number): Promise<void>;
  /** Atomically increments an integer counter and returns the new value. */
  abstract incr(key: string): Promise<number>;
}

export class InMemoryCacheStore extends CacheStore {
  private readonly entries = new Map<
    string,
    { value: unknown; expiresAt: number }
  >();

  async get<T>(key: string): Promise<T | undefined> {
    const entry = this.entries.get(key);
    if (!entry) return undefined;
    if (entry.expiresAt <= Date.now()) {
      this.entries.delete(key);
      return undefined;
    }
    return structuredClone(entry.value) as T;
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    this.entries.set(key, {
      value: structuredClone(value),
      expiresAt: Date.now() + ttlSeconds * 1000,
    });
  }

  async incr(key: string): Promise<number> {
    const current = (await this.get<number>(key)) ?? 0;
    const next = current + 1;
    this.entries.set(key, { value: next, expiresAt: Number.POSITIVE_INFINITY });
    return next;
  }
}

export class RedisCacheStore extends CacheStore implements OnModuleDestroy {
  private readonly logger = new Logger(RedisCacheStore.name);
  private readonly client: Redis;

  constructor(url: string) {
    super();
    this.client = new Redis(url, {
      // Fail fast rather than queueing commands while Redis is down; callers
      // treat cache errors as misses.
      maxRetriesPerRequest: 1,
      enableOfflineQueue: false,
      lazyConnect: false,
    });
    this.client.on('error', (err) =>
      this.logger.warn(`Redis error: ${err.message}`),
    );
  }

  async get<T>(key: string): Promise<T | undefined> {
    const raw = await this.client.get(key);
    return raw === null ? undefined : (JSON.parse(raw) as T);
  }

  async set(key: string, value: unknown, ttlSeconds: number): Promise<void> {
    await this.client.set(key, JSON.stringify(value), 'EX', ttlSeconds);
  }

  incr(key: string): Promise<number> {
    return this.client.incr(key);
  }

  async onModuleDestroy() {
    await this.client.quit().catch(() => undefined);
  }
}
