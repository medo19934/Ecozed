import { z } from 'zod';

export const ClassroomSchema = z
  .object({
    name: z.string().trim().min(1).max(80),
    capacity: z.number().int().min(1).max(200),
    minAgeMonths: z.number().int().min(0).max(144).nullable().optional(),
    maxAgeMonths: z.number().int().min(0).max(144).nullable().optional(),
    color: z
      .string()
      .regex(/^#[0-9a-fA-F]{6}$/)
      .nullable()
      .optional(),
    teacherIds: z.array(z.uuid()).max(10).default([]),
  })
  .refine(
    (v) => v.minAgeMonths == null || v.maxAgeMonths == null || v.minAgeMonths <= v.maxAgeMonths,
    {
      message: 'age_range_invalid',
      path: ['maxAgeMonths'],
    },
  );
export type ClassroomInput = z.infer<typeof ClassroomSchema>;
