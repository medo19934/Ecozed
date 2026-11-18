import type { FeatureToggle } from '@latif/shared';
import type { PrismaService } from '../../prisma/prisma.service';

/** Branches where a (default-on) module is switched off — used to hide its data across branches. */
export async function branchesWithModuleOff(
  prisma: PrismaService,
  key: FeatureToggle,
): Promise<string[]> {
  const rows = await prisma.raw.daycareFeature.findMany({
    where: { key, enabled: false },
    select: { daycareId: true },
  });
  return rows.map((r) => r.daycareId);
}
