import { Injectable, NotFoundException } from '@nestjs/common';
import type { BranchDto, UpdateBranchInput, UpdateFeaturesInput } from '@latif/shared';
import { requireTenantId } from '../../prisma/tenancy';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { IMAGE_MIME, StorageService, type UploadedBlob } from '../storage/storage.service';

@Injectable()
export class BranchesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  private async load(id: string) {
    const b = await this.prisma.scoped.daycare.findFirst({ where: { id } });
    if (!b) throw new NotFoundException();
    return b;
  }

  async current(): Promise<BranchDto> {
    const id = requireTenantId();
    const b = await this.load(id);
    const features = await this.prisma.scoped.daycareFeature.findMany();
    return {
      id: b.id,
      name: b.name,
      nameEn: b.nameEn,
      slug: b.slug,
      hasLogo: Boolean(b.logoKey),
      phone: b.phone,
      email: b.email,
      city: b.city,
      address: b.address,
      latitude: b.latitude,
      longitude: b.longitude,
      geofenceRadiusM: b.geofenceRadiusM,
      useHijri: b.useHijri,
      currency: b.currency,
      timezone: b.timezone,
      features: Object.fromEntries(features.map((f) => [f.key, f.enabled])),
      updatedAt: b.updatedAt.toISOString(),
    };
  }

  async update(input: UpdateBranchInput): Promise<BranchDto> {
    const id = requireTenantId();
    await this.prisma.scoped.daycare.update({ where: { id }, data: input });
    await this.audit.log({
      action: 'branch.update',
      entity: 'Daycare',
      entityId: id,
      metadata: { fields: Object.keys(input) },
    });
    return this.current();
  }

  async updateFeatures(input: UpdateFeaturesInput): Promise<BranchDto> {
    const daycareId = requireTenantId();
    for (const f of input.features) {
      await this.prisma.scoped.daycareFeature.upsert({
        where: { daycareId_key: { daycareId, key: f.key } },
        update: { enabled: f.enabled },
        create: { daycareId, key: f.key, enabled: f.enabled },
      });
    }
    await this.audit.log({
      action: 'branch.features',
      entity: 'Daycare',
      entityId: daycareId,
      metadata: input.features,
    });
    return this.current();
  }

  async setLogo(file: UploadedBlob | undefined): Promise<BranchDto> {
    const id = requireTenantId();
    const b = await this.load(id);
    const key = await this.storage.save(`branches/${id}/logo`, file, IMAGE_MIME);
    await this.prisma.scoped.daycare.update({ where: { id }, data: { logoKey: key } });
    if (b.logoKey) await this.storage.remove(b.logoKey);
    return this.current();
  }

  async removeLogo(): Promise<BranchDto> {
    const id = requireTenantId();
    const b = await this.load(id);
    if (b.logoKey) {
      await this.prisma.scoped.daycare.update({ where: { id }, data: { logoKey: null } });
      await this.storage.remove(b.logoKey);
    }
    return this.current();
  }

  async logo(): Promise<{ buffer: Buffer; mime: string }> {
    const b = await this.load(requireTenantId());
    if (!b.logoKey) throw new NotFoundException();
    const buffer = await this.storage.read(b.logoKey);
    return { buffer, mime: sniffImage(buffer) };
  }
}

export const sniffImage = (buf: Buffer): string => {
  if (buf[0] === 0x89 && buf[1] === 0x50) return 'image/png';
  if (buf[0] === 0xff && buf[1] === 0xd8) return 'image/jpeg';
  if (buf.subarray(8, 12).toString() === 'WEBP') return 'image/webp';
  return 'application/octet-stream';
};
