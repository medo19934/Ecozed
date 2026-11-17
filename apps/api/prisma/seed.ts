/**
 * Seeds the organisation's branches and their default feature toggles.
 * No demo people/children (test data comes from the admin-only TEST button).
 * Super admins are granted on Google sign-in via SUPER_ADMIN_EMAILS.
 * Idempotent: safe to re-run.
 */
import { config } from 'dotenv';
import { PrismaPg } from '@prisma/adapter-pg';
import { BRANCHES } from '@latif/shared';
import { PrismaClient } from '../src/generated/prisma/client';
import { DEFAULT_FEATURES } from '../src/modules/auth/auth.service';

config({ path: ['.env', '../../.env'] });

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL']! }),
  });

  for (const b of BRANCHES) {
    const branch = await prisma.daycare.upsert({
      where: { slug: b.slug },
      update: {},
      create: { slug: b.slug, name: b.nameAr, nameEn: b.nameEn, city: 'Riyadh' },
    });
    for (const [key, enabled] of Object.entries(DEFAULT_FEATURES)) {
      await prisma.daycareFeature.upsert({
        where: { daycareId_key: { daycareId: branch.id, key } },
        update: {},
        create: { daycareId: branch.id, key, enabled },
      });
    }
  }

  console.log(
    `Seeded ${BRANCHES.length} branches. Super admins: ${process.env['SUPER_ADMIN_EMAILS'] || '(set SUPER_ADMIN_EMAILS)'}`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
