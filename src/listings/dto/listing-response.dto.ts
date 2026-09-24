import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { PaginationMetaDto } from '../../common/dto/pagination.dto.js';
import type { Listing } from '../entities/listing.entity.js';
import { ListingType } from '../listing-type.enum.js';

export class LocationResponseDto {
  @ApiProperty() lat: number;
  @ApiProperty() lng: number;
  @ApiProperty({ nullable: true, type: String }) address: string | null;
}

export class ListingResponseDto {
  @ApiProperty({ format: 'uuid' }) id: string;
  @ApiProperty() title: string;
  @ApiProperty() price: number;
  @ApiProperty({ enum: ListingType }) type: ListingType;
  @ApiProperty() bedrooms: number;
  @ApiProperty({ type: LocationResponseDto }) location: LocationResponseDto;
  @ApiProperty({ format: 'uuid' }) agentId: string;
  @ApiProperty() createdAt: string;
  @ApiProperty() updatedAt: string;

  @ApiPropertyOptional({
    description:
      'Only present on geo searches. Distance from the search centre in km.',
  })
  distanceKm?: number;

  static fromEntity(
    entity: Listing,
    distanceMeters?: number,
  ): ListingResponseDto {
    const [lng, lat] = entity.location.coordinates;
    const dto: ListingResponseDto = {
      id: entity.id,
      title: entity.title,
      price: entity.price,
      type: entity.type,
      bedrooms: entity.bedrooms,
      location: { lat, lng, address: entity.address },
      agentId: entity.agentId,
      createdAt: entity.createdAt.toISOString(),
      updatedAt: entity.updatedAt.toISOString(),
    };
    if (distanceMeters !== undefined) {
      dto.distanceKm = Math.round(distanceMeters) / 1000;
    }
    return dto;
  }
}

/** Swagger models of the `ResponseObject.Ok(...)` envelopes returned by the controller. */
class OkEnvelopeDto {
  @ApiProperty({ example: 200 }) status: number;
  @ApiProperty({ example: true }) success: true;
  @ApiProperty({ example: 'Listing fetched successfully' }) message: string;
}

export class ListingEnvelopeDto extends OkEnvelopeDto {
  @ApiProperty({ type: ListingResponseDto }) data: ListingResponseDto;
}

export class PaginatedListingsEnvelopeDto extends OkEnvelopeDto {
  @ApiProperty({ type: [ListingResponseDto] }) data: ListingResponseDto[];
  @ApiProperty({ type: PaginationMetaDto }) meta: PaginationMetaDto;
}

export class EmptyEnvelopeDto extends OkEnvelopeDto {
  @ApiProperty({ nullable: true, example: null }) data: null;
}
