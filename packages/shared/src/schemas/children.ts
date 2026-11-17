import { z } from 'zod';
import { GenderSchema, RecordStatusSchema } from '../enums';
import { PaginationQuerySchema, PhoneSchema } from './common';

const nullableText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

export const GuardianSchema = z
  .object({
    id: z.uuid().optional(),
    fullName: z.string().trim().min(2).max(120),
    relationship: z.string().trim().min(1).max(40),
    phone: z
      .union([PhoneSchema, z.literal('').transform(() => null)])
      .nullable()
      .optional(),
    email: z
      .union([z.string().trim().toLowerCase().pipe(z.email()), z.literal('').transform(() => null)])
      .nullable()
      .optional(),
    isPrimary: z.boolean().default(false),
  })
  .refine((g) => g.phone || g.email, { message: 'guardian_contact_required', path: ['email'] });
export type GuardianInput = z.infer<typeof GuardianSchema>;

export const PickupPersonSchema = z.object({
  name: z.string().trim().min(2).max(120),
  relationship: z.string().trim().max(40).default(''),
  phone: z.string().trim().max(20).default(''),
});
export type PickupPerson = z.infer<typeof PickupPersonSchema>;

export const ChildSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  gender: GenderSchema,
  birthDate: z.iso.date(),
  classroomId: z.uuid().nullable().optional(),
  allergies: nullableText(500),
  medicalNotes: nullableText(1000),
  pickupPeople: z.array(PickupPersonSchema).max(10).default([]),
  guardians: z.array(GuardianSchema).min(1).max(6),
});
export type ChildInput = z.infer<typeof ChildSchema>;

export const ChildListQuerySchema = PaginationQuerySchema.extend({
  status: RecordStatusSchema.default('ACTIVE'),
  classroomId: z.uuid().optional(),
  gender: GenderSchema.optional(),
});
export type ChildListQuery = z.infer<typeof ChildListQuerySchema>;

/** Staff add a parent: a guardian row on each chosen child; the parent then signs in with that email/phone. */
export const AddParentSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    relationship: z.string().trim().min(1).max(40),
    phone: z
      .union([PhoneSchema, z.literal('').transform(() => null)])
      .nullable()
      .optional(),
    email: z
      .union([z.string().trim().toLowerCase().pipe(z.email()), z.literal('').transform(() => null)])
      .nullable()
      .optional(),
    childIds: z.array(z.uuid()).min(1).max(20),
  })
  .refine((g) => g.phone || g.email, { message: 'guardian_contact_required', path: ['email'] });
export type AddParentInput = z.infer<typeof AddParentSchema>;

export const ParentAccountSchema = z.object({
  /** The parent's email or phone as listed (ParentListItem.key). */
  key: z.string().trim().min(3).max(120),
  reset: z.boolean().default(false),
});
export type ParentAccountInput = z.infer<typeof ParentAccountSchema>;
