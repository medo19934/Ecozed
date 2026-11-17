import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import type {
  ChildDetail,
  ChildInput,
  ChildListItem,
  ChildListQuery,
  Paginated,
} from '@latif/shared';
import { paginate } from '@latif/shared';
import type { AuthContext } from '../../common/decorators/auth.decorators';
import { isBranchAdmin, pageArgs } from '../../common/utils/scope';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { sniffImage } from '../branches/branches.service';
import { ClassesService } from '../classes/classes.service';
import { IMAGE_MIME, StorageService, type UploadedBlob } from '../storage/storage.service';
import { GuardianLinkService } from './guardian-link.service';

const include = {
  classroom: { select: { id: true, name: true } },
  guardians: { orderBy: [{ isPrimary: 'desc' as const }, { createdAt: 'asc' as const }] },
} satisfies Prisma.ChildInclude;
type Row = Prisma.ChildGetPayload<{ include: typeof include }>;

@Injectable()
export class ChildrenService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly classes: ClassesService,
    private readonly links: GuardianLinkService,
    private readonly storage: StorageService,
    private readonly audit: AuditService,
  ) {}

  /** Teachers only see children of their classes; branch admins see all. */
  private async visibility(auth: AuthContext): Promise<Prisma.ChildWhereInput> {
    if (isBranchAdmin(auth)) return {};
    if (auth.role !== 'STAFF') throw new ForbiddenException();
    return { classroomId: { in: await this.classes.teacherClassIds(auth) } };
  }

  async list(auth: AuthContext, q: ChildListQuery): Promise<Paginated<ChildListItem>> {
    const where: Prisma.ChildWhereInput = {
      AND: [
        await this.visibility(auth),
        { status: q.status },
        q.classroomId ? { classroomId: q.classroomId } : {},
        q.gender ? { gender: q.gender } : {},
        q.search
          ? {
              OR: [
                { fullName: { contains: q.search, mode: 'insensitive' } },
                { guardians: { some: { fullName: { contains: q.search, mode: 'insensitive' } } } },
                { guardians: { some: { phone: { contains: q.search } } } },
              ],
            }
          : {},
      ],
    };
    const [rows, total] = await Promise.all([
      this.prisma.scoped.child.findMany({
        where,
        include,
        orderBy: { fullName: 'asc' },
        ...pageArgs(q.page, q.pageSize),
      }),
      this.prisma.scoped.child.count({ where }),
    ]);
    return paginate(rows.map(toListItem), total, q.page, q.pageSize);
  }

  private async load(auth: AuthContext, id: string): Promise<Row> {
    const c = await this.prisma.scoped.child.findFirst({
      where: { AND: [{ id }, await this.visibility(auth)] },
      include,
    });
    if (!c) throw new NotFoundException();
    return c;
  }

  async get(auth: AuthContext, id: string): Promise<ChildDetail> {
    return toDetail(await this.load(auth, id));
  }

  async create(input: ChildInput): Promise<ChildDetail> {
    await this.classes.assertClass(input.classroomId);
    const child = await this.prisma.scoped.child.create({
      data: {
        fullName: input.fullName,
        gender: input.gender,
        birthDate: new Date(input.birthDate),
        classroomId: input.classroomId ?? null,
        allergies: input.allergies ?? null,
        medicalNotes: input.medicalNotes ?? null,
        pickupPeople: input.pickupPeople,
      } as never,
    });
    await this.saveGuardians(child.id, input.guardians);
    await this.audit.log({ action: 'child.create', entity: 'Child', entityId: child.id });
    return toDetail(await this.loadAny(child.id));
  }

  async update(auth: AuthContext, id: string, input: ChildInput): Promise<ChildDetail> {
    await this.load(auth, id);
    await this.classes.assertClass(input.classroomId);
    await this.prisma.scoped.child.update({
      where: { id },
      data: {
        fullName: input.fullName,
        gender: input.gender,
        birthDate: new Date(input.birthDate),
        classroomId: input.classroomId ?? null,
        allergies: input.allergies ?? null,
        medicalNotes: input.medicalNotes ?? null,
        pickupPeople: input.pickupPeople,
      },
    });
    await this.saveGuardians(id, input.guardians);
    await this.audit.log({ action: 'child.update', entity: 'Child', entityId: id });
    return toDetail(await this.loadAny(id));
  }

  async setArchived(auth: AuthContext, id: string, archived: boolean): Promise<ChildDetail> {
    await this.load(auth, id);
    await this.prisma.scoped.child.update({
      where: { id },
      data: { status: archived ? 'ARCHIVED' : 'ACTIVE' },
    });
    await this.audit.log({
      action: archived ? 'child.archive' : 'child.restore',
      entity: 'Child',
      entityId: id,
    });
    return toDetail(await this.loadAny(id));
  }

  async setPhoto(
    auth: AuthContext,
    id: string,
    file: UploadedBlob | undefined,
  ): Promise<ChildDetail> {
    const c = await this.load(auth, id);
    const key = await this.storage.save(
      `branches/${c.daycareId}/children/${id}/photo`,
      file,
      IMAGE_MIME,
    );
    await this.prisma.scoped.child.update({ where: { id }, data: { photoKey: key } });
    if (c.photoKey) await this.storage.remove(c.photoKey);
    return toDetail(await this.loadAny(id));
  }

  async photo(auth: AuthContext, id: string) {
    const c = await this.load(auth, id);
    if (!c.photoKey) throw new NotFoundException();
    const buffer = await this.storage.read(c.photoKey);
    return { buffer, mime: sniffImage(buffer) };
  }

  private async loadAny(id: string): Promise<Row> {
    return this.prisma.scoped.child.findFirstOrThrow({ where: { id }, include });
  }

  /** Upserts guardians by id, removes missing ones, then links parent accounts. */
  private async saveGuardians(childId: string, guardians: ChildInput['guardians']): Promise<void> {
    const existing = await this.prisma.scoped.childGuardian.findMany({ where: { childId } });
    const keep = new Set(guardians.map((g) => g.id).filter(Boolean));
    const removed = existing.filter((g) => !keep.has(g.id)).map((g) => g.id);
    if (removed.length)
      await this.prisma.scoped.childGuardian.deleteMany({ where: { id: { in: removed } } });
    const hasPrimary = guardians.some((g) => g.isPrimary);
    for (const [i, g] of guardians.entries()) {
      const data = {
        fullName: g.fullName,
        relationship: g.relationship,
        phone: g.phone ?? null,
        email: g.email ?? null,
        isPrimary: hasPrimary ? g.isPrimary : i === 0,
      };
      if (g.id && existing.some((e) => e.id === g.id)) {
        await this.prisma.scoped.childGuardian.update({ where: { id: g.id }, data });
      } else {
        await this.prisma.scoped.childGuardian.create({ data: { ...data, childId } as never });
      }
    }
    await this.links.linkChildGuardians(childId);
  }
}

const toListItem = (c: Row): ChildListItem => {
  const primary = c.guardians[0];
  return {
    id: c.id,
    fullName: c.fullName,
    gender: c.gender,
    birthDate: c.birthDate.toISOString().slice(0, 10),
    hasPhoto: Boolean(c.photoKey),
    status: c.status,
    isTest: c.isTest,
    classroom: c.classroom,
    primaryGuardian: primary
      ? { fullName: primary.fullName, relationship: primary.relationship, phone: primary.phone }
      : null,
  };
};

const toDetail = (c: Row): ChildDetail => ({
  ...toListItem(c),
  allergies: c.allergies,
  medicalNotes: c.medicalNotes,
  pickupPeople: (c.pickupPeople as ChildDetail['pickupPeople']) ?? [],
  guardians: c.guardians.map((g) => ({
    id: g.id,
    fullName: g.fullName,
    relationship: g.relationship,
    phone: g.phone,
    email: g.email,
    isPrimary: g.isPrimary,
    linked: Boolean(g.userId),
  })),
  createdAt: c.createdAt.toISOString(),
});
