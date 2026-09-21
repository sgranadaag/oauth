import type { FactoryProvider, ModuleMetadata } from '@nestjs/common';
import type { RedisOptions } from 'ioredis';

export interface RedisModuleAsyncOptions extends Pick<ModuleMetadata, 'imports'> {
  inject?: FactoryProvider['inject'];
  useFactory: (...args: any[]) => RedisOptions | Promise<RedisOptions>;
}
