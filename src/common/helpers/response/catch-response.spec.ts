import {
  type ArgumentsHost,
  BadRequestException,
  HttpException,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { QueryFailedError } from 'typeorm';
import { HttpCodesEnum } from '../../enums/http-codes.enum.js';
import { AllExceptionsFilter } from '../../filters/all-exceptions.filter.js';
import { catchBlockResponse, ErrorResponse } from './catch-response.js';
import { ResponseObject } from './response.js';

const pgError = (code: string) =>
  new QueryFailedError(
    'SELECT 1',
    [],
    Object.assign(new Error('pg says no'), { code }),
  );

/** Runs fn and returns what it threw. */
function thrown(fn: () => unknown): HttpException {
  try {
    fn();
  } catch (e) {
    return e as HttpException;
  }
  throw new Error('expected a throw');
}

describe('ResponseObject', () => {
  it('Ok builds the success envelope, with meta only when given', () => {
    expect(ResponseObject.Ok({ id: 1 }, 'done', 201)).toEqual({
      status: 201,
      success: true,
      message: 'done',
      data: { id: 1 },
    });
    const meta = {
      page: 1,
      limit: 20,
      total: 0,
      totalPages: 0,
      hasNextPage: false,
    };
    expect(ResponseObject.Ok([], 'ok', 200, meta).meta).toBe(meta);
  });
});

describe('ErrorResponse', () => {
  it('throws the typed exception with the standard error body', () => {
    const e = thrown(() =>
      ErrorResponse('Listing x not found', HttpCodesEnum.HTTP_NOT_FOUND),
    );
    expect(e).toBeInstanceOf(NotFoundException);
    expect(e.getStatus()).toBe(404);
    expect(e.getResponse()).toEqual({
      status: 'failed',
      success: false,
      error: 'Not Found',
      message: 'Listing x not found',
      errorCode: 404,
    });
  });

  it('supports codes without a dedicated exception class', () => {
    const e = thrown(() =>
      ErrorResponse('Slow down', HttpCodesEnum.HTTP_TOO_MANY_REQUESTS),
    );
    expect(e.getStatus()).toBe(429);
    expect(e.getResponse()).toMatchObject({ error: 'Too Many Requests' });
  });

  it('never exposes the message of a 5xx', () => {
    const e = thrown(() => ErrorResponse('db password is hunter2'));
    expect(e.getStatus()).toBe(500);
    expect(JSON.stringify(e.getResponse())).not.toContain('hunter2');
  });
});

describe('catchBlockResponse', () => {
  let errorLog: ReturnType<typeof vi.spyOn>;
  let warnLog: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    errorLog = vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    warnLog = vi.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('passes errors from ErrorResponse through unchanged and does not log them', () => {
    const original = thrown(() =>
      ErrorResponse('Listing x not found', HttpCodesEnum.HTTP_NOT_FOUND),
    );
    const e = thrown(() => catchBlockResponse(original, 'Test'));
    expect(e).toBe(original);
    expect(errorLog).not.toHaveBeenCalled();
    expect(warnLog).not.toHaveBeenCalled();
  });

  it('formats plain Nest HttpExceptions', () => {
    const e = thrown(() =>
      catchBlockResponse(new BadRequestException('bad thing')),
    );
    expect(e.getResponse()).toEqual(
      ResponseObject.Error('Bad Request', 'bad thing', 400),
    );
  });

  it.each([
    ['23505', 409],
    ['23503', 409],
    ['23514', 400],
    ['22P02', 400],
  ])('maps Postgres error %s to %i and logs a warning', (code, status) => {
    const e = thrown(() => catchBlockResponse(pgError(code), 'Test'));
    expect(e.getStatus()).toBe(status);
    expect(warnLog).toHaveBeenCalledOnce();
    expect(JSON.stringify(e.getResponse())).not.toContain('pg says no');
  });

  it('turns unknown errors into a generic 500 and logs them with context', () => {
    const e = thrown(() =>
      catchBlockResponse(
        new Error('connect ECONNREFUSED postgres://u:secret@db'),
        'ListingsService.create',
      ),
    );
    expect(e.getStatus()).toBe(500);
    expect(e.getResponse()).toEqual(
      ResponseObject.Error(
        'Internal Server Error',
        'Unable to perform request at the moment',
        500,
      ),
    );
    expect(JSON.stringify(e.getResponse())).not.toContain('secret');
    expect(errorLog).toHaveBeenCalledWith(
      expect.stringContaining('[ListingsService.create]'),
      expect.any(String),
    );
  });

  it('treats unmapped database errors as 500', () => {
    expect(thrown(() => catchBlockResponse(pgError('53300'))).getStatus()).toBe(
      500,
    );
  });
});

describe('AllExceptionsFilter', () => {
  function run(exception: unknown) {
    const res = { status: vi.fn().mockReturnThis(), json: vi.fn() };
    const host = {
      switchToHttp: () => ({
        getRequest: () => ({
          method: 'GET',
          originalUrl: '/api/v1/listings?x=1',
        }),
        getResponse: () => res,
      }),
    } as unknown as ArgumentsHost;
    new AllExceptionsFilter().catch(exception, host);
    return {
      status: res.status.mock.calls[0][0],
      body: res.json.mock.calls[0][0],
    };
  }

  beforeEach(() => {
    vi.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });
  afterEach(() => vi.restoreAllMocks());

  it('sends already-formatted errors as-is', () => {
    const e = thrown(() => ErrorResponse('nope', HttpCodesEnum.HTTP_NOT_FOUND));
    expect(run(e)).toEqual({ status: 404, body: e.getResponse() });
  });

  it('formats errors raised outside services (pipes, body parser)', () => {
    const { status, body } = run(
      new BadRequestException('Validation failed (uuid v 4 is expected)'),
    );
    expect(status).toBe(400);
    expect(body).toEqual(
      ResponseObject.Error(
        'Bad Request',
        'Validation failed (uuid v 4 is expected)',
        400,
      ),
    );
  });

  it('renders unknown errors as a generic 500', () => {
    expect(run(new TypeError('x is undefined')).body).toMatchObject({
      errorCode: 500,
      message: 'Unable to perform request at the moment',
    });
  });
});
