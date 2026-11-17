import { Injectable, NotFoundException } from '@nestjs/common';
import type { ParentChildDto } from '@latif/shared';
import { PrismaService } from '../../prisma/prisma.service';
import { sniffImage } from '../branches/branches.service';
import { StorageService } from '../storage/storage.service';

/**
 * Parent view: only children where the parent is a linked guardian.
 * Crosses branches (a parent may have children in two branches) → raw client
 * with an explicit userId filter, enforced here on the data side.
 */
@Injectable()
export class ParentService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
  ) {}

  private where(userId: string) {
    return {
      deletedAt: null,
      status: 'ACTIVE' as const,
      guardians: { some: { userId } },
      daycare: { deletedAt: null },
    };
  }

  async children(userId: string): Promise<ParentChildDto[]> {
    const rows = await this.prisma.raw.child.findMany({
      where: this.where(userId),
      include: {
        classroom: { select: { id: true, name: true, deletedAt: true } },
        daycare: { select: { id: true, name: true, nameEn: true } },
      },
      orderBy: { birthDate: 'desc' },
    });
    return rows.map((c) => ({
      id: c.id,
      fullName: c.fullName,
      gender: c.gender,
      birthDate: c.birthDate.toISOString().slice(0, 10),
      hasPhoto: Boolean(c.photoKey),
      branch: c.daycare,
      classroom:
        c.classroom && !c.classroom.deletedAt
          ? { id: c.classroom.id, name: c.classroom.name }
          : null,
    }));
  }

  async photo(userId: string, childId: string) {
    const c = await this.prisma.raw.child.findFirst({
      where: { id: childId, ...this.where(userId) },
    });
    if (!c?.photoKey) throw new NotFoundException();
    const buffer = await this.storage.read(c.photoKey);
    return { buffer, mime: sniffImage(buffer) };
  }
}
