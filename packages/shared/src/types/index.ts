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
  locale: Locale;
  isSuperAdmin: boolean;
  /** Active tenant for this session (null for super admins / users without membership). */
  daycareId: string | null;
  role: Role | null;
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
