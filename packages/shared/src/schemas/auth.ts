import { z } from 'zod';
import { LOCALES } from '../constants';
import { EmailSchema, PhoneSchema, normalizePhone } from './common';

export const LocaleSchema = z.enum(LOCALES);

/** Sign up or sign in with a Google ID token (web GIS button or mobile Google sign-in). */
export const GoogleAuthSchema = z.object({
  idToken: z.string().min(20),
  locale: LocaleSchema.optional(),
});
export type GoogleAuthInput = z.infer<typeof GoogleAuthSchema>;

/** Local development only (AUTH_DEV_LOGIN=true, never in production). */
export const DevLoginSchema = z.object({ email: EmailSchema });
export type DevLoginInput = z.infer<typeof DevLoginSchema>;

export const RefreshTokenSchema = z.object({ refreshToken: z.string().min(10) });
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;

export const SwitchDaycareSchema = z.object({ daycareId: z.uuid() });
export type SwitchDaycareInput = z.infer<typeof SwitchDaycareSchema>;

/** Sign in with an email or a phone number (public demo mode: no password, no code). */
export const IdentifierLoginSchema = z.object({
  identifier: z
    .string()
    .trim()
    .min(3)
    .max(120)
    .transform((v) => (v.includes('@') ? v.toLowerCase() : normalizePhone(v)))
    .pipe(z.union([EmailSchema, PhoneSchema])),
  locale: LocaleSchema.optional(),
});
export type IdentifierLoginInput = z.infer<typeof IdentifierLoginSchema>;
