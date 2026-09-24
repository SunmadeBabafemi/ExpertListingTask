import { OmitType, PartialType } from '@nestjs/swagger';
import { CreateListingDto } from './create-listing.dto.js';

/**
 * Ownership (`agentId`) is not editable through a regular update. Reassigning
 * a listing to another agent is a separate, privileged operation.
 * If `location` is sent, it must be complete (lat + lng).
 */
export class UpdateListingDto extends PartialType(
  OmitType(CreateListingDto, ['agentId'] as const),
) {}
