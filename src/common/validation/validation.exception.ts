import { BadRequestException, type ValidationError } from '@nestjs/common';
import { HttpCodesEnum } from '../enums/http-codes.enum.js';
import { type FieldError, ResponseObject } from '../helpers/response/index.js';

/**
 * Flattens class-validator's nested error tree into `{ field, messages }`
 * pairs with dotted paths (e.g. `location.lat`). Clients can map these
 * straight onto form fields.
 */
export function flattenValidationErrors(
  errors: ValidationError[],
  parentPath = '',
): FieldError[] {
  return errors.flatMap((error) => {
    const field = parentPath
      ? `${parentPath}.${error.property}`
      : error.property;
    const own = error.constraints
      ? [{ field, messages: Object.values(error.constraints) }]
      : [];
    return [...own, ...flattenValidationErrors(error.children ?? [], field)];
  });
}

/** Used by the global ValidationPipe so validation errors share the standard error envelope. */
export const validationExceptionFactory = (errors: ValidationError[]) =>
  new BadRequestException(
    ResponseObject.Error(
      'Bad Request',
      'Validation failed',
      HttpCodesEnum.HTTP_BAD_REQUEST,
      flattenValidationErrors(errors),
    ),
  );
