import { Injectable, Logger, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';
import type { BasicTokenRequest } from '@interfaces/authenticatedRequest.interface';

const SERVER_ERROR_STATUS = 500;
const CLIENT_ERROR_STATUS = 400;

const REDACTED = '[redacted]';

// Every endpoint here takes its credentials in the body or the Authorization
// header, so none of these should ever appear in a URL — but a log line is
// forever, and one mistaken `?token=` would persist a live credential.
const SENSITIVE_QUERY_PARAMS = new Set([
  'access_token',
  'refresh_token',
  'token',
  'code',
  'client_secret',
  'password',
  'id_token_hint',
]);

type LoggableRequest = Request & Partial<Pick<BasicTokenRequest, 'client'>>;

function redactQuery(originalUrl: string): string {
  const [path, query] = originalUrl.split('?');
  if (!query) {
    return path;
  }

  const params = new URLSearchParams(query);
  for (const key of [...params.keys()]) {
    if (SENSITIVE_QUERY_PARAMS.has(key)) {
      params.set(key, REDACTED);
    }
  }
  return `${path}?${params.toString()}`;
}

// Middleware runs before guards, so nothing has annotated the request when a
// log line is being prepared. Reading the Basic auth *username* back out is what
// keeps token requests attributable without depending on guard state. The half
// after the first colon is the client secret and is never touched.
function readBasicAuthClientId(request: Request): string | undefined {
  const header = request.header('authorization');
  if (!header?.startsWith('Basic ')) {
    return undefined;
  }

  const decoded = Buffer.from(header.slice('Basic '.length), 'base64').toString(
    'utf8',
  );
  const separatorIndex = decoded.indexOf(':');
  return separatorIndex === -1 ? undefined : decoded.slice(0, separatorIndex);
}

function describeCaller(request: LoggableRequest): string {
  if (request.client) {
    return ` client=${request.client.id}`;
  }

  const basicAuthClientId = readBasicAuthClientId(request);
  return basicAuthClientId ? ` client=${basicAuthClientId}` : '';
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

    // Logged on 'finish' rather than on the way in, so one line carries the
    // outcome — and so the guards have already run and can be asked who the
    // caller turned out to be. Bodies are never logged: they hold passwords
    // and client secrets in cleartext.
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
