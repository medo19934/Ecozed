import { createHmac, timingSafeEqual } from 'node:crypto';
import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import type {
  MessageContacts,
  MessageDto,
  OpenThreadInput,
  ThreadDto,
  ThreadMessages,
} from '@latif/shared';
import type { AuthContext } from '../../common/decorators/auth.decorators';
import type { MessageThread, Prisma } from '../../generated/prisma/client';
import { AppConfig } from '../../config/app-config.service';
import { branchesWithModuleOff } from '../../common/utils/modules';
import { PrismaService } from '../../prisma/prisma.service';
import { decodeFileName } from '../../common/utils/files';
import { MESSAGE_MIME, StorageService, type UploadedBlob } from '../storage/storage.service';

/**
 * Messaging between a branch and families (one thread per child), between staff
 * members, and branch/class announcements. Parents can have children in several
 * branches, so every query here filters explicitly and access is checked per thread:
 * - CHILD: the child's linked guardians; branch managers/admins; teachers of the child's class.
 * - STAFF: the two staff members.
 * - ANNOUNCEMENT: branch staff (post) and parents with a child in that branch/class (read).
 */
@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly storage: StorageService,
    private readonly config: AppConfig,
  ) {}

  // ---------------- signed attachment links (apps: <img>/<audio> can't send auth headers) ----------------

  private sign(body: string): string {
    return createHmac('sha256', `${this.config.get('JWT_ACCESS_SECRET')}:files`)
      .update(body)
      .digest('base64url');
  }

  /** `/messages/f/<token>` valid for 6 hours. */
  private signedPath(messageId: string): string {
    const body = Buffer.from(`${messageId}.${Math.floor(Date.now() / 1000) + 6 * 3600}`).toString(
      'base64url',
    );
    return `/messages/f/${body}.${this.sign(body)}`;
  }

  async signedAttachment(token: string) {
    const [body, sig] = token.split('.');
    const expected = body ? this.sign(body) : '';
    if (
      !body ||
      !sig ||
      sig.length !== expected.length ||
      !timingSafeEqual(Buffer.from(sig), Buffer.from(expected))
    ) {
      throw new NotFoundException();
    }
    const [messageId, exp] = Buffer.from(body, 'base64url').toString().split('.');
    if (!messageId || Number(exp) < Date.now() / 1000) throw new NotFoundException();
    const m = await this.prisma.raw.message.findFirst({ where: { id: messageId } });
    if (!m?.attachmentKey) throw new NotFoundException();
    return {
      buffer: await this.storage.read(m.attachmentKey),
      mime: m.attachmentMime!,
      name: m.attachmentName ?? 'file',
    };
  }

  // ---------------- access ----------------

  private async teacherClassIds(userId: string, daycareId: string): Promise<string[]> {
    const links = await this.prisma.raw.classTeacher.findMany({
      where: { daycareId, membership: { userId, status: 'ACTIVE', deletedAt: null } },
      select: { classroomId: true },
    });
    return links.map((l) => l.classroomId);
  }

  /** Staff role of the user in a branch (super admin counts as admin everywhere). */
  private async staffRole(
    auth: AuthContext,
    daycareId: string,
  ): Promise<'ADMIN' | 'TEACHER' | null> {
    if (auth.isSuperAdmin) return 'ADMIN';
    const m = await this.prisma.raw.membership.findFirst({
      where: {
        userId: auth.userId,
        daycareId,
        status: 'ACTIVE',
        deletedAt: null,
        role: { in: ['MANAGER', 'STAFF'] },
      },
    });
    if (!m) return null;
    return m.role === 'MANAGER' ? 'ADMIN' : 'TEACHER';
  }

  private async access(
    auth: AuthContext,
    t: MessageThread,
  ): Promise<{ read: boolean; post: boolean }> {
    const staff = await this.staffRole(auth, t.daycareId);
    if (t.kind === 'STAFF') {
      const member = t.userA === auth.userId || t.userB === auth.userId;
      return { read: member, post: member };
    }
    if (t.kind === 'ANNOUNCEMENT') {
      if (staff) return { read: true, post: true };
      const kids = await this.prisma.raw.child.count({
        where: {
          daycareId: t.daycareId,
          deletedAt: null,
          status: 'ACTIVE',
          guardians: { some: { userId: auth.userId } },
          ...(t.classroomId ? { classroomId: t.classroomId } : {}),
        },
      });
      return { read: kids > 0, post: false };
    }
    // CHILD
    if (staff === 'ADMIN') return { read: true, post: true };
    const child = await this.prisma.raw.child.findFirst({
      where: { id: t.childId!, deletedAt: null },
      include: { guardians: { select: { userId: true } } },
    });
    if (!child) return { read: false, post: false };
    if (child.guardians.some((g) => g.userId === auth.userId)) return { read: true, post: true };
    if (staff === 'TEACHER' && child.classroomId) {
      const ok = (await this.teacherClassIds(auth.userId, t.daycareId)).includes(child.classroomId);
      return { read: ok, post: ok };
    }
    return { read: false, post: false };
  }

  /** Threads the user may read. */
  /** Threads the user may see, minus branches where Messaging is switched off. */
  private async visibleWhere(auth: AuthContext): Promise<Prisma.MessageThreadWhereInput> {
    const off = await branchesWithModuleOff(this.prisma, 'messages');
    return { AND: [await this.visibleWhereAll(auth), { daycareId: { notIn: off } }] };
  }

  private async visibleWhereAll(auth: AuthContext): Promise<Prisma.MessageThreadWhereInput> {
    const memberships = await this.prisma.raw.membership.findMany({
      where: { userId: auth.userId, status: 'ACTIVE', deletedAt: null },
      select: { daycareId: true, role: true, id: true },
    });
    const adminBranches = auth.isSuperAdmin
      ? (
          await this.prisma.raw.daycare.findMany({
            where: { deletedAt: null },
            select: { id: true },
          })
        ).map((d) => d.id)
      : memberships.filter((m) => m.role === 'MANAGER').map((m) => m.daycareId);
    const teacherBranches = memberships.filter((m) => m.role === 'STAFF').map((m) => m.daycareId);
    const teacherClasses = (
      await this.prisma.raw.classTeacher.findMany({
        where: {
          membershipId: { in: memberships.filter((m) => m.role === 'STAFF').map((m) => m.id) },
        },
        select: { classroomId: true },
      })
    ).map((c) => c.classroomId);
    const kids = await this.prisma.raw.child.findMany({
      where: { deletedAt: null, status: 'ACTIVE', guardians: { some: { userId: auth.userId } } },
      select: { id: true, daycareId: true, classroomId: true },
    });
    const teacherKids = teacherClasses.length
      ? (
          await this.prisma.raw.child.findMany({
            where: { classroomId: { in: teacherClasses }, deletedAt: null },
            select: { id: true },
          })
        ).map((c) => c.id)
      : [];
    const parentBranches = [...new Set(kids.map((k) => k.daycareId))];
    const parentClasses = kids.map((k) => k.classroomId).filter((c): c is string => Boolean(c));
    return {
      OR: [
        { daycareId: { in: adminBranches } },
        { kind: 'STAFF', OR: [{ userA: auth.userId }, { userB: auth.userId }] },
        { kind: 'CHILD', childId: { in: [...kids.map((k) => k.id), ...teacherKids] } },
        { kind: 'ANNOUNCEMENT', daycareId: { in: teacherBranches } },
        {
          kind: 'ANNOUNCEMENT',
          daycareId: { in: parentBranches },
          OR: [{ classroomId: null }, { classroomId: { in: parentClasses } }],
        },
      ],
    };
  }

  // ---------------- DTOs ----------------

  private async toThreads(auth: AuthContext, rows: MessageThread[]): Promise<ThreadDto[]> {
    if (!rows.length) return [];
    const ids = rows.map((r) => r.id);
    const childIds = rows.map((r) => r.childId).filter((x): x is string => Boolean(x));
    const otherIds = rows.flatMap((r) => [r.userA, r.userB]).filter((x): x is string => Boolean(x));
    const [branches, children, users, reads, classes] = await Promise.all([
      this.prisma.raw.daycare.findMany({
        where: { id: { in: [...new Set(rows.map((r) => r.daycareId))] } },
        select: { id: true, name: true },
      }),
      this.prisma.raw.child.findMany({
        where: { id: { in: childIds } },
        select: {
          id: true,
          fullName: true,
          gender: true,
          photoKey: true,
          classroom: { select: { name: true } },
        },
      }),
      this.prisma.raw.user.findMany({
        where: { id: { in: otherIds } },
        select: { id: true, fullName: true },
      }),
      this.prisma.raw.threadRead.findMany({
        where: { threadId: { in: ids }, userId: auth.userId },
      }),
      this.prisma.raw.classroom.findMany({
        where: {
          id: { in: rows.map((r) => r.classroomId).filter((x): x is string => Boolean(x)) },
        },
        select: { id: true, name: true },
      }),
    ]);
    const map = <T extends { id: string }>(l: T[]) => new Map(l.map((x) => [x.id, x]));
    const b = map(branches);
    const c = map(children);
    const u = map(users);
    const cl = map(classes);
    const readAt = new Map(reads.map((r) => [r.threadId, r.lastReadAt]));
    const out: ThreadDto[] = [];
    for (const t of rows) {
      const [last, unread, acc] = await Promise.all([
        this.prisma.raw.message.findFirst({
          where: { threadId: t.id },
          orderBy: { createdAt: 'desc' },
        }),
        this.prisma.raw.message.count({
          where: {
            threadId: t.id,
            senderId: { not: auth.userId },
            createdAt: { gt: readAt.get(t.id) ?? new Date(0) },
          },
        }),
        this.access(auth, t),
      ]);
      const sender = last
        ? await this.prisma.raw.user.findUnique({
            where: { id: last.senderId },
            select: { fullName: true },
          })
        : null;
      const child = t.childId ? c.get(t.childId) : undefined;
      const other =
        t.kind === 'STAFF' ? u.get(t.userA === auth.userId ? t.userB! : t.userA!) : undefined;
      out.push({
        id: t.id,
        kind: t.kind,
        title:
          t.kind === 'CHILD'
            ? (child?.fullName ?? '')
            : t.kind === 'STAFF'
              ? (other?.fullName ?? '')
              : (t.title ?? ''),
        subtitle:
          t.kind === 'CHILD'
            ? (child?.classroom?.name ?? null)
            : t.kind === 'ANNOUNCEMENT'
              ? t.classroomId
                ? (cl.get(t.classroomId)?.name ?? null)
                : null
              : null,
        branch: b.get(t.daycareId) ?? { id: t.daycareId, name: '' },
        child: child
          ? {
              id: child.id,
              fullName: child.fullName,
              gender: child.gender,
              hasPhoto: Boolean(child.photoKey),
            }
          : null,
        lastMessage: last
          ? {
              body: last.body,
              hasAttachment: Boolean(last.attachmentKey),
              senderName: sender?.fullName ?? '',
              at: last.createdAt.toISOString(),
            }
          : null,
        unread,
        canPost: acc.post,
      });
    }
    return out;
  }

  // ---------------- API ----------------

  async threads(
    auth: AuthContext,
    tab: 'all' | 'staff' | 'parents',
    search?: string,
  ): Promise<ThreadDto[]> {
    const rows = await this.prisma.raw.messageThread.findMany({
      where: {
        AND: [
          await this.visibleWhere(auth),
          tab === 'staff'
            ? { kind: 'STAFF' }
            : tab === 'parents'
              ? { kind: { in: ['CHILD', 'ANNOUNCEMENT'] } }
              : {},
        ],
      },
      orderBy: { lastMessageAt: 'desc' },
      take: 100,
    });
    const dtos = await this.toThreads(auth, rows);
    const q = search?.trim().toLowerCase();
    return q
      ? dtos.filter(
          (d) => d.title.toLowerCase().includes(q) || d.branch.name.toLowerCase().includes(q),
        )
      : dtos;
  }

  async unreadTotal(auth: AuthContext): Promise<{ unread: number }> {
    const rows = await this.prisma.raw.messageThread.findMany({
      where: await this.visibleWhere(auth),
      select: { id: true },
    });
    const reads = await this.prisma.raw.threadRead.findMany({
      where: { userId: auth.userId, threadId: { in: rows.map((r) => r.id) } },
    });
    const readAt = new Map(reads.map((r) => [r.threadId, r.lastReadAt]));
    let unread = 0;
    for (const r of rows) {
      unread += await this.prisma.raw.message.count({
        where: {
          threadId: r.id,
          senderId: { not: auth.userId },
          createdAt: { gt: readAt.get(r.id) ?? new Date(0) },
        },
      });
    }
    return { unread };
  }

  async contacts(auth: AuthContext): Promise<MessageContacts> {
    const branch = auth.daycareId;
    const staffRole = branch ? await this.staffRole(auth, branch) : null;
    let children: MessageContacts['children'] = [];
    if (staffRole && branch) {
      const classIds =
        staffRole === 'TEACHER' ? await this.teacherClassIds(auth.userId, branch) : null;
      const rows = await this.prisma.raw.child.findMany({
        where: {
          daycareId: branch,
          deletedAt: null,
          status: 'ACTIVE',
          ...(classIds ? { classroomId: { in: classIds } } : {}),
        },
        include: { classroom: { select: { name: true } }, daycare: { select: { name: true } } },
        orderBy: { fullName: 'asc' },
      });
      children = rows.map((c) => ({
        id: c.id,
        fullName: c.fullName,
        classroom: c.classroom?.name ?? null,
        branch: c.daycare.name,
      }));
    } else {
      const rows = await this.prisma.raw.child.findMany({
        where: { deletedAt: null, status: 'ACTIVE', guardians: { some: { userId: auth.userId } } },
        include: { classroom: { select: { name: true } }, daycare: { select: { name: true } } },
      });
      children = rows.map((c) => ({
        id: c.id,
        fullName: c.fullName,
        classroom: c.classroom?.name ?? null,
        branch: c.daycare.name,
      }));
    }
    const staff =
      staffRole && branch
        ? (
            await this.prisma.raw.membership.findMany({
              where: {
                daycareId: branch,
                status: 'ACTIVE',
                deletedAt: null,
                role: { in: ['MANAGER', 'STAFF'] },
                userId: { not: auth.userId },
              },
              include: { user: { select: { id: true, fullName: true, avatarUrl: true } } },
              orderBy: { user: { fullName: 'asc' } },
            })
          ).map((m) => ({
            userId: m.user.id,
            fullName: m.user.fullName,
            role: m.role,
            avatarUrl: m.user.avatarUrl,
          }))
        : [];
    const classes =
      staffRole && branch
        ? await this.prisma.raw.classroom.findMany({
            where: { daycareId: branch, deletedAt: null },
            select: { id: true, name: true },
            orderBy: { name: 'asc' },
          })
        : [];
    return { children, staff, classes, canAnnounce: Boolean(staffRole) };
  }

  /** Get or create a thread. */
  async open(auth: AuthContext, input: OpenThreadInput): Promise<ThreadDto> {
    let thread: MessageThread;
    if (input.kind === 'CHILD') {
      const child = await this.prisma.raw.child.findFirst({
        where: { id: input.childId, deletedAt: null },
      });
      if (!child) throw new NotFoundException();
      const existing = await this.prisma.raw.messageThread.findFirst({
        where: { daycareId: child.daycareId, kind: 'CHILD', childId: child.id },
      });
      thread =
        existing ??
        ({ id: '', daycareId: child.daycareId, kind: 'CHILD', childId: child.id } as MessageThread);
      const acc = await this.access(auth, thread);
      if (!acc.read) throw new ForbiddenException();
      if (!existing) {
        thread = await this.prisma.raw.messageThread.create({
          data: {
            daycareId: child.daycareId,
            kind: 'CHILD',
            childId: child.id,
            createdById: auth.userId,
          },
        });
      }
    } else if (input.kind === 'STAFF') {
      const branch = auth.daycareId;
      if (!branch || !(await this.staffRole(auth, branch))) throw new ForbiddenException();
      const other = await this.prisma.raw.membership.findFirst({
        where: {
          daycareId: branch,
          userId: input.userId,
          status: 'ACTIVE',
          deletedAt: null,
          role: { in: ['MANAGER', 'STAFF'] },
        },
      });
      if (!other || input.userId === auth.userId)
        throw new BadRequestException({ code: 'unknown_staff', message: 'Unknown staff member' });
      const [userA, userB] = [auth.userId, input.userId].sort() as [string, string];
      thread =
        (await this.prisma.raw.messageThread.findFirst({
          where: { daycareId: branch, userA, userB },
        })) ??
        (await this.prisma.raw.messageThread.create({
          data: { daycareId: branch, kind: 'STAFF', userA, userB, createdById: auth.userId },
        }));
    } else {
      const branch = auth.daycareId;
      if (!branch || !(await this.staffRole(auth, branch))) throw new ForbiddenException();
      if (input.classroomId) {
        const ok = await this.prisma.raw.classroom.count({
          where: { id: input.classroomId, daycareId: branch, deletedAt: null },
        });
        if (!ok) throw new BadRequestException({ code: 'unknown_class', message: 'Unknown class' });
      }
      thread = await this.prisma.raw.messageThread.create({
        data: {
          daycareId: branch,
          kind: 'ANNOUNCEMENT',
          title: input.title,
          classroomId: input.classroomId ?? null,
          createdById: auth.userId,
        },
      });
    }
    return (await this.toThreads(auth, [thread]))[0]!;
  }

  private async load(auth: AuthContext, id: string) {
    const t = await this.prisma.raw.messageThread.findUnique({ where: { id } });
    if (!t) throw new NotFoundException();
    const acc = await this.access(auth, t);
    if (!acc.read) throw new NotFoundException();
    return { t, acc };
  }

  async messages(auth: AuthContext, id: string, before?: string): Promise<ThreadMessages> {
    const { t } = await this.load(auth, id);
    const page = 50;
    const rows = await this.prisma.raw.message.findMany({
      where: { threadId: id, ...(before ? { createdAt: { lt: new Date(before) } } : {}) },
      orderBy: { createdAt: 'desc' },
      take: page + 1,
    });
    const hasMore = rows.length > page;
    const list = rows.slice(0, page).reverse();
    const senders = await this.prisma.raw.user.findMany({
      where: { id: { in: [...new Set(list.map((m) => m.senderId))] } },
      select: {
        id: true,
        fullName: true,
        avatarUrl: true,
        isSuperAdmin: true,
        memberships: { where: { daycareId: t.daycareId }, select: { role: true } },
      },
    });
    const s = new Map(senders.map((x) => [x.id, x]));
    // Latest read time of anyone other than me, for read ticks.
    const othersRead = await this.prisma.raw.threadRead.findFirst({
      where: { threadId: id, userId: { not: auth.userId } },
      orderBy: { lastReadAt: 'desc' },
    });
    // Mark read.
    await this.prisma.raw.threadRead.upsert({
      where: { threadId_userId: { threadId: id, userId: auth.userId } },
      update: { lastReadAt: new Date() },
      create: { threadId: id, userId: auth.userId, lastReadAt: new Date() },
    });
    const messages: MessageDto[] = list.map((m) => {
      const u = s.get(m.senderId);
      return {
        id: m.id,
        body: m.body,
        attachment: m.attachmentKey
          ? {
              name: m.attachmentName ?? 'file',
              mime: m.attachmentMime ?? 'application/octet-stream',
              url: this.signedPath(m.id),
            }
          : null,
        sender: {
          id: m.senderId,
          fullName: u?.fullName ?? '',
          avatarUrl: u?.avatarUrl ?? null,
          role: u?.isSuperAdmin ? 'SUPER_ADMIN' : (u?.memberships[0]?.role ?? null),
        },
        mine: m.senderId === auth.userId,
        read:
          m.senderId === auth.userId && Boolean(othersRead && othersRead.lastReadAt >= m.createdAt),
        createdAt: m.createdAt.toISOString(),
      };
    });
    return { thread: (await this.toThreads(auth, [t]))[0]!, messages, hasMore };
  }

  async send(
    auth: AuthContext,
    id: string,
    body: string | undefined,
    file?: UploadedBlob,
  ): Promise<MessageDto> {
    const { t, acc } = await this.load(auth, id);
    if (!acc.post)
      throw new ForbiddenException({ code: 'cannot_post', message: 'You cannot post here' });
    const text = body?.trim() || null;
    if (!text && !file)
      throw new BadRequestException({ code: 'empty_message', message: 'Message is empty' });
    const key = file
      ? await this.storage.save(`branches/${t.daycareId}/messages/${t.id}`, file, MESSAGE_MIME)
      : null;
    const m = await this.prisma.raw.message.create({
      data: {
        daycareId: t.daycareId,
        threadId: t.id,
        senderId: auth.userId,
        body: text,
        attachmentKey: key,
        attachmentName: file ? decodeFileName(file.originalname).slice(0, 200) : null,
        attachmentMime: file?.mimetype ?? null,
      },
    });
    await this.prisma.raw.messageThread.update({
      where: { id: t.id },
      data: { lastMessageAt: m.createdAt },
    });
    await this.prisma.raw.threadRead.upsert({
      where: { threadId_userId: { threadId: t.id, userId: auth.userId } },
      update: { lastReadAt: m.createdAt },
      create: { threadId: t.id, userId: auth.userId, lastReadAt: m.createdAt },
    });
    const me = await this.prisma.raw.user.findUniqueOrThrow({ where: { id: auth.userId } });
    return {
      id: m.id,
      body: m.body,
      attachment: key
        ? { name: m.attachmentName!, mime: m.attachmentMime!, url: this.signedPath(m.id) }
        : null,
      sender: { id: me.id, fullName: me.fullName, avatarUrl: me.avatarUrl, role: auth.role },
      mine: true,
      read: false,
      createdAt: m.createdAt.toISOString(),
    };
  }

  async attachment(auth: AuthContext, id: string, messageId: string) {
    await this.load(auth, id);
    const m = await this.prisma.raw.message.findFirst({ where: { id: messageId, threadId: id } });
    if (!m?.attachmentKey) throw new NotFoundException();
    return {
      buffer: await this.storage.read(m.attachmentKey),
      mime: m.attachmentMime!,
      name: m.attachmentName ?? 'file',
    };
  }
}
