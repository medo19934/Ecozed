import { z } from 'zod';
import { FeatureToggleSchema } from '../enums';
import { PhoneSchema } from './common';

const optionalText = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .transform((v) => (v === '' ? null : v))
    .nullable()
    .optional();

export const UpdateBranchSchema = z
  .object({
    name: z.string().trim().min(2).max(120),
    nameEn: optionalText(120),
    phone: z
      .union([PhoneSchema, z.literal('').transform(() => null)])
      .nullable()
      .optional(),
    email: z
      .union([z.string().trim().toLowerCase().pipe(z.email()), z.literal('').transform(() => null)])
      .nullable()
      .optional(),
    city: optionalText(80),
    address: optionalText(300),
    latitude: z.number().min(-90).max(90).nullable().optional(),
    longitude: z.number().min(-180).max(180).nullable().optional(),
    geofenceRadiusM: z.number().int().min(25).max(5000).optional(),
    useHijri: z.boolean().optional(),
  })
  .refine((v) => (v.latitude == null) === (v.longitude == null), {
    message: 'location_incomplete',
    path: ['longitude'],
  });
export type UpdateBranchInput = z.infer<typeof UpdateBranchSchema>;

export const UpdateFeaturesSchema = z.object({
  features: z.array(z.object({ key: FeatureToggleSchema, enabled: z.boolean() })).min(1),
});
export type UpdateFeaturesInput = z.infer<typeof UpdateFeaturesSchema>;
