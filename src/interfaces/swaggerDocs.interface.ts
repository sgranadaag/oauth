import type { ApiOperationOptions, ApiParamOptions } from '@nestjs/swagger';

export interface SwaggerResponseSchema {
  readonly description: string;
  readonly schema?: Readonly<Record<string, unknown>>;
}

export interface SwaggerEndpointSchema {
  readonly operation: ApiOperationOptions;
  readonly security?: string;
  readonly consumes?: string;
  readonly params?: readonly ApiParamOptions[];
  readonly body?: Readonly<Record<string, unknown>>;
  readonly responses: Readonly<Record<number, SwaggerResponseSchema>>;
}
