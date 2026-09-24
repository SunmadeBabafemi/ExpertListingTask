import { Global, Logger, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import {
  CacheStore,
  InMemoryCacheStore,
  RedisCacheStore,
} from './cache.store.js';

@Global()
@Module({
  providers: [
    {
      provide: CacheStore,
      inject: [ConfigService],
      useFactory: (config: ConfigService): CacheStore => {
        const url = config.get<string>('REDIS_URL');
        if (url) return new RedisCacheStore(url);
        new Logger('CacheModule').warn(
          'REDIS_URL not set, using in-memory cache (not shared across instances)',
        );
        return new InMemoryCacheStore();
      },
    },
  ],
  exports: [CacheStore],
})
export class CacheModule {}
