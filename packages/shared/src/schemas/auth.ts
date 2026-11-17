import { z } from 'zod';
import { LOCALES } from '../constants';
import { EmailSchema } from './common';

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
