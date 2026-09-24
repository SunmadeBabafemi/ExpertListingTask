import { ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsLatitude,
  IsLongitude,
  IsNumber,
  IsOptional,
  IsUUID,
  Max,
  Min,
} from 'class-validator';
import { PaginationQueryDto } from '../../common/dto/pagination.dto.js';
import {
  IsGreaterThanOrEqualTo,
  RequiresAlso,
} from '../../common/validation/cross-field.validators.js';
import { ListingType } from '../listing-type.enum.js';
import { MAX_BEDROOMS, MAX_PRICE } from './create-listing.dto.js';

export const MAX_RADIUS_KM = 100;

export const SORT_FIELDS = ['createdAt', 'price', 'distance'] as const;
export type SortField = (typeof SORT_FIELDS)[number];

export class SearchListingsQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ enum: ListingType })
  @IsOptional()
  @IsEnum(ListingType)
  type?: ListingType;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(MAX_PRICE)
  minPrice?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(MAX_PRICE)
  @IsGreaterThanOrEqualTo('minPrice')
  maxPrice?: number;

  @ApiPropertyOptional({ description: 'Exact number of bedrooms', minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_BEDROOMS)
  bedrooms?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_BEDROOMS)
  minBedrooms?: number;

  @ApiPropertyOptional({ minimum: 0 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  @Max(MAX_BEDROOMS)
  @IsGreaterThanOrEqualTo('minBedrooms')
  maxBedrooms?: number;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID()
  agentId?: string;

  @ApiPropertyOptional({
    description: 'Latitude of the search centre. Requires lng and radiusKm.',
    example: 6.4281,
  })
  @IsOptional()
  @Type(() => Number)
  @IsLatitude()
  @RequiresAlso(['lng', 'radiusKm'])
  lat?: number;

  @ApiPropertyOptional({
    description: 'Longitude of the search centre. Requires lat and radiusKm.',
    example: 3.4219,
  })
  @IsOptional()
  @Type(() => Number)
  @IsLongitude()
  @RequiresAlso(['lat', 'radiusKm'])
  lng?: number;

  @ApiPropertyOptional({
    description: 'Search radius in kilometres. Requires lat and lng.',
    minimum: 0,
    exclusiveMinimum: true,
    maximum: MAX_RADIUS_KM,
    example: 5,
  })
  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0.01)
  @Max(MAX_RADIUS_KM)
  @RequiresAlso(['lat', 'lng'])
  radiusKm?: number;

  @ApiPropertyOptional({
    enum: SORT_FIELDS,
    description:
      'Defaults to `distance` for geo searches, otherwise `createdAt`.',
  })
  @IsOptional()
  @IsIn(SORT_FIELDS)
  @RequiresAlso(['lat', 'lng', 'radiusKm'], {
    when: (value) => value === 'distance',
    message: 'sortBy=distance requires lat, lng and radiusKm',
  })
  sortBy?: SortField;

  @ApiPropertyOptional({
    enum: ['asc', 'desc'],
    description:
      'Defaults to `asc` for distance/price and `desc` for createdAt.',
  })
  @IsOptional()
  @IsIn(['asc', 'desc'])
  order?: 'asc' | 'desc';
}
