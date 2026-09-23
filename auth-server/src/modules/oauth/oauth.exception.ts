import { HttpException, HttpStatus } from '@nestjs/common';

export class OauthException extends HttpException {
  constructor(
    error: string,
    description: string,
    status: HttpStatus = HttpStatus.BAD_REQUEST,
  ) {
    super({ error, error_description: description }, status);
  }
}
