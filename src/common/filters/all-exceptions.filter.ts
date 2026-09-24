import {
  type ArgumentsHost,
  Catch,
  type ExceptionFilter,
} from '@nestjs/common';
import type { Request, Response } from 'express';
import {
  logError,
  toHttpException,
} from '../helpers/response/catch-response.js';

/**
 * Safety net for errors that never reach a service's catchBlockResponse():
 * validation pipe failures, malformed ids, bad JSON bodies, unknown routes.
 * Renders them in the same `ResponseObject.Error` envelope, so every error
 * the API returns has one shape.
 */
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const ctx = host.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const { exception: httpException, shouldLog } = toHttpException(exception);
    const status = httpException.getStatus();
    if (shouldLog) {
      // Path without the query string: don't log request parameters.
      const path = (request.originalUrl ?? request.url).split('?')[0];
      logError(exception, status, `${request.method} ${path}`);
    }

    response.status(status).json(httpException.getResponse());
  }
}
