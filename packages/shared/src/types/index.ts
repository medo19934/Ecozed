import type { Role, StaffPermission, FeatureToggle } from '../enums';
import type { Locale } from '../constants';

export interface Paginated<T> {
  items: T[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
  /** Access token lifetime in seconds. */
  expiresIn: number;
}

/** A branch the user can act in (all branches for super admins). */
export interface MembershipSummary {
  daycareId: string;
  daycareName: string;
  role: Role;
}

export interface AuthUser {
  id: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  locale: Locale;
  isSuperAdmin: boolean;
  /** Active branch for this session (null for parents without linked children). */
  daycareId: string | null;
  role: Role;
  permissions: StaffPermission[];
  features: Partial<Record<FeatureToggle, boolean>>;
  memberships: MembershipSummary[];
}

export interface AuthResponse {
  user: AuthUser;
  tokens: AuthTokens;
}

/** Payload signed into the access JWT. */
export interface JwtAccessPayload {
  sub: string;
  daycareId: string | null;
  role: Role | null;
  sa?: boolean;
}

export interface ApiErrorBody {
  statusCode: number;
  message: string;
  code?: string;
  errors?: { path: string; message: string }[];
}
