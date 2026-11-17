import { z } from 'zod';
import { OTP, PASSWORD_MIN_LENGTH, LOCALES } from '../constants';
import { OtpPurposeSchema } from '../enums';
import { EmailSchema, PhoneSchema } from './common';

export const PasswordSchema = z.string().min(PASSWORD_MIN_LENGTH, 'password_too_short').max(128);
export const LocaleSchema = z.enum(LOCALES);

/** Step 1 of onboarding: create owner account + daycare trial. */
export const RegisterSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: EmailSchema,
  phone: PhoneSchema,
  password: PasswordSchema,
  daycareName: z.string().trim().min(2).max(120),
  locale: LocaleSchema.default('ar'),
});
export type RegisterInput = z.infer<typeof RegisterSchema>;

/** Identifier is an email or an E.164 phone. */
export const IdentifierSchema = z.union([EmailSchema, PhoneSchema]);

export const LoginSchema = z.object({
  identifier: IdentifierSchema,
  password: z.string().min(1).max(128),
});
export type LoginInput = z.infer<typeof LoginSchema>;

export const OtpCodeSchema = z.string().regex(new RegExp(`^\\d{${OTP.LENGTH}}$`), 'invalid_code');

export const RequestOtpSchema = z.object({
  identifier: IdentifierSchema,
  purpose: OtpPurposeSchema.default('LOGIN'),
});
export type RequestOtpInput = z.infer<typeof RequestOtpSchema>;

export const VerifyOtpSchema = z.object({
  identifier: IdentifierSchema,
  code: OtpCodeSchema,
});
export type VerifyOtpInput = z.infer<typeof VerifyOtpSchema>;

export const ForgotPasswordSchema = z.object({ identifier: IdentifierSchema });
export type ForgotPasswordInput = z.infer<typeof ForgotPasswordSchema>;

export const ResetPasswordSchema = z.object({
  identifier: IdentifierSchema,
  code: OtpCodeSchema,
  password: PasswordSchema,
});
export type ResetPasswordInput = z.infer<typeof ResetPasswordSchema>;

export const RefreshTokenSchema = z.object({ refreshToken: z.string().min(10) });
export type RefreshTokenInput = z.infer<typeof RefreshTokenSchema>;

export const SwitchDaycareSchema = z.object({ daycareId: z.uuid() });
export type SwitchDaycareInput = z.infer<typeof SwitchDaycareSchema>;
