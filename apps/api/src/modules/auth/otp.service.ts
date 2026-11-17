import { Injectable } from '@nestjs/common';
import { OTP, type OtpPurpose } from '@latif/shared';
import { AppConfig } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { generateOtpCode, hmac, safeEqualHex } from './crypto.util';

@Injectable()
export class OtpService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {}

  private hash(identifier: string, code: string): string {
    return hmac(this.config.get('OTP_SECRET'), `${identifier}:${code}`);
  }

  /** Issues a fresh code, invalidating previous unconsumed ones. Returns the plain code. */
  async issue(identifier: string, purpose: OtpPurpose): Promise<string> {
    const code = generateOtpCode();
    const now = new Date();
    await this.prisma.raw.$transaction([
      this.prisma.raw.otpCode.updateMany({
        where: { identifier, purpose, consumedAt: null },
        data: { consumedAt: now },
      }),
      this.prisma.raw.otpCode.create({
        data: {
          identifier,
          purpose,
          codeHash: this.hash(identifier, code),
          expiresAt: new Date(now.getTime() + OTP.TTL_SECONDS * 1000),
        },
      }),
    ]);
    return code;
  }

  /** Verifies and consumes a code. Counts failed attempts. */
  async verify(identifier: string, purpose: OtpPurpose, code: string): Promise<boolean> {
    const otp = await this.prisma.raw.otpCode.findFirst({
      where: { identifier, purpose, consumedAt: null, expiresAt: { gt: new Date() } },
      orderBy: { createdAt: 'desc' },
    });
    if (!otp || otp.attempts >= OTP.MAX_ATTEMPTS) return false;
    if (!safeEqualHex(otp.codeHash, this.hash(identifier, code))) {
      await this.prisma.raw.otpCode.update({
        where: { id: otp.id },
        data: { attempts: { increment: 1 } },
      });
      return false;
    }
    const res = await this.prisma.raw.otpCode.updateMany({
      where: { id: otp.id, consumedAt: null },
      data: { consumedAt: new Date() },
    });
    return res.count === 1;
  }
}
