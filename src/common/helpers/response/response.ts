import type { PaginationMetaDto } from '../../dto/pagination.dto.js';

export interface FieldError {
  field: string;
  messages: string[];
}

export interface OkResponse<T> {
  status: number;
  success: true;
  message: string;
  data: T;
  meta?: PaginationMetaDto;
}

export interface ErrorResponseBody {
  status: 'failed';
  success: false;
  /** Short error name, e.g. "Not Found". */
  error: string;
  message: string;
  errorCode: number;
  /** Per-field details, only on validation failures. */
  errors?: FieldError[];
}

/**
 * The single response envelope for the API: every success is
 * `ResponseObject.Ok(...)` and every error body is `ResponseObject.Error(...)`.
 */
export class ResponseObject {
  static Ok<T>(
    data: T,
    message = '',
    status = 200,
    meta?: PaginationMetaDto,
  ): OkResponse<T> {
    return { status, success: true, message, data, ...(meta && { meta }) };
  }

  static Error(
    error: string,
    message = '',
    errorCode = 500,
    errors?: FieldError[],
  ): ErrorResponseBody {
    return {
      status: 'failed',
      success: false,
      error,
      message,
      errorCode,
      ...(errors && { errors }),
    };
  }

  /** True for bodies already produced by `ResponseObject.Error`. */
  static isError(body: unknown): body is ErrorResponseBody {
    return (
      typeof body === 'object' &&
      body !== null &&
      (body as ErrorResponseBody).status === 'failed' &&
      (body as ErrorResponseBody).success === false &&
      typeof (body as ErrorResponseBody).errorCode === 'number'
    );
  }
}
