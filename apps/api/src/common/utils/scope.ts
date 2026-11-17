import { ForbiddenException } from '@nestjs/common';
import type { AuthContext } from '../decorators/auth.decorators';

/** Branch managers and super admins see the whole branch. */
export const isBranchAdmin = (auth: AuthContext): boolean =>
  auth.isSuperAdmin || auth.role === 'MANAGER' || auth.role === 'SUPER_ADMIN';

export const requireBranch = (auth: AuthContext): string => {
  if (!auth.daycareId)
    throw new ForbiddenException({ message: 'No active branch', code: 'no_branch' });
  return auth.daycareId;
};

export const pageArgs = (page: number, pageSize: number) => ({
  skip: (page - 1) * pageSize,
  take: pageSize,
});
