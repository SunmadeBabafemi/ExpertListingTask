import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { CacheModule } from './common/cache/cache.module.js';
import {
  type EnvironmentVariables,
  validateEnv,
} from './config/env.validation.js';
import { baseDatabaseOptions, ENV_FILE } from './database/database.config.js';
import { HealthModule } from './health/health.module.js';
import { ListingsModule } from './listings/listings.module.js';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      envFilePath: ENV_FILE,
      validate: validateEnv,
    }),
    TypeOrmModule.forRootAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService<EnvironmentVariables, true>) => ({
        ...baseDatabaseOptions({
          DATABASE_URL: config.get('DATABASE_URL'),
          DB_SSL: config.get('DB_SSL'),
          DB_LOGGING: config.get('DB_LOGGING'),
        }),
        // Entities registered via TypeOrmModule.forFeature(). Migrations are
        // run as a separate step (`npm run migration:run`), not on boot.
        autoLoadEntities: true,
      }),
    }),
    CacheModule,
    HealthModule,
    ListingsModule,
  ],
})
export class AppModule {}
