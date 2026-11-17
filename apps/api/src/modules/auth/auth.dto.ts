import { createZodDto } from 'nestjs-zod';
import {
  DevLoginSchema,
  GoogleAuthSchema,
  IdentifierLoginSchema,
  RefreshTokenSchema,
  SwitchDaycareSchema,
} from '@latif/shared';

export class GoogleAuthDto extends createZodDto(GoogleAuthSchema) {}
export class DevLoginDto extends createZodDto(DevLoginSchema) {}
export class RefreshTokenDto extends createZodDto(RefreshTokenSchema) {}
export class SwitchDaycareDto extends createZodDto(SwitchDaycareSchema) {}
export class IdentifierLoginDto extends createZodDto(IdentifierLoginSchema) {}
