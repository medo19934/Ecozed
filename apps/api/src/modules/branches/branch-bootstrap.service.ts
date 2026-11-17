import { Injectable, Logger, type OnApplicationBootstrap } from '@nestjs/common';
import { BRANCHES } from '@latif/shared';
import { AppConfig } from '../../config/app-config.service';
import { PrismaService } from '../../prisma/prisma.service';
import { DEFAULT_FEATURES } from '../auth/auth.service';

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
  ) {}

  async onApplicationBootstrap(): Promise<void> {
    if (this.config.get('NODE_ENV') === 'test') return;
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
