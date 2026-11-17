import { createZodDto } from 'nestjs-zod';
import {
  DevLoginSchema,
  GoogleAuthSchema,
  ChangePasswordSchema,
  IdentifierLoginSchema,
  RegisterSchema,
  RefreshTokenSchema,
  SwitchDaycareSchema,
} from '@latif/shared';

export class GoogleAuthDto extends createZodDto(GoogleAuthSchema) {}
export class DevLoginDto extends createZodDto(DevLoginSchema) {}
export class RefreshTokenDto extends createZodDto(RefreshTokenSchema) {}
export class SwitchDaycareDto extends createZodDto(SwitchDaycareSchema) {}
export class IdentifierLoginDto extends createZodDto(IdentifierLoginSchema) {}
export class RegisterDto extends createZodDto(RegisterSchema) {}
export class ChangePasswordDto extends createZodDto(ChangePasswordSchema) {}
