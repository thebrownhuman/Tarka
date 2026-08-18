import { Global, Module, OnModuleDestroy, Inject } from '@nestjs/common';
import { Pool } from 'pg';
import { databaseProviders, PG_POOL } from './database.providers';

/**
 * Global module so every feature module can inject PG_POOL without
 * re-importing DatabaseModule everywhere.
 */
@Global()
@Module({
  providers: [...databaseProviders],
  exports: [...databaseProviders],
})
export class DatabaseModule implements OnModuleDestroy {
  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onModuleDestroy(): Promise<void> {
    await this.pool.end();
  }
}
