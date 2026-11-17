import { SetMetadata, createParamDecorator, type ExecutionContext } from '@nestjs/common';
import type { FeatureToggle, Role, StaffPermission } from '@latif/shared';

export const IS_PUBLIC = 'isPublic';
export const ROLES = 'roles';
export const PERMISSIONS = 'permissions';
export const FEATURES = 'features';

/** Skip authentication for this route. */
export const Public = () => SetMetadata(IS_PUBLIC, true);
/** Restrict to these roles (SuperAdmin always passes). */
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);
/** Require staff permission flags (Owner/Manager implicitly hold all). */
export const RequirePermissions = (...perms: StaffPermission[]) => SetMetadata(PERMISSIONS, perms);
/** Require per-daycare feature toggles to be enabled. */
export const RequireFeature = (...features: FeatureToggle[]) => SetMetadata(FEATURES, features);

export interface AuthContext {
  userId: string;
  daycareId: string | null;
  role: Role | null;
  permissions: StaffPermission[];
  isSuperAdmin: boolean;
}

export const CurrentAuth = createParamDecorator(
  (_: unknown, ctx: ExecutionContext): AuthContext => ctx.switchToHttp().getRequest().auth,
);
