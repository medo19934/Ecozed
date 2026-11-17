import { Injectable, NotFoundException } from '@nestjs/common';
import type { DocumentDto } from '@latif/shared';
import { decodeFileName } from '../../common/utils/files';
import { RequestContext } from '../../common/context/request-context';
import type { DocumentOwner } from '../../generated/prisma/client';
import { requireTenantId } from '../../prisma/tenancy';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { DOCUMENT_MIME, StorageService, type UploadedBlob } from '../storage/storage.service';

/** Private files owned by a branch, staff member or child. Delete = bin (restorable). */
@Injectable()
export class DocumentsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  async list(ownerType: DocumentOwner, ownerId: string, deleted: boolean): Promise<DocumentDto[]> {
    const rows = await this.prisma.scoped.document.findMany({
      where: { ownerType, ownerId, deletedAt: deleted ? { not: null } : null },
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toDto);
  }

  async upload(
    ownerType: DocumentOwner,
    ownerId: string,
    file: UploadedBlob | undefined,
    category?: string,
  ): Promise<DocumentDto> {
    const daycareId = requireTenantId();
    const key = await this.storage.save(
      `branches/${daycareId}/${ownerType.toLowerCase()}/${ownerId}`,
      file,
      DOCUMENT_MIME,
    );
    const doc = await this.prisma.scoped.document.create({
      data: {
        ownerType,
        ownerId,
        name: decodeFileName(file!.originalname).slice(0, 200),
        category: category?.slice(0, 60) || null,
        storageKey: key,
        mimeType: file!.mimetype,
        size: file!.size,
        uploadedById: RequestContext.get()?.userId ?? null,
      } as never,
    });
    await this.audit.log({
      action: 'document.upload',
      entity: 'Document',
      entityId: doc.id,
      metadata: { ownerType, ownerId },
    });
    return toDto(doc);
  }

  private async find(ownerType: DocumentOwner, ownerId: string, id: string, deleted?: boolean) {
    const doc = await this.prisma.scoped.document.findFirst({
      // `deletedAt: undefined` opts out of the automatic soft-delete filter; checked below.
      where: { id, ownerType, ownerId, deletedAt: undefined },
    });
    if (!doc || (deleted !== undefined && Boolean(doc.deletedAt) !== deleted))
      throw new NotFoundException();
    return doc;
  }

  async download(ownerType: DocumentOwner, ownerId: string, id: string) {
    const doc = await this.find(ownerType, ownerId, id, false);
    return { doc, buffer: await this.storage.read(doc.storageKey) };
  }

  async softDelete(ownerType: DocumentOwner, ownerId: string, id: string): Promise<{ ok: true }> {
    await this.find(ownerType, ownerId, id, false);
    await this.prisma.scoped.document.delete({ where: { id } });
    await this.audit.log({ action: 'document.delete', entity: 'Document', entityId: id });
    return { ok: true };
  }

  async restore(ownerType: DocumentOwner, ownerId: string, id: string): Promise<DocumentDto> {
    await this.find(ownerType, ownerId, id, true);
    const doc = await this.prisma.scoped.document.update({
      where: { id },
      data: { deletedAt: null },
    });
    await this.audit.log({ action: 'document.restore', entity: 'Document', entityId: id });
    return toDto(doc);
  }
}

const toDto = (d: {
  id: string;
  name: string;
  category: string | null;
  mimeType: string;
  size: number;
  createdAt: Date;
  deletedAt: Date | null;
}): DocumentDto => ({
  id: d.id,
  name: d.name,
  category: d.category,
  mimeType: d.mimeType,
  size: d.size,
  createdAt: d.createdAt.toISOString(),
  deletedAt: d.deletedAt?.toISOString() ?? null,
});
