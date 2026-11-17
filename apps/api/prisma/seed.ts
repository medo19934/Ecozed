/**
 * Minimal Phase 1 seed: one demo daycare with an owner, manager, teacher and parent.
 * Phase 2 extends this to the full demo (88 children, 25 staff, 12 classes).
 * Idempotent: safe to re-run.
 */
import { config } from 'dotenv';
import bcrypt from 'bcryptjs';
import { PrismaPg } from '@prisma/adapter-pg';
import { ALL_STAFF_PERMISSIONS, StaffPermission } from '@latif/shared';
import { PrismaClient, type Role, type StaffType } from '../src/generated/prisma/client';
import { DEFAULT_FEATURES } from '../src/modules/auth/auth.service';

config({ path: ['.env', '../../.env'] });

export const DEMO_PASSWORD = 'Password123!';
export const DEMO_SLUG = 'latif-demo';

async function main(): Promise<void> {
  const prisma = new PrismaClient({
    adapter: new PrismaPg({ connectionString: process.env['DATABASE_URL']! }),
  });
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);

  const daycare = await prisma.daycare.upsert({
    where: { slug: DEMO_SLUG },
    update: {},
    create: {
      name: 'حضانة لطيف التجريبية',
      slug: DEMO_SLUG,
      phone: '+966500000000',
      email: 'hello@latifkids.test',
      city: 'Riyadh',
      address: 'King Fahd Rd',
      latitude: 24.7136,
      longitude: 46.6753,
    },
  });
  for (const [key, enabled] of Object.entries(DEFAULT_FEATURES)) {
    await prisma.daycareFeature.upsert({
      where: { daycareId_key: { daycareId: daycare.id, key } },
      update: {},
      create: { daycareId: daycare.id, key, enabled },
    });
  }

  const people: {
    fullName: string;
    email: string;
    phone: string;
    role: Role;
    staffType?: StaffType;
    permissions: string[];
    superAdmin?: boolean;
  }[] = [
    {
      fullName: 'Platform Admin',
      email: 'admin@latifkids.test',
      phone: '+966500000009',
      role: 'OWNER',
      permissions: [],
      superAdmin: true,
    },
    {
      fullName: 'نورة المالكة',
      email: 'owner@latifkids.test',
      phone: '+966500000001',
      role: 'OWNER',
      permissions: [...ALL_STAFF_PERMISSIONS],
    },
    {
      fullName: 'Mariam Manager',
      email: 'manager@latifkids.test',
      phone: '+966500000002',
      role: 'MANAGER',
      permissions: [],
    },
    {
      fullName: 'Huda Teacher',
      email: 'teacher@latifkids.test',
      phone: '+966500000003',
      role: 'STAFF',
      staffType: 'TEACHER',
      permissions: [StaffPermission.CAN_VIEW_MESSAGES, StaffPermission.CAN_MANAGE_ATTENDANCE],
    },
    {
      fullName: 'Ahmad Parent',
      email: 'parent@latifkids.test',
      phone: '+966500000004',
      role: 'PARENT',
      permissions: [],
    },
  ];

  for (const p of people) {
    const user = await prisma.user.upsert({
      where: { email: p.email },
      update: {},
      create: {
        fullName: p.fullName,
        email: p.email,
        phone: p.phone,
        passwordHash,
        isSuperAdmin: p.superAdmin ?? false,
        lastDaycareId: daycare.id,
      },
    });
    if (p.superAdmin) continue;
    await prisma.membership.upsert({
      where: { userId_daycareId: { userId: user.id, daycareId: daycare.id } },
      update: {},
      create: {
        userId: user.id,
        daycareId: daycare.id,
        role: p.role,
        staffType: p.staffType,
        permissions: p.permissions,
      },
    });
  }

  console.log(
    `Seeded daycare "${daycare.slug}". Login with any *@latifkids.test / ${DEMO_PASSWORD}`,
  );
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
