import { AsyncLocalStorage } from 'node:async_hooks';
import type { Role, StaffPermission } from '@latif/shared';

export interface RequestContextStore {
  requestId: string;
  ip?: string;
  userAgent?: string;
  userId?: string;
  daycareId?: string | null;
  role?: Role | null;
  permissions?: StaffPermission[];
  isSuperAdmin?: boolean;
  membershipId?: string | null;
}

const als = new AsyncLocalStorage<RequestContextStore>();

/** Per-request context (actor + tenant), backed by AsyncLocalStorage. */
export const RequestContext = {
  run<T>(store: RequestContextStore, fn: () => T): T {
    return als.run(store, fn);
  },
  get(): RequestContextStore | undefined {
    return als.getStore();
  },
  /** Mutates the current store (used by the auth guard after token verification). */
  assign(patch: Partial<RequestContextStore>): void {
    const store = als.getStore();
    if (store) Object.assign(store, patch);
  },
  /** Current tenant id or undefined. Never derived from client input. */
  daycareId(): string | undefined {
    return als.getStore()?.daycareId ?? undefined;
  },
};
