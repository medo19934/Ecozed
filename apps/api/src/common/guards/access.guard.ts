import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import type { FeatureToggle, Role, StaffPermission } from '@latif/shared';
import { PrismaService } from '../../prisma/prisma.service';
import {
  FEATURES,
  IS_PUBLIC,
  PERMISSIONS,
  ROLES,
  type AuthContext,
} from '../decorators/auth.decorators';
import { hasPermissions } from './permissions';

/** Global guard (runs after AuthGuard): roles, permission flags, feature toggles. */
@Injectable()
export class AccessGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    private readonly prisma: PrismaService,
  ) {}

  private meta<T>(key: string, ctx: ExecutionContext): T | undefined {
    return this.reflector.getAllAndOverride<T>(key, [ctx.getHandler(), ctx.getClass()]);
  }

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    if (this.meta<boolean>(IS_PUBLIC, ctx)) return true;
    const auth: AuthContext | undefined = ctx.switchToHttp().getRequest().auth;
    if (!auth) throw new ForbiddenException();

    const roles = this.meta<Role[]>(ROLES, ctx);
    const perms = this.meta<StaffPermission[]>(PERMISSIONS, ctx);
    const features = this.meta<FeatureToggle[]>(FEATURES, ctx);

    if (auth.isSuperAdmin && !features?.length) return true;

    if (roles?.length && !auth.isSuperAdmin && (!auth.role || !roles.includes(auth.role))) {
      throw new ForbiddenException('Insufficient role');
    }
    if (perms?.length && !hasPermissions(auth.permissions, perms)) {
      throw new ForbiddenException('Missing permission');
    }
    if (features?.length) {
      if (!auth.daycareId) throw new ForbiddenException('No active daycare');
      const enabled = await this.prisma.raw.daycareFeature.count({
        where: { daycareId: auth.daycareId, key: { in: features }, enabled: true },
      });
      if (enabled !== features.length) throw new ForbiddenException('Feature disabled');
    }
    return true;
  }
}
