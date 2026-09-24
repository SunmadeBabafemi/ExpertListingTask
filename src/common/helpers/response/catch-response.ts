import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  HttpStatus,
  InternalServerErrorException,
  Logger,
  NotFoundException,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { HttpCodesEnum } from '../../enums/http-codes.enum.js';
import { type ErrorResponseBody, ResponseObject } from './response.js';

const logger = new Logger('ErrorHandler');

const GENERIC_SERVER_MESSAGE = 'Unable to perform request at the moment';

/** Typed Nest exceptions per status, so callers/tests can `instanceof NotFoundException`. */
const EXCEPTION_BY_CODE: Partial<
  Record<number, new (body: ErrorResponseBody) => HttpException>
> = {
  [HttpCodesEnum.HTTP_BAD_REQUEST]: BadRequestException,
  [HttpCodesEnum.HTTP_UNAUTHORIZED]: UnauthorizedException,
  [HttpCodesEnum.HTTP_FORBIDDEN]: ForbiddenException,
  [HttpCodesEnum.HTTP_NOT_FOUND]: NotFoundException,
  [HttpCodesEnum.HTTP_CONFLICT]: ConflictException,
  [HttpCodesEnum.HTTP_UNPROCESSABLE_ENTITY]: UnprocessableEntityException,
};

/**
 * Postgres error codes (strings, e.g. "23505") that are the client's fault.
 * Without this mapping they'd surface as 500s.
 */
const PG_ERROR_CODES: Record<string, { code: HttpCodesEnum; message: string }> =
  {
    '23505': {
      code: HttpCodesEnum.HTTP_CONFLICT,
      message: 'Request conflicts with existing data',
    },
    '23503': {
      code: HttpCodesEnum.HTTP_CONFLICT,
      message: 'Referenced record does not exist',
    },
    '23514': {
      code: HttpCodesEnum.HTTP_BAD_REQUEST,
      message: 'Request contains invalid data',
    },
    '22P02': {
      code: HttpCodesEnum.HTTP_BAD_REQUEST,
      message: 'Request contains invalid data',
    },
    '22003': {
      code: HttpCodesEnum.HTTP_BAD_REQUEST,
      message: 'Numeric value out of range',
    },
  };

export function httpErrorName(code: number): string {
  const name = HttpStatus[code];
  if (!name) return 'Error';
  return name
    .toLowerCase()
    .split('_')
    .map((w) => w[0].toUpperCase() + w.slice(1))
    .join(' ');
}

function buildException(body: ErrorResponseBody): HttpException {
  const Exception = EXCEPTION_BY_CODE[body.errorCode];
  return Exception
    ? new Exception(body)
    : new HttpException(body, body.errorCode);
}

/**
 * Throws a formatted HTTP error for an expected (business) failure, e.g.
 * `ErrorResponse('Listing not found', HttpCodesEnum.HTTP_NOT_FOUND)`.
 * 5xx codes always get a generic message so internals never leak.
 */
export function ErrorResponse(
  message: string,
  code: number = HttpCodesEnum.HTTP_SERVER_ERROR,
): never {
  if (code >= 500) {
    throw new InternalServerErrorException(
      ResponseObject.Error(
        httpErrorName(HttpCodesEnum.HTTP_SERVER_ERROR),
        GENERIC_SERVER_MESSAGE,
        HttpCodesEnum.HTTP_SERVER_ERROR,
      ),
    );
  }
  throw buildException(
    ResponseObject.Error(httpErrorName(code), message, code),
  );
}

/**
 * Converts anything thrown into a formatted `HttpException`, without throwing.
 * Shared by `catchBlockResponse` (services) and the global exception filter
 * (errors raised outside services: pipes, guards, body parsing).
 */
export function toHttpException(error: unknown): {
  exception: HttpException;
  /** Whether this error is new to us and should be logged. */
  shouldLog: boolean;
} {
  // Already formatted, e.g. thrown by ErrorResponse() or an inner
  // catchBlockResponse(): pass through untouched and don't log it twice.
  if (
    error instanceof HttpException &&
    ResponseObject.isError(error.getResponse())
  ) {
    return { exception: error, shouldLog: false };
  }

  if (error instanceof HttpException) {
    const code = error.getStatus();
    const res = error.getResponse();
    const raw =
      typeof res === 'string'
        ? res
        : ((res as { message?: string | string[] }).message ?? error.message);
    const message =
      code >= 500
        ? GENERIC_SERVER_MESSAGE
        : Array.isArray(raw)
          ? raw.join('; ')
          : raw;
    return {
      exception: buildException(
        ResponseObject.Error(httpErrorName(code), message, code),
      ),
      shouldLog: code >= 500,
    };
  }

  if (error instanceof QueryFailedError) {
    const pgCode = (error.driverError as { code?: string } | undefined)?.code;
    const mapped = pgCode ? PG_ERROR_CODES[pgCode] : undefined;
    if (mapped) {
      return {
        exception: buildException(
          ResponseObject.Error(
            httpErrorName(mapped.code),
            mapped.message,
            mapped.code,
          ),
        ),
        shouldLog: true,
      };
    }
  }

  return {
    exception: new InternalServerErrorException(
      ResponseObject.Error(
        httpErrorName(HttpCodesEnum.HTTP_SERVER_ERROR),
        GENERIC_SERVER_MESSAGE,
        HttpCodesEnum.HTTP_SERVER_ERROR,
      ),
    ),
    shouldLog: true,
  };
}

export function logError(
  error: unknown,
  status: number,
  context?: string,
): void {
  const where = context ? `[${context}] ` : '';
  const stack = error instanceof Error ? error.stack : String(error);
  if (status >= 500) {
    logger.error(
      `${where}${status} ${(error as Error)?.message ?? error}`,
      stack,
    );
  } else {
    // Client errors caused by data (e.g. constraint violations): useful to see,
    // not worth paging anyone over.
    logger.warn(`${where}${status} ${(error as Error)?.message ?? error}`);
  }
}

/**
 * Use in every service method's catch block:
 *
 *   try { ... } catch (error) { catchBlockResponse(error, 'ListingsService.create'); }
 *
 * Logs unexpected errors (once, with stack) and rethrows them in the standard
 * error format. Errors already formatted by `ErrorResponse()` pass straight
 * through, so a 404 raised inside the try is still a 404, not a 500.
 */
export function catchBlockResponse(error: unknown, context?: string): never {
  const { exception, shouldLog } = toHttpException(error);
  if (shouldLog) logError(error, exception.getStatus(), context);
  throw exception;
}
