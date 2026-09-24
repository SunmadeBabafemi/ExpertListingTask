import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Listing } from './entities/listing.entity.js';
import { ListingsCache } from './listings.cache.js';
import { ListingsController } from './listings.controller.js';
import { ListingsRepository } from './listings.repository.js';
import { ListingsService } from './listings.service.js';

@Module({
  imports: [TypeOrmModule.forFeature([Listing])],
  controllers: [ListingsController],
  providers: [ListingsService, ListingsRepository, ListingsCache],
})
export class ListingsModule {}
