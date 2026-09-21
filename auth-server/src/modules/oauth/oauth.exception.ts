import { HttpException, HttpStatus } from '@nestjs/common';

// RFC 6749 §5.2 fixes the error body as `{ error, error_description }`, which is
// not Nest's default `{ statusCode, message, error }` — every failure on the
// token endpoint has to be thrown through this, or clients written against the
// spec cannot read it.
export class OauthException extends HttpException {
  constructor(
    error: string,
    description: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super({ error, error_description: description }, status);
  }
}
