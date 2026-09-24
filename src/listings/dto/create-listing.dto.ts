import { ApiProperty } from '@nestjs/swagger';
import { Transform, Type } from 'class-transformer';
import {
  IsDefined,
  IsEnum,
  IsInt,
  IsNumber,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { ListingType } from '../listing-type.enum.js';
import { LocationDto } from './location.dto.js';

/** Upper bound of NUMERIC(14,2). */
export const MAX_PRICE = 999_999_999_999.99;
export const MAX_BEDROOMS = 50;

export class CreateListingDto {
  @ApiProperty({
    example: '3 bedroom flat with BQ',
    minLength: 3,
    maxLength: 200,
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(3, 200)
  title: string;

  @ApiProperty({ example: 4500000, minimum: 0, maximum: MAX_PRICE })
  @IsNumber({ maxDecimalPlaces: 2, allowNaN: false, allowInfinity: false })
  @Min(0)
  @Max(MAX_PRICE)
  price: number;

  @ApiProperty({ enum: ListingType, example: ListingType.Rent })
  @IsEnum(ListingType)
  type: ListingType;

  @ApiProperty({ example: 3, minimum: 0, maximum: MAX_BEDROOMS })
  @IsInt()
  @Min(0)
  @Max(MAX_BEDROOMS)
  bedrooms: number;

  @ApiProperty({ type: LocationDto })
  @IsDefined()
  @ValidateNested()
  @Type(() => LocationDto)
  location: LocationDto;

  @ApiProperty({
    format: 'uuid',
    example: '6f1c1d9e-2b8a-4d7e-9a57-0e3f2c1b4a10',
  })
  @IsUUID()
  agentId: string;
}
