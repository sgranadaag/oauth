import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { BasicTokenRequest } from '@common/interfaces/authenticatedRequest.interface';
import { decodeBasicAuth } from '@common/utils/http.util';

const SERVER_ERROR_STATUS = 500;
const CLIENT_ERROR_STATUS = 400;

const REDACTED = '[redacted]';

const SENSITIVE_QUERY_PARAMS = new Set([
  'access_token',
  'refresh_token',
  'token',
  'code',
  'client_secret',
  'password',
]);

type LoggableRequest = Request & Partial<Pick<BasicTokenRequest, 'client'>>;

function redactQuery(originalUrl: string): string {
  const [path, query] = originalUrl.split('?');
  if (!query) return path;

  const params = new URLSearchParams(query);
  for (const key of [...params.keys()]) {
    if (SENSITIVE_QUERY_PARAMS.has(key)) {
      params.set(key, REDACTED);
    }
  }
  return `${path}?${params.toString()}`;
}

function describeCaller(request: LoggableRequest): string {
  if (request.client) return ` client=${request.client.id}`;

  const credentials = decodeBasicAuth(request.header('authorization'));
  return credentials ? ` client=${credentials.id}` : '';
}

@Injectable()
export class RequestLoggerMiddleware implements NestMiddleware {
  private readonly logger = new Logger('HTTP');

  use(
    request: LoggableRequest,
    response: Response,
    next: NextFunction,
  ): void {
    const startedAt = process.hrtime.bigint();

    response.once('finish', () => {
      const elapsedMs = Number(process.hrtime.bigint() - startedAt) / 1e6;
      const message =
        `${request.method} ${redactQuery(request.originalUrl)} ` +
        `${response.statusCode} ${elapsedMs.toFixed(1)}ms` +
        describeCaller(request);

      if (response.statusCode >= SERVER_ERROR_STATUS) {
        this.logger.error(message);
      } else if (response.statusCode >= CLIENT_ERROR_STATUS) {
        this.logger.warn(message);
      } else {
        this.logger.log(message);
      }
    });

    next();
  }
}
