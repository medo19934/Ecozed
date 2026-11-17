import { z } from 'zod';
import { PaginationQuerySchema, PhoneSchema } from './common';

/** Roles an admin can give from Settings > Users (general admins are added in Settings > General admins). */
export const ManagedRoleSchema = z.enum(['MANAGER', 'STAFF', 'PARENT']);
export type ManagedRole = z.infer<typeof ManagedRoleSchema>;

const optPhone = z
  .union([PhoneSchema, z.literal('').transform(() => null)])
  .nullable()
  .optional();
const optEmail = z
  .union([z.string().trim().toLowerCase().pipe(z.email()), z.literal('').transform(() => null)])
  .nullable()
  .optional();

export const ChildLinkSchema = z.object({
  childId: z.uuid(),
  relationship: z.string().trim().min(1).max(40),
});

export const CreateUserSchema = z
  .object({
    role: ManagedRoleSchema,
    fullName: z.string().trim().min(2).max(120),
    email: optEmail,
    phone: optPhone,
    /** Required for general admins; managers always create in their own branch. */
    daycareId: z.uuid().optional(),
    classIds: z.array(z.uuid()).max(20).default([]),
    children: z.array(ChildLinkSchema).max(20).default([]),
  })
  .refine((u) => u.email || u.phone, { message: 'guardian_contact_required', path: ['email'] });
export type CreateUserInput = z.infer<typeof CreateUserSchema>;

export const UpdateUserSchema = z
  .object({
    fullName: z.string().trim().min(2).max(120),
    phone: optPhone,
    role: ManagedRoleSchema,
    daycareId: z.uuid(),
    classIds: z.array(z.uuid()).max(20),
  })
  .partial();
export type UpdateUserInput = z.infer<typeof UpdateUserSchema>;

export const UserListQuerySchema = PaginationQuerySchema.extend({
  role: ManagedRoleSchema.optional(),
  daycareId: z.uuid().optional(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
});
export type UserListQuery = z.infer<typeof UserListQuerySchema>;

export const MoveChildSchema = z.object({
  classroomId: z.uuid().nullable().optional(),
  /** Another branch (general admin only). */
  daycareId: z.uuid().optional(),
});
export type MoveChildInput = z.infer<typeof MoveChildSchema>;
