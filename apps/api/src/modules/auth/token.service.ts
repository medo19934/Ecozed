import { randomUUID } from 'node:crypto';
import { Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { AuthTokens, JwtAccessPayload, Role } from '@latif/shared';
import { AppConfig } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { hmac, randomToken } from './crypto.util';

export interface IssueInput {
  userId: string;
  daycareId: string | null;
  role: Role | null;
  isSuperAdmin: boolean;
  familyId?: string;
}

const parseTtlSeconds = (ttl: string): number => {
  const m = /^(\d+)([smhd])?$/.exec(ttl);
  if (!m) return 900;
  const n = Number(m[1]);
  const unit = { s: 1, m: 60, h: 3600, d: 86400 }[(m[2] ?? 's') as 's' | 'm' | 'h' | 'd'];
  return n * unit;
};

@Injectable()
export class TokenService {
  constructor(
    private readonly jwt: JwtService,
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
  ) {}

  private hashRefresh(token: string): string {
    return hmac(this.config.get('JWT_REFRESH_SECRET'), token);
  }

  async issue(
    input: IssueInput,
    meta: { ip?: string; userAgent?: string } = {},
  ): Promise<AuthTokens> {
    const expiresIn = parseTtlSeconds(this.config.get('JWT_ACCESS_TTL'));
    const payload: JwtAccessPayload = {
      sub: input.userId,
      daycareId: input.daycareId,
      role: input.role,
      ...(input.isSuperAdmin ? { sa: true } : {}),
    };
    const accessToken = await this.jwt.signAsync(payload, { expiresIn });
    const refreshToken = randomToken();
    await this.prisma.raw.refreshToken.create({
      data: {
        userId: input.userId,
        daycareId: input.daycareId,
        tokenHash: this.hashRefresh(refreshToken),
        familyId: input.familyId ?? randomUUID(),
        expiresAt: new Date(Date.now() + this.config.get('JWT_REFRESH_TTL_DAYS') * 86400_000),
        ip: meta.ip,
        userAgent: meta.userAgent,
      },
    });
    return { accessToken, refreshToken, expiresIn };
  }

  /**
   * Validates + revokes a refresh token (rotation). Reuse of a revoked token
   * revokes the whole family (token theft detection).
   */
  async consume(refreshToken: string) {
    const record = await this.prisma.raw.refreshToken.findUnique({
      where: { tokenHash: this.hashRefresh(refreshToken) },
    });
    if (!record) throw new UnauthorizedException('Invalid refresh token');
    if (record.revokedAt) {
      await this.revokeFamily(record.familyId);
      throw new UnauthorizedException('Refresh token reused');
    }
    if (record.expiresAt <= new Date()) throw new UnauthorizedException('Refresh token expired');
    const res = await this.prisma.raw.refreshToken.updateMany({
      where: { id: record.id, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    if (res.count !== 1) {
      await this.revokeFamily(record.familyId);
      throw new UnauthorizedException('Refresh token reused');
    }
    return record;
  }

  async revoke(refreshToken: string): Promise<void> {
    await this.prisma.raw.refreshToken.updateMany({
      where: { tokenHash: this.hashRefresh(refreshToken), revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeFamily(familyId: string): Promise<void> {
    await this.prisma.raw.refreshToken.updateMany({
      where: { familyId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  async revokeAllForUser(userId: string): Promise<void> {
    await this.prisma.raw.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }
}
