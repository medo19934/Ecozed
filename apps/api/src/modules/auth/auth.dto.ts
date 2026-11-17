import { createZodDto } from 'nestjs-zod';
import {
  ForgotPasswordSchema,
  LoginSchema,
  RefreshTokenSchema,
  RegisterSchema,
  RequestOtpSchema,
  ResetPasswordSchema,
  SwitchDaycareSchema,
  VerifyOtpSchema,
} from '@latif/shared';

export class RegisterDto extends createZodDto(RegisterSchema) {}
export class LoginDto extends createZodDto(LoginSchema) {}
export class RequestOtpDto extends createZodDto(RequestOtpSchema) {}
export class VerifyOtpDto extends createZodDto(VerifyOtpSchema) {}
export class ForgotPasswordDto extends createZodDto(ForgotPasswordSchema) {}
export class ResetPasswordDto extends createZodDto(ResetPasswordSchema) {}
export class RefreshTokenDto extends createZodDto(RefreshTokenSchema) {}
export class SwitchDaycareDto extends createZodDto(SwitchDaycareSchema) {}
