import { z } from 'zod';

const values = <T extends Record<string, string>>(o: T) =>
  Object.values(o) as [T[keyof T], ...T[keyof T][]];

/**
 * SUPER_ADMIN: all branches · MANAGER: branch manager (own branch) ·
 * STAFF: teacher/assistant (own class) · PARENT: own linked children.
 */
export const Role = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  MANAGER: 'MANAGER',
  STAFF: 'STAFF',
  PARENT: 'PARENT',
} as const;
export type Role = (typeof Role)[keyof typeof Role];
export const RoleSchema = z.enum(values(Role));

/** Roles that may use the admin web app. */
export const ADMIN_ROLES: readonly Role[] = [Role.SUPER_ADMIN, Role.MANAGER, Role.STAFF];

export const StaffPermission = {
  CAN_ADD_CHILD: 'canAddChild',
  CAN_ADD_STAFF: 'canAddStaff',
  CAN_ARCHIVE_ACCOUNTS: 'canArchiveAccounts',
  CAN_VIEW_MESSAGES: 'canViewMessages',
  CAN_MANAGE_ATTENDANCE: 'canManageAttendance',
  CAN_MANAGE_CURRICULUM: 'canManageCurriculum',
  CAN_MANAGE_ENROLLMENT: 'canManageEnrollment',
  CAN_MANAGE_PAYMENTS: 'canManagePayments',
  CAN_VIEW_REPORTS: 'canViewReports',
  CAN_MANAGE_SETTINGS: 'canManageSettings',
  CAN_MANAGE_CLASSES: 'canManageClasses',
} as const;
export type StaffPermission = (typeof StaffPermission)[keyof typeof StaffPermission];
export const StaffPermissionSchema = z.enum(values(StaffPermission));
export const ALL_STAFF_PERMISSIONS = Object.values(StaffPermission);

export const FeatureToggle = {
  MESSAGES: 'messages',
  CHILD_QR_ATTENDANCE: 'childQrAttendance',
  STAFF_GEOFENCED_ATTENDANCE: 'staffGeofencedAttendance',
  /** AI "Daily Story" in messages — off by default (costs AI credits). */
  DAILY_STORY_AI: 'dailyStoryAi',
  DAILY_REPORTS: 'dailyReports',
  SUBSCRIPTIONS: 'subscriptions',
  CALENDAR: 'calendar',
  UNITS: 'units',
} as const;
export type FeatureToggle = (typeof FeatureToggle)[keyof typeof FeatureToggle];
export const FeatureToggleSchema = z.enum(values(FeatureToggle));

/** Value used when a branch has no saved switch for a module (modules are on unless switched off). */
export const FEATURE_DEFAULTS: Record<FeatureToggle, boolean> = {
  messages: true,
  childQrAttendance: true,
  staffGeofencedAttendance: false,
  dailyStoryAi: false,
  dailyReports: true,
  subscriptions: true,
  calendar: true,
  units: true,
};

export const StaffType = { TEACHER: 'TEACHER', ASSISTANT: 'ASSISTANT', ADMIN: 'ADMIN' } as const;
export type StaffType = (typeof StaffType)[keyof typeof StaffType];
export const StaffTypeSchema = z.enum(values(StaffType));

export const Gender = { MALE: 'MALE', FEMALE: 'FEMALE' } as const;
export type Gender = (typeof Gender)[keyof typeof Gender];
export const GenderSchema = z.enum(values(Gender));

export const AttendanceStatus = {
  NO_RECORD: 'NO_RECORD',
  ATTENDED: 'ATTENDED',
  ABSENT: 'ABSENT',
  VACATION: 'VACATION',
  DEPARTURE: 'DEPARTURE',
} as const;
export type AttendanceStatus = (typeof AttendanceStatus)[keyof typeof AttendanceStatus];
export const AttendanceStatusSchema = z.enum(values(AttendanceStatus));

export const EnrollmentStatus = {
  UNDER_REVIEW: 'UNDER_REVIEW',
  ACCEPTED: 'ACCEPTED',
  REJECTED: 'REJECTED',
} as const;
export type EnrollmentStatus = (typeof EnrollmentStatus)[keyof typeof EnrollmentStatus];
export const EnrollmentStatusSchema = z.enum(values(EnrollmentStatus));

export const PaymentStatus = { PAID: 'PAID', UNPAID: 'UNPAID' } as const;
export type PaymentStatus = (typeof PaymentStatus)[keyof typeof PaymentStatus];
export const PaymentStatusSchema = z.enum(values(PaymentStatus));

export const SubscriptionStatus = {
  ACTIVE: 'ACTIVE',
  ENDED: 'ENDED',
  CANCELED: 'CANCELED',
} as const;
export type SubscriptionStatus = (typeof SubscriptionStatus)[keyof typeof SubscriptionStatus];
export const SubscriptionStatusSchema = z.enum(values(SubscriptionStatus));

export const RecordStatus = { ACTIVE: 'ACTIVE', ARCHIVED: 'ARCHIVED' } as const;
export type RecordStatus = (typeof RecordStatus)[keyof typeof RecordStatus];
export const RecordStatusSchema = z.enum(values(RecordStatus));
