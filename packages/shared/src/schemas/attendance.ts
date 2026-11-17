import { z } from 'zod';

export const IsoDateSchema = z.iso.date();

export const RosterQuerySchema = z.object({
  date: IsoDateSchema.optional(),
  classroomId: z.uuid().optional(),
  search: z.string().trim().max(100).optional(),
});
export type RosterQuery = z.infer<typeof RosterQuerySchema>;

export const ChildAttendanceActionSchema = z.object({
  action: z.enum(['CHECK_IN', 'CHECK_OUT', 'ABSENT', 'CLEAR']),
  date: IsoDateSchema.optional(),
  /** Who dropped off / picked up (free text, e.g. "Mother"). */
  person: z.string().trim().max(120).optional(),
  note: z.string().trim().max(300).optional(),
});
export type ChildAttendanceActionInput = z.infer<typeof ChildAttendanceActionSchema>;

export const KioskPinSchema = z.object({ pin: z.string().regex(/^\d{6}$/, 'invalid_pin') });
export type KioskPinInput = z.infer<typeof KioskPinSchema>;

export const KioskScanSchema = z.object({
  token: z.string().min(20).max(500),
  /** Parent: which of their children (default: all in this branch). */
  childIds: z.array(z.uuid()).max(10).optional(),
});
export type KioskScanInput = z.infer<typeof KioskScanSchema>;

export const GeoCheckSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
  accuracy: z.number().min(0).max(5000).optional(),
});
export type GeoCheckInput = z.infer<typeof GeoCheckSchema>;

export const VacationRequestSchema = z
  .object({
    childId: z.uuid(),
    startDate: IsoDateSchema,
    endDate: IsoDateSchema,
    reason: z.string().trim().max(300).optional(),
  })
  .refine((v) => v.startDate <= v.endDate, { message: 'date_range_invalid', path: ['endDate'] });
export type VacationRequestInput = z.infer<typeof VacationRequestSchema>;

export const VacationReviewSchema = z.object({
  decision: z.enum(['APPROVED', 'REJECTED']),
  note: z.string().trim().max(300).optional(),
});
export type VacationReviewInput = z.infer<typeof VacationReviewSchema>;

export const VacationListQuerySchema = z.object({
  status: z.enum(['PENDING', 'APPROVED', 'REJECTED']).optional(),
});

export const DashboardQuerySchema = z.object({
  date: IsoDateSchema.optional(),
  classroomId: z.uuid().optional(),
  /** Super admin only: aggregate every branch. */
  scope: z.enum(['branch', 'all']).default('branch'),
});
export type DashboardQuery = z.infer<typeof DashboardQuerySchema>;
