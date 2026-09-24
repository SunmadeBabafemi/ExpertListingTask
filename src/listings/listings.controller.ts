import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiCreatedResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';
import { PaginationQueryDto } from '../common/dto/pagination.dto.js';
import { HttpCodesEnum } from '../common/enums/http-codes.enum.js';
import { ErrorResponseDto } from '../common/filters/error-response.dto.js';
import { ResponseObject } from '../common/helpers/response/index.js';
import { CreateListingDto } from './dto/create-listing.dto.js';
import {
  EmptyEnvelopeDto,
  ListingEnvelopeDto,
  PaginatedListingsEnvelopeDto,
} from './dto/listing-response.dto.js';
import { SearchListingsQueryDto } from './dto/search-listings.dto.js';
import { UpdateListingDto } from './dto/update-listing.dto.js';
import { ListingsService } from './listings.service.js';

const UuidParam = new ParseUUIDPipe({ version: '4' });

@ApiTags('listings')
@ApiBadRequestResponse({
  type: ErrorResponseDto,
  description: 'Validation failed',
})
@Controller('listings')
export class ListingsController {
  constructor(private readonly listings: ListingsService) {}

  @Post()
  @ApiOperation({ summary: 'Create a listing' })
  @ApiCreatedResponse({ type: ListingEnvelopeDto })
  async create(@Body() dto: CreateListingDto) {
    const listing = await this.listings.create(dto);
    return ResponseObject.Ok(
      listing,
      'Listing created successfully',
      HttpCodesEnum.HTTP_CREATED,
    );
  }

  @Get()
  @ApiOperation({ summary: 'List listings (newest first)' })
  @ApiOkResponse({ type: PaginatedListingsEnvelopeDto })
  async findAll(@Query() { page, limit }: PaginationQueryDto) {
    const { data, meta } = await this.listings.search({ page, limit });
    return ResponseObject.Ok(
      data,
      'Listings fetched successfully',
      HttpCodesEnum.HTTP_OK,
      meta,
    );
  }

  // Declared before `:id` so "search" is never captured as an id.
  @Get('search')
  @ApiOperation({
    summary: 'Search listings',
    description:
      'Filter by type, price range and bedrooms. Pass `lat`, `lng` and `radiusKm` together ' +
      'to restrict results to that radius; results then include `distanceKm` and are sorted ' +
      'nearest-first by default.',
  })
  @ApiOkResponse({ type: PaginatedListingsEnvelopeDto })
  async search(@Query() query: SearchListingsQueryDto) {
    const { data, meta } = await this.listings.search(query);
    return ResponseObject.Ok(
      data,
      'Listings fetched successfully',
      HttpCodesEnum.HTTP_OK,
      meta,
    );
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get a listing by id' })
  @ApiOkResponse({ type: ListingEnvelopeDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async findOne(@Param('id', UuidParam) id: string) {
    const listing = await this.listings.findOne(id);
    return ResponseObject.Ok(
      listing,
      'Listing fetched successfully',
      HttpCodesEnum.HTTP_OK,
    );
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Partially update a listing' })
  @ApiOkResponse({ type: ListingEnvelopeDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async update(
    @Param('id', UuidParam) id: string,
    @Body() dto: UpdateListingDto,
  ) {
    const listing = await this.listings.update(id, dto);
    return ResponseObject.Ok(
      listing,
      'Listing updated successfully',
      HttpCodesEnum.HTTP_OK,
    );
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete a listing (soft delete)' })
  @ApiOkResponse({ type: EmptyEnvelopeDto })
  @ApiNotFoundResponse({ type: ErrorResponseDto })
  async remove(@Param('id', UuidParam) id: string) {
    await this.listings.remove(id);
    return ResponseObject.Ok(
      null,
      'Listing deleted successfully',
      HttpCodesEnum.HTTP_OK,
    );
  }
}
