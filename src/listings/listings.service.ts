import { Injectable } from '@nestjs/common';
import type { Point } from 'typeorm';
import {
  type Paginated,
  PaginationMetaDto,
} from '../common/dto/pagination.dto.js';
import { HttpCodesEnum } from '../common/enums/http-codes.enum.js';
import {
  catchBlockResponse,
  ErrorResponse,
} from '../common/helpers/response/index.js';
import type { CreateListingDto } from './dto/create-listing.dto.js';
import { ListingResponseDto } from './dto/listing-response.dto.js';
import type { LocationDto } from './dto/location.dto.js';
import type { SearchListingsQueryDto } from './dto/search-listings.dto.js';
import type { UpdateListingDto } from './dto/update-listing.dto.js';
import { ListingsCache } from './listings.cache.js';
import { ListingsRepository } from './listings.repository.js';

const toPoint = ({ lat, lng }: LocationDto): Point => ({
  type: 'Point',
  coordinates: [lng, lat],
});

@Injectable()
export class ListingsService {
  constructor(
    private readonly listings: ListingsRepository,
    private readonly cache: ListingsCache,
  ) {}

  async create(dto: CreateListingDto): Promise<ListingResponseDto> {
    try {
      const entity = this.listings.create({
        title: dto.title,
        price: dto.price,
        type: dto.type,
        bedrooms: dto.bedrooms,
        location: toPoint(dto.location),
        address: dto.location.address ?? null,
        agentId: dto.agentId,
      });
      const saved = await this.listings.save(entity);
      await this.cache.invalidateAll();
      return ListingResponseDto.fromEntity(saved);
    } catch (error) {
      catchBlockResponse(error, 'ListingsService.create');
    }
  }

  async findOne(id: string): Promise<ListingResponseDto> {
    try {
      return await this.cache.wrap('one', { id }, async () => {
        const listing = await this.listings.findById(id);
        if (!listing) this.notFound(id);
        return ListingResponseDto.fromEntity(listing);
      });
    } catch (error) {
      catchBlockResponse(error, 'ListingsService.findOne');
    }
  }

  async search(
    query: SearchListingsQueryDto,
  ): Promise<Paginated<ListingResponseDto>> {
    try {
      return await this.cache.wrap('search', query, async () => {
        const { hits, total } = await this.listings.search(query);
        return {
          data: hits.map((h) =>
            ListingResponseDto.fromEntity(h.listing, h.distanceMeters),
          ),
          meta: PaginationMetaDto.of(query.page, query.limit, total),
        };
      });
    } catch (error) {
      catchBlockResponse(error, 'ListingsService.search');
    }
  }

  async update(id: string, dto: UpdateListingDto): Promise<ListingResponseDto> {
    try {
      const listing = await this.listings.findById(id);
      if (!listing) this.notFound(id);

      const { location, ...fields } = dto;
      Object.assign(listing, fields);
      if (location) {
        listing.location = toPoint(location);
        listing.address = location.address ?? null;
      }

      const saved = await this.listings.save(listing);
      await this.cache.invalidateAll();
      return ListingResponseDto.fromEntity(saved);
    } catch (error) {
      catchBlockResponse(error, 'ListingsService.update');
    }
  }

  async remove(id: string): Promise<void> {
    try {
      const deleted = await this.listings.softDelete(id);
      if (!deleted) this.notFound(id);
      await this.cache.invalidateAll();
    } catch (error) {
      catchBlockResponse(error, 'ListingsService.remove');
    }
  }

  private notFound(id: string): never {
    return ErrorResponse(
      `Listing ${id} not found`,
      HttpCodesEnum.HTTP_NOT_FOUND,
    );
  }
}
