import { z } from 'zod';
import { RecordStatusSchema, StaffPermissionSchema, StaffTypeSchema } from '../enums';
import { EmailSchema, PaginationQuerySchema, PhoneSchema } from './common';

export const StaffRoleSchema = z.enum(['MANAGER', 'STAFF']);

const staffFields = {
  fullName: z.string().trim().min(2).max(120),
  phone: z
    .union([PhoneSchema, z.literal('').transform(() => null)])
    .nullable()
    .optional(),
  role: StaffRoleSchema.default('STAFF'),
  staffType: StaffTypeSchema.default('TEACHER'),
  specialties: z.array(z.string().trim().min(1).max(60)).max(15).default([]),
  qualification: z.string().trim().max(500).nullable().optional(),
  address: z.string().trim().max(300).nullable().optional(),
  joinDate: z.iso.date().nullable().optional(),
  classIds: z.array(z.uuid()).max(20).default([]),
  permissions: z.array(StaffPermissionSchema).default([]),
};

/** Admin creates a staff member by email; they sign in with that Google account. */
export const CreateStaffSchema = z.object({ email: EmailSchema, ...staffFields });
export type CreateStaffInput = z.infer<typeof CreateStaffSchema>;

/**
 * Partial update: no defaults, so a field left out (e.g. classIds when only permissions are
 * toggled) is untouched instead of being reset to its default.
 */
export const UpdateStaffSchema = z
  .object({
    fullName: staffFields.fullName,
    phone: staffFields.phone,
    role: StaffRoleSchema,
    staffType: StaffTypeSchema,
    specialties: z.array(z.string().trim().min(1).max(60)).max(15),
    qualification: staffFields.qualification,
    address: staffFields.address,
    joinDate: staffFields.joinDate,
    classIds: z.array(z.uuid()).max(20),
    permissions: z.array(StaffPermissionSchema),
  })
  .partial();
export type UpdateStaffInput = z.infer<typeof UpdateStaffSchema>;

export const StaffListQuerySchema = PaginationQuerySchema.extend({
  status: RecordStatusSchema.optional(),
  role: StaffRoleSchema.optional(),
});
export type StaffListQuery = z.infer<typeof StaffListQuerySchema>;

export const DocumentListQuerySchema = z.object({
  deleted: z
    .enum(['true', 'false'])
    .default('false')
    .transform((v) => v === 'true'),
});
