import { Global, Injectable, Module } from '@nestjs/common';
import type { IssuedPassword } from '@latif/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { hashPassword, tempPassword } from './password';

/** Admin-issued one-time passwords (new logins and resets). Shown once, stored only as a hash. */
@Injectable()
export class CredentialsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AuditService,
  ) {}

  async issue(userId: string): Promise<IssuedPassword> {
    const password = tempPassword();
    const user = await this.prisma.raw.user.update({
      where: { id: userId },
      data: { passwordHash: await hashPassword(password), mustChangePassword: true },
    });
    // Signs the user out everywhere.
    await this.prisma.raw.refreshToken.updateMany({
      where: { userId, revokedAt: null },
      data: { revokedAt: new Date() },
    });
    await this.audit.log({ action: 'auth.password_issued', entity: 'User', entityId: userId });
    return {
      identifier: user.email ?? user.phone ?? '',
      fullName: user.fullName,
      tempPassword: password,
    };
  }
}

@Global()
@Module({ providers: [CredentialsService], exports: [CredentialsService] })
export class CredentialsModule {}
