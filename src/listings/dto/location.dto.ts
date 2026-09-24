import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsLatitude,
  IsLongitude,
  IsOptional,
  IsString,
  MaxLength,
} from 'class-validator';

export class LocationDto {
  @ApiProperty({ example: 6.4281, minimum: -90, maximum: 90 })
  @IsLatitude()
  lat: number;

  @ApiProperty({ example: 3.4219, minimum: -180, maximum: 180 })
  @IsLongitude()
  lng: number;

  @ApiPropertyOptional({ example: 'Admiralty Way, Lekki Phase 1, Lagos' })
  @IsOptional()
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @MaxLength(300)
  address?: string;
}
