import type { AssistantOp } from '../schemas/assistant';
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
  /** Signed in with an admin-issued temporary password: must choose a new one. */
  mustChangePassword: boolean;
}

/** Returned once when an admin creates a login or resets a password. */
export interface IssuedPassword {
  identifier: string;
  fullName: string;
  tempPassword: string;
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

export type DayStatus = 'NO_RECORD' | 'ATTENDED' | 'ABSENT' | 'VACATION' | 'DEPARTURE';

export interface RosterRow {
  child: {
    id: string;
    fullName: string;
    gender: 'MALE' | 'FEMALE';
    hasPhoto: boolean;
    classroom: { id: string; name: string } | null;
  };
  status: DayStatus;
  checkInAt: string | null;
  checkOutAt: string | null;
  droppedOffBy: string | null;
  pickedUpBy: string | null;
  method: 'MANUAL' | 'QR' | 'PIN' | 'GEO' | null;
  note: string | null;
}

export interface RosterResponse {
  date: string;
  rows: RosterRow[];
  counts: Record<DayStatus, number>;
}

export interface StaffDayRow {
  membershipId: string;
  fullName: string;
  avatarUrl: string | null;
  staffType: string | null;
  checkInAt: string | null;
  checkOutAt: string | null;
  method: 'MANUAL' | 'QR' | 'PIN' | 'GEO' | null;
  distanceM: number | null;
}

export interface KioskToken {
  token: string;
  /** ISO time when this QR stops being accepted. */
  expiresAt: string;
  refreshInSeconds: number;
  branch: { id: string; name: string; nameEn: string | null; hasLogo: boolean };
}

/** What a scanned kiosk QR would do for the signed-in person (nothing is written yet). */
export interface KioskPreview {
  branch: { id: string; name: string; nameEn: string | null };
  person: string;
  kind: 'STAFF' | 'PARENT';
  /** Staff: next action for themselves (null = already checked out today). */
  staffNext: 'IN' | 'OUT' | null;
  /** Parent: their children in this branch with the next possible action. */
  children: { id: string; fullName: string; status: string; next: 'IN' | 'OUT' | null }[];
  /** Seconds left before this QR stops being accepted. */
  expiresInSeconds: number;
}

export interface KioskResultItem {
  kind: 'CHILD' | 'STAFF';
  name: string;
  direction: 'IN' | 'OUT';
  at: string;
}

export interface KioskResult {
  person: string;
  items: KioskResultItem[];
}

export interface MyAttendance {
  date: string;
  /** Staff members: their own day. */
  staff: { checkInAt: string | null; checkOutAt: string | null } | null;
  /** Parents: their children in the active branch (or all branches). */
  children: {
    id: string;
    fullName: string;
    status: DayStatus;
    checkInAt: string | null;
    checkOutAt: string | null;
  }[];
  hasPin: boolean;
  geofence: { enabled: boolean; configured: boolean; radiusM: number };
  kioskEnabled: boolean;
}

export interface VacationDto {
  id: string;
  child: { id: string; fullName: string; classroom: string | null };
  requestedBy: string;
  startDate: string;
  endDate: string;
  reason: string | null;
  status: 'PENDING' | 'APPROVED' | 'REJECTED';
  reviewNote: string | null;
  createdAt: string;
}

export interface DashboardSummary {
  scope: 'branch' | 'all';
  children: number;
  staff: number;
  classes: number;
  units: number;
  activities: number;
}

export interface DashboardAttendance {
  date: string;
  total: number;
  counts: Record<DayStatus, number>;
  updatedAt: string;
}

export interface BranchOption {
  id: string;
  name: string;
  nameEn: string | null;
  city: string | null;
}

export interface AdmissionDto {
  id: string;
  number: number;
  branch: { id: string; name: string; nameEn: string | null };
  childName: string;
  childGender: 'MALE' | 'FEMALE';
  childBirthDate: string;
  guardianName: string;
  relationship: string;
  phone: string | null;
  email: string | null;
  notes: string | null;
  status: 'UNDER_REVIEW' | 'ACCEPTED' | 'REJECTED';
  rejectReason: string | null;
  childId: string | null;
  createdAt: string;
}

export interface AdmissionListResponse extends Paginated<AdmissionDto> {
  counts: { total: number; UNDER_REVIEW: number; ACCEPTED: number; REJECTED: number };
}

export interface UnitItemDto {
  id: string;
  kind: 'LESSON' | 'ACTIVITY';
  title: string;
  description: string | null;
}

export interface UnitDto {
  id: string;
  name: string;
  description: string | null;
  minAgeMonths: number | null;
  maxAgeMonths: number | null;
  goals: string[];
  color: string | null;
  startDate: string | null;
  status: 'ACTIVE' | 'ARCHIVED';
  isTest: boolean;
  lessons: number;
  activities: number;
  items: UnitItemDto[];
  createdAt: string;
}

export interface UnitsResponse {
  items: UnitDto[];
  counts: { total: number; active: number; archived: number };
  teachers: {
    membershipId: string;
    fullName: string;
    avatarUrl: string | null;
    specialties: string[];
  }[];
}

export interface CalendarEventDto {
  id: string;
  title: string;
  description: string | null;
  type: 'EVENT' | 'LESSON' | 'ACTIVITY' | 'HOLIDAY' | 'MEETING' | 'TRIP';
  audience: 'ALL' | 'BRANCH' | 'CLASS';
  branch: { id: string; name: string } | null;
  classroom: { id: string; name: string; color: string | null } | null;
  unit: { id: string; name: string } | null;
  teacher: { membershipId: string; fullName: string } | null;
  startDate: string;
  endDate: string;
  startTime: string | null;
  endTime: string | null;
  canEdit: boolean;
}

export interface DemoAccount {
  email: string;
  role: 'SUPER_ADMIN' | 'MANAGER' | 'STAFF' | 'PARENT';
  name: string;
  branch: { slug: string; name: string; nameEn: string | null } | null;
}

export interface ThreadDto {
  id: string;
  kind: 'CHILD' | 'STAFF' | 'ANNOUNCEMENT';
  title: string;
  subtitle: string | null;
  branch: { id: string; name: string };
  child: { id: string; fullName: string; gender: 'MALE' | 'FEMALE'; hasPhoto: boolean } | null;
  lastMessage: {
    body: string | null;
    hasAttachment: boolean;
    senderName: string;
    at: string;
  } | null;
  unread: number;
  canPost: boolean;
}

export interface MessageDto {
  id: string;
  body: string | null;
  /** `url`: signed API path (`/messages/f/…`, ~6 h) usable without auth headers. */
  attachment: { name: string; mime: string; url: string } | null;
  sender: { id: string; fullName: string; avatarUrl: string | null; role: string | null };
  mine: boolean;
  /** For my messages: someone else has read it. */
  read: boolean;
  createdAt: string;
}

export interface ThreadMessages {
  thread: ThreadDto;
  messages: MessageDto[];
  hasMore: boolean;
}

export interface MessageContacts {
  children: { id: string; fullName: string; classroom: string | null; branch: string }[];
  staff: { userId: string; fullName: string; role: string; avatarUrl: string | null }[];
  classes: { id: string; name: string }[];
  canAnnounce: boolean;
}

export interface ParentListItem {
  /** Stable key: email or phone. */
  key: string;
  fullName: string;
  relationship: string;
  email: string | null;
  phone: string | null;
  /** Has signed in (linked to a user account). */
  linked: boolean;
  children: { id: string; fullName: string; classroom: string | null }[];
}

export interface PlanDto {
  id: string;
  name: string;
  price: number;
  period: 'MONTHLY' | 'TERM' | 'YEARLY';
  services: string[];
  activeCount: number;
}

export interface SubscriptionDto {
  id: string;
  child: {
    id: string;
    fullName: string;
    status: 'ACTIVE' | 'ARCHIVED';
    classroom: string | null;
    hasPhoto: boolean;
  };
  plan: { id: string; name: string } | null;
  value: number;
  startDate: string;
  endDate: string;
  paymentStatus: 'PAID' | 'UNPAID';
  paymentMethod: 'CASH' | 'CARD' | 'TRANSFER' | null;
  status: 'ACTIVE' | 'ENDED' | 'CANCELED';
  paidAt: string | null;
  lastRemindedAt: string | null;
  reminders: number;
  notes: string | null;
}

export interface SubscriptionSummary {
  total: number;
  paid: number;
  unpaid: number;
  canceled: number;
  unpaidAmount: number;
}

export interface SubscriptionListResponse extends Paginated<SubscriptionDto> {
  summary: SubscriptionSummary;
  /** Recent reminders for the side panel. */
  reminders: { subscriptionId: string; childName: string; at: string; count: number }[];
}

export interface DailyReportDto {
  id: string | null;
  child: { id: string; fullName: string; classroom: string | null; hasPhoto: boolean };
  date: string;
  meals: { meal: 'BREAKFAST' | 'SNACK' | 'LUNCH'; amount: 'ALL' | 'MOST' | 'SOME' | 'NONE' }[];
  napMinutes: number | null;
  toilet: number | null;
  mood: 'HAPPY' | 'CALM' | 'TIRED' | 'SAD' | 'UPSET' | null;
  activities: string | null;
  notes: string | null;
  author: string | null;
  sharedAt: string | null;
  updatedAt: string | null;
}

/** A person in a branch, as Settings > Users shows them. */
export interface ManagedUser {
  membershipId: string;
  userId: string;
  fullName: string;
  email: string | null;
  phone: string | null;
  role: 'MANAGER' | 'STAFF' | 'PARENT';
  branch: { id: string; name: string };
  status: 'ACTIVE' | 'DISABLED';
  classes: { id: string; name: string }[];
  children: { id: string; fullName: string; relationship: string; classroom: string | null }[];
  lastLoginAt: string | null;
  hasPassword: boolean;
}

export interface UserAuditEntry {
  id: string;
  action: string;
  at: string;
  actor: string | null;
  target: string | null;
  branch: string | null;
  details: Record<string, unknown> | null;
}

/** Smart assistant: proposed changes (nothing is saved until applied). */
export interface AssistantPlan {
  reply: string;
  /** How the input was understood (both rule-based, free): a table/CSV or chat instructions. */
  source: 'table' | 'text' | 'none';
  operations: AssistantOp[];
  warnings: string[];
}

export interface AssistantResult {
  index: number;
  status: 'done' | 'skipped' | 'failed';
  /** Short human text, e.g. error code or what was created. */
  detail: string | null;
  issued: IssuedPassword | null;
}
