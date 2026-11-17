import { z } from 'zod';
import { PaymentStatusSchema, SubscriptionStatusSchema } from '../enums';
import { PaginationQuerySchema } from './common';

// ---------------- Subscriptions ----------------

export const PlanPeriodSchema = z.enum(['MONTHLY', 'TERM', 'YEARLY']);
export const PaymentMethodSchema = z.enum(['CASH', 'CARD', 'TRANSFER']);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'invalid_date');

export const PlanSchema = z.object({
  name: z.string().trim().min(2).max(80),
  price: z.coerce.number().min(0).max(1_000_000),
  period: PlanPeriodSchema.default('MONTHLY'),
  services: z.array(z.string().trim().min(1).max(60)).max(20).default([]),
});
export type PlanInput = z.infer<typeof PlanSchema>;

export const CreateSubscriptionSchema = z
  .object({
    childId: z.uuid(),
    planId: z.uuid().nullable().optional(),
    value: z.coerce.number().min(0).max(1_000_000),
    startDate: isoDate,
    endDate: isoDate,
    paymentStatus: PaymentStatusSchema.default('UNPAID'),
    paymentMethod: PaymentMethodSchema.nullable().optional(),
    notes: z.string().trim().max(500).optional(),
  })
  .refine((s) => s.endDate >= s.startDate, { message: 'date_range_invalid', path: ['endDate'] });
export type CreateSubscriptionInput = z.infer<typeof CreateSubscriptionSchema>;

export const MarkPaidSchema = z.object({ paymentMethod: PaymentMethodSchema.default('CASH') });

export const SubscriptionListQuerySchema = PaginationQuerySchema.extend({
  classroomId: z.uuid().optional(),
  planId: z.uuid().optional(),
  accountStatus: z.enum(['ACTIVE', 'ARCHIVED']).optional(),
  paymentStatus: PaymentStatusSchema.optional(),
  status: SubscriptionStatusSchema.optional(),
  /** Started within: today / week / month / year. */
  period: z.enum(['today', 'week', 'month', 'year']).optional(),
});
export type SubscriptionListQuery = z.infer<typeof SubscriptionListQuerySchema>;

// ---------------- Daily reports ----------------

export const MealSchema = z.object({
  meal: z.enum(['BREAKFAST', 'SNACK', 'LUNCH']),
  amount: z.enum(['ALL', 'MOST', 'SOME', 'NONE']),
});
export const MoodSchema = z.enum(['HAPPY', 'CALM', 'TIRED', 'SAD', 'UPSET']);

export const DailyReportSchema = z.object({
  childId: z.uuid(),
  date: isoDate,
  meals: z.array(MealSchema).max(3).default([]),
  napMinutes: z.coerce.number().int().min(0).max(600).nullable().optional(),
  toilet: z.coerce.number().int().min(0).max(30).nullable().optional(),
  mood: MoodSchema.nullable().optional(),
  activities: z.string().trim().max(1000).nullable().optional(),
  notes: z.string().trim().max(1000).nullable().optional(),
  /** Share with the family now (also posts it in the child's chat). */
  share: z.boolean().default(false),
});
export type DailyReportInput = z.infer<typeof DailyReportSchema>;
