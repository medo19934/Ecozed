import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { BRANCHES } from '@latif/shared';
import { AppConfig } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { csv } from '../../config/env';
import { DEFAULT_FEATURES } from '../auth/auth.service';
import { hashPassword } from '../auth/password';
import { DemoService } from '../demo/demo.service';

/**
 * Creates the organisation's branches (Al Malqa, Al Rayan, Olaya) and their default
 * feature toggles on first start, so a fresh production database needs no seed step.
 * Idempotent; never creates demo data.
 */
@Injectable()
export class BranchBootstrapService implements OnApplicationBootstrap {
  private readonly logger = new Logger(BranchBootstrapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: AppConfig,
    private readonly demo: DemoService,
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get('NODE_ENV') === 'test') return;
    await this.ensureBranches();
    await this.ensureSuperAdmins();
    if (this.config.get('PUBLIC_DEMO')) await this.demo.seed();
  }

  /** Creates the general admin accounts (SUPER_ADMIN_EMAILS) with SUPER_ADMIN_PASSWORD. */
  async ensureSuperAdmins(): Promise<void> {
    const password = this.config.get('SUPER_ADMIN_PASSWORD');
    if (!password) return;
    for (const email of csv(this.config.get('SUPER_ADMIN_EMAILS')).map((e) => e.toLowerCase())) {
      const user = await this.prisma.raw.user.findFirst({ where: { email } });
      if (user?.passwordHash) continue;
      const data = {
        isSuperAdmin: true,
        passwordHash: await hashPassword(password),
        mustChangePassword: true,
      };
      if (user) await this.prisma.raw.user.update({ where: { id: user.id }, data });
      else
        await this.prisma.raw.user.create({ data: { ...data, email, fullName: 'الإدارة العامة' } });
      this.logger.log(`Super admin ready: ${email}`);
    }
  }

  async ensureBranches(): Promise<void> {
    if (await this.prisma.raw.daycare.count()) return;
    for (const b of BRANCHES) {
      const branch = await this.prisma.raw.daycare.create({
        data: { slug: b.slug, name: b.nameAr, nameEn: b.nameEn, city: 'Riyadh' },
      });
      await this.prisma.raw.daycareFeature.createMany({
        data: Object.entries(DEFAULT_FEATURES).map(([key, enabled]) => ({
          daycareId: branch.id,
          key,
          enabled,
        })),
      });
    }
    this.logger.log(`Created ${BRANCHES.length} branches`);
  }
}
