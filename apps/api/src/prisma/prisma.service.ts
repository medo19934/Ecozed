import { Injectable, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common';
import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client';
import { AppConfig } from '../config/app-config.service';
import { RequestContext } from '../common/context/request-context';
import {
  RLS_MODELS,
  SOFT_DELETE_MODELS,
  TENANT_MODELS,
  applyScope,
  requireTenantId,
} from './tenancy';

/** Set DB_RLS=off only in an emergency (falls back to API-only checks). */
const RLS_ON = process.env.DB_RLS !== 'off';

const buildScoped = (base: PrismaClient) => {
  /**
   * Runs one scoped operation under Row Level Security: a tiny transaction that switches to
   * the restricted role and sets the verified user id; the database decides what is visible.
   */
  const underRls = async <T>(model: string, op: () => Promise<T> | PromiseLike<T>): Promise<T> => {
    if (!RLS_ON || !RLS_MODELS.has(model)) return op();
    const userId = RequestContext.get()?.userId ?? '';
    const [, result] = await base.$transaction([
      base.$executeRaw`SELECT set_config('role', 'latif_rls', true), set_config('app.user_id', ${userId}, true)`,
      op() as never,
    ]);
    return result as T;
  };
  return base.$extends({
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
            return underRls(
              model,
              () =>
                delegate[op]!({ where: nextArgs.where, data: { deletedAt: new Date() } }) as never,
            );
          }
          return underRls(model, () => query(nextArgs as never));
        },
      },
    },
  });
};

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
