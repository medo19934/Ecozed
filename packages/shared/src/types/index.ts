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

export interface BranchDto {
  id: string;
  name: string;
  nameEn: string | null;
  slug: string;
  hasLogo: boolean;
  phone: string | null;
  email: string | null;
  city: string | null;
  address: string | null;
  latitude: number | null;
  longitude: number | null;
  geofenceRadiusM: number;
  useHijri: boolean;
  currency: string;
  timezone: string;
  features: Record<string, boolean>;
  updatedAt: string;
}

export interface ClassroomDto {
  id: string;
  name: string;
  capacity: number;
  minAgeMonths: number | null;
  maxAgeMonths: number | null;
  color: string | null;
  childrenCount: number;
  isTest: boolean;
  teachers: { membershipId: string; fullName: string; avatarUrl: string | null }[];
}

export interface StaffListItem {
  membershipId: string;
  userId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  avatarUrl: string | null;
  role: 'MANAGER' | 'STAFF';
  staffType: 'TEACHER' | 'ASSISTANT' | 'ADMIN' | null;
  status: 'ACTIVE' | 'ARCHIVED';
  specialties: string[];
  joinDate: string | null;
  /** True until the person signs in with Google for the first time. */
  pendingFirstLogin: boolean;
  isTest: boolean;
  classes: { id: string; name: string }[];
}

export interface StaffDetail extends StaffListItem {
  qualification: string | null;
  address: string | null;
  permissions: string[];
  createdAt: string;
}

export interface DocumentDto {
  id: string;
  name: string;
  category: string | null;
  mimeType: string;
  size: number;
  createdAt: string;
  deletedAt: string | null;
}

export interface GuardianDto {
  id: string;
  fullName: string;
  relationship: string;
  phone: string | null;
  email: string | null;
  isPrimary: boolean;
  /** Linked to a parent account (they signed in with Google). */
  linked: boolean;
}

export interface ChildListItem {
  id: string;
  fullName: string;
  gender: 'MALE' | 'FEMALE';
  birthDate: string;
  hasPhoto: boolean;
  status: 'ACTIVE' | 'ARCHIVED';
  isTest: boolean;
  classroom: { id: string; name: string } | null;
  primaryGuardian: { fullName: string; relationship: string; phone: string | null } | null;
}

export interface ChildDetail extends ChildListItem {
  allergies: string | null;
  medicalNotes: string | null;
  pickupPeople: { name: string; relationship: string; phone: string }[];
  guardians: GuardianDto[];
  createdAt: string;
}

/** What a parent sees about their own children. */
export interface ParentChildDto {
  id: string;
  fullName: string;
  gender: 'MALE' | 'FEMALE';
  birthDate: string;
  hasPhoto: boolean;
  branch: { id: string; name: string; nameEn: string | null };
  classroom: { id: string; name: string } | null;
}
