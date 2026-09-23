import { applyDecorators } from '@nestjs/common';
import {
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiSecurity,
} from '@nestjs/swagger';
import type {
  ApiBodyOptions,
  ApiResponseCommonMetadata,
  ApiResponseOptions,
} from '@nestjs/swagger';
import type { SwaggerEndpointSchema } from '@common/interfaces/swaggerDocs.interface';

type SwaggerResponseType = NonNullable<ApiResponseCommonMetadata['type']>;

const LOWEST_SUCCESS_STATUS = 200;
const HIGHEST_SUCCESS_STATUS = 299;

function documentsSuccess(statusCode: number): boolean {
  return (
    statusCode >= LOWEST_SUCCESS_STATUS && statusCode <= HIGHEST_SUCCESS_STATUS
  );
}

/**
 * Applies every Swagger decorator an endpoint needs, read off one schema.
 *
 * `@SwaggerDocs(USER_SWAGGER.LOGIN)` replaces the stack of `@ApiOperation` /
 * `@ApiSecurity` / `@ApiOkResponse` / `@ApiUnauthorizedResponse` calls a
 * controller used to carry: whichever keys the schema declares become
 * decorators, and the ones it omits are simply not applied. Responses are
 * keyed by status code and emitted as `@ApiResponse({ status, ... })`, which
 * renders identically to the per-status helpers it replaces.
 *
 * @param schema - The endpoint's entry in its module `<MODULE>_SWAGGER` file.
 * @param responseType - Response body class, attached to the schema's single
 *   2xx entry. Passed here rather than named in the schema because a
 *   `<module>.swagger.ts` importing a DTO would close a cycle — the DTOs
 *   import `<MODULE>_PROPERTY_SWAGGER` back out of that same file, and the
 *   half-initialised module would leave `@ApiProperty` reading `undefined`.
 * @returns A single method decorator equivalent to all of them combined.
 */
export function SwaggerDocs(
  schema: SwaggerEndpointSchema,
  responseType?: SwaggerResponseType,
) {
  const decorators: MethodDecorator[] = [ApiOperation(schema.operation)];

  if (schema.security) {
    decorators.push(ApiSecurity(schema.security));
  }
  if (schema.consumes) {
    decorators.push(ApiConsumes(schema.consumes));
  }
  for (const param of schema.params ?? []) {
    decorators.push(ApiParam(param));
  }
  if (schema.body) {
    decorators.push(ApiBody(schema.body as ApiBodyOptions));
  }

  for (const [status, response] of Object.entries(schema.responses)) {
    const statusCode = Number(status);
    const responseOptions = response as ApiResponseOptions;
    const responseTypeField =
      responseType && documentsSuccess(statusCode) ? { type: responseType } : {};

    decorators.push(
      ApiResponse({
        status: statusCode,
        ...responseOptions,
        ...responseTypeField,
      }),
    );
  }

  return applyDecorators(...decorators);
}
