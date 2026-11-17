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

/** An email address or a phone number (local 05… accepted). */
export const IdentifierSchema = z
  .string()
  .trim()
  .min(3)
  .max(120)
  .transform((v) => (v.includes('@') ? v.toLowerCase() : normalizePhone(v)))
  .pipe(z.union([EmailSchema, PhoneSchema]));

export const PasswordSchema = z.string().min(8, 'password_too_short').max(100);

/** Sign in with email or phone + password (the password is optional only in PUBLIC_DEMO mode). */
export const IdentifierLoginSchema = z.object({
  identifier: IdentifierSchema,
  password: z.string().max(100).optional(),
  locale: LocaleSchema.optional(),
});

/** Parent self sign-up. */
export const RegisterSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  identifier: IdentifierSchema,
  password: PasswordSchema,
  locale: LocaleSchema.optional(),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

export const ChangePasswordSchema = z.object({
  currentPassword: z.string().max(100).optional(),
  newPassword: PasswordSchema,
});
export type ChangePasswordInput = z.infer<typeof ChangePasswordSchema>;
export type IdentifierLoginInput = z.infer<typeof IdentifierLoginSchema>;
