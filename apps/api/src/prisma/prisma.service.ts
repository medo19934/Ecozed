import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { AppConfig } from '../config/app-config.service';
import { SOFT_DELETE_MODELS, TENANT_MODELS, applyScope, requireTenantId } from './tenancy';

const buildScoped = (base: PrismaClient) =>
  base.$extends({
    name: 'tenancy',
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          const scoped = TENANT_MODELS.has(model) || SOFT_DELETE_MODELS.has(model);
          if (!scoped) return query(args);
          const daycareId = TENANT_MODELS.has(model) ? requireTenantId() : '';
          const nextArgs = applyScope(model, operation, args as never, daycareId);

          // Soft delete: turn deletes into updates of deletedAt.
          if (
            SOFT_DELETE_MODELS.has(model) &&
            (operation === 'delete' || operation === 'deleteMany')
          ) {
            const delegateName = model.charAt(0).toLowerCase() + model.slice(1);
            const delegate = (
              base as unknown as Record<string, Record<string, (a: unknown) => unknown>>
            )[delegateName]!;
            const op = operation === 'delete' ? 'update' : 'updateMany';
            return delegate[op]!({ where: nextArgs.where, data: { deletedAt: new Date() } });
          }
          return query(nextArgs as never);
        },
      },
    },
  });

export type ScopedPrismaClient = ReturnType<typeof buildScoped>;

/**
 * - `scoped`: tenant + soft-delete aware client. Use it in all feature services.
 * - `raw`: unscoped client for auth/platform/system jobs only.
 */
@Injectable()
export class PrismaService implements OnModuleInit, OnModuleDestroy {
  readonly raw: PrismaClient;
  readonly scoped: ScopedPrismaClient;

  constructor(config: AppConfig) {
    const adapter = new PrismaPg({ connectionString: config.get('DATABASE_URL') });
    this.raw = new PrismaClient({ adapter });
    this.scoped = buildScoped(this.raw);
  }

  async onModuleInit(): Promise<void> {
    await this.raw.$connect();
  }

  async onModuleDestroy(): Promise<void> {
    await this.raw.$disconnect();
  }
}
