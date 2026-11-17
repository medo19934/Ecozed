import { z } from 'zod';
import { GenderSchema, RecordStatusSchema } from '../enums';
import { PaginationQuerySchema, PhoneSchema } from './common';

const optText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();
const optEmail = z
  .union([z.string().trim().toLowerCase().pipe(z.email()), z.literal('').transform(() => null)])
  .nullable()
  .optional();
const optPhone = z
  .union([PhoneSchema, z.literal('').transform(() => null)])
  .nullable()
  .optional();

// ---------------- Admissions ----------------

export const AdmissionStatusSchema = z.enum(['UNDER_REVIEW', 'ACCEPTED', 'REJECTED']);
export type AdmissionStatus = z.infer<typeof AdmissionStatusSchema>;

export const CreateAdmissionSchema = z.object({
  daycareId: z.uuid(),
  childName: z.string().trim().min(2).max(120),
  childGender: GenderSchema,
  childBirthDate: z.iso.date(),
  guardianName: z.string().trim().min(2).max(120),
  relationship: z.string().trim().min(1).max(40),
  phone: optPhone,
  email: optEmail,
  notes: optText(1000),
});
/** Email defaults to the requesting parent's sign-in email on the server. */
export type CreateAdmissionInput = z.infer<typeof CreateAdmissionSchema>;

export const AdmissionListQuerySchema = PaginationQuerySchema.extend({
  status: AdmissionStatusSchema.optional(),
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
});
export type AdmissionListQuery = z.infer<typeof AdmissionListQuerySchema>;

export const AcceptAdmissionSchema = z.object({ classroomId: z.uuid().nullable().optional() });
export type AcceptAdmissionInput = z.infer<typeof AcceptAdmissionSchema>;

export const RejectAdmissionSchema = z.object({ reason: z.string().trim().min(2).max(500) });
export type RejectAdmissionInput = z.infer<typeof RejectAdmissionSchema>;

// ---------------- Units ----------------

export const UnitSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    description: optText(2000),
    minAgeMonths: z.number().int().min(0).max(144).nullable().optional(),
    maxAgeMonths: z.number().int().min(0).max(144).nullable().optional(),
    goals: z.array(z.string().trim().min(1).max(200)).max(30).default([]),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .nullable()
      .optional(),
    startDate: z.iso.date().nullable().optional(),
  })
  .refine(
    (v) => v.minAgeMonths == null || v.maxAgeMonths == null || v.minAgeMonths <= v.maxAgeMonths,
    {
      message: 'age_range_invalid',
      path: ['maxAgeMonths'],
    },
  );
export type UnitInput = z.infer<typeof UnitSchema>;

export const UnitItemSchema = z.object({
  kind: z.enum(['LESSON', 'ACTIVITY']),
  title: z.string().trim().min(2).max(160),
  description: optText(2000),
});
export type UnitItemInput = z.infer<typeof UnitItemSchema>;

export const UnitListQuerySchema = z.object({
  status: RecordStatusSchema.default('ACTIVE'),
  search: z.string().trim().max(100).optional(),
});

// ---------------- Calendar ----------------

export const EventTypeSchema = z.enum([
  'EVENT',
  'LESSON',
  'ACTIVITY',
  'HOLIDAY',
  'MEETING',
  'TRIP',
]);
export type EventType = z.infer<typeof EventTypeSchema>;
export const EventAudienceSchema = z.enum(['ALL', 'BRANCH', 'CLASS']);
const Time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'invalid_time');

export const CalendarEventSchema = z
  .object({
    title: z.string().trim().min(2).max(160),
    description: optText(2000),
    type: EventTypeSchema.default('EVENT'),
    audience: EventAudienceSchema.default('BRANCH'),
    classroomId: z.uuid().nullable().optional(),
    unitId: z.uuid().nullable().optional(),
    teacherId: z.uuid().nullable().optional(),
    startDate: z.iso.date(),
    endDate: z.iso.date(),
    startTime: Time.nullable().optional(),
    endTime: Time.nullable().optional(),
  })
  .refine((v) => v.startDate <= v.endDate, { message: 'date_range_invalid', path: ['endDate'] })
  .refine((v) => v.audience !== 'CLASS' || v.classroomId, {
    message: 'class_required',
    path: ['classroomId'],
  })
  .refine((v) => !v.startTime || !v.endTime || v.startTime < v.endTime || v.startDate < v.endDate, {
    message: 'time_range_invalid',
    path: ['endTime'],
  });
export type CalendarEventInput = z.infer<typeof CalendarEventSchema>;

export const CalendarQuerySchema = z
  .object({
    from: z.iso.date(),
    to: z.iso.date(),
    classroomId: z.uuid().optional(),
    type: EventTypeSchema.optional(),
  })
  .refine((v) => v.from <= v.to, { message: 'date_range_invalid', path: ['to'] });
export type CalendarQuery = z.infer<typeof CalendarQuerySchema>;
