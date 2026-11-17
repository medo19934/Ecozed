import { createHash, randomInt } from 'node:crypto';
import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  HttpException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import {
  ATTENDANCE,
  FeatureToggle,
  localDate,
  type ChildAttendanceActionInput,
  type DayStatus,
  type GeoCheckInput,
  type KioskPreview,
  type KioskResult,
  type KioskResultItem,
  type KioskToken,
  type MyAttendance,
  type RosterQuery,
  type RosterResponse,
  type StaffDayRow,
  type VacationDto,
  type VacationRequestInput,
  type VacationReviewInput,
} from '@latif/shared';
import type { AuthContext } from '../../common/decorators/auth.decorators';
import { isBranchAdmin, requireBranch } from '../../common/utils/scope';
import { AppConfig } from '../../config/app-config.service';
import type { AttendanceMethod, Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AuditService } from '../audit/audit.service';
import { ClassesService } from '../classes/classes.service';
import {
  dbDate,
  haversineM,
  isoDate,
  kioskToken,
  pinHash,
  kioskTokenExpiresIn,
  verifyKioskToken,
} from './attendance.util';

const err = (code: string, message: string) => new BadRequestException({ code, message });

const PIN_MAX_FAILURES = 5;
const PIN_LOCK_MS = 5 * 60_000;

@Injectable()
export class AttendanceService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly classes: ClassesService,
    private readonly audit: AuditService,
    private readonly config: AppConfig,
  ) {}

  private get secret(): string {
    return `${this.config.get('JWT_ACCESS_SECRET')}:attendance`;
  }

  private async branch(daycareId: string) {
    const b = await this.prisma.raw.daycare.findFirst({
      where: { id: daycareId, deletedAt: null },
    });
    if (!b) throw new NotFoundException();
    return b;
  }

  async today(daycareId: string): Promise<string> {
    return localDate(new Date(), (await this.branch(daycareId)).timezone);
  }

  private async feature(daycareId: string, key: FeatureToggle): Promise<boolean> {
    const f = await this.prisma.raw.daycareFeature.findFirst({ where: { daycareId, key } });
    return Boolean(f?.enabled);
  }

  /** Children the caller may see in the active branch (teachers: own classes). */
  private async childScope(auth: AuthContext): Promise<Prisma.ChildWhereInput> {
    if (isBranchAdmin(auth)) return {};
    if (auth.role !== 'STAFF') throw new ForbiddenException();
    return { classroomId: { in: await this.classes.teacherClassIds(auth) } };
  }

  /** Status for a day: explicit record wins, else an approved vacation, else no record. */
  private dayStatus(record: { status: string } | undefined, onVacation: boolean): DayStatus {
    if (record) return record.status as DayStatus;
    return onVacation ? 'VACATION' : 'NO_RECORD';
  }

  private async approvedVacationChildIds(
    daycareId: string,
    date: Date,
    childIds: string[],
  ): Promise<Set<string>> {
    const v = await this.prisma.raw.vacationRequest.findMany({
      where: {
        daycareId,
        status: 'APPROVED',
        childId: { in: childIds },
        startDate: { lte: date },
        endDate: { gte: date },
      },
      select: { childId: true },
    });
    return new Set(v.map((x) => x.childId));
  }

  // ---------------- Roster ----------------

  async roster(auth: AuthContext, q: RosterQuery): Promise<RosterResponse> {
    const daycareId = requireBranch(auth);
    const date = q.date ?? (await this.today(daycareId));
    const day = dbDate(date);
    const children = await this.prisma.scoped.child.findMany({
      where: {
        AND: [
          await this.childScope(auth),
          { status: 'ACTIVE' },
          q.classroomId ? { classroomId: q.classroomId } : {},
          q.search ? { fullName: { contains: q.search, mode: 'insensitive' } } : {},
        ],
      },
      include: { classroom: { select: { id: true, name: true } } },
      orderBy: { fullName: 'asc' },
    });
    const ids = children.map((c) => c.id);
    const [records, vacation] = await Promise.all([
      this.prisma.scoped.childAttendance.findMany({ where: { date: day, childId: { in: ids } } }),
      this.approvedVacationChildIds(daycareId, day, ids),
    ]);
    const byChild = new Map(records.map((r) => [r.childId, r]));
    const counts: Record<DayStatus, number> = {
      NO_RECORD: 0,
      ATTENDED: 0,
      ABSENT: 0,
      VACATION: 0,
      DEPARTURE: 0,
    };
    const rows = children.map((c) => {
      const r = byChild.get(c.id);
      const status = this.dayStatus(r, vacation.has(c.id));
      counts[status] += 1;
      return {
        child: {
          id: c.id,
          fullName: c.fullName,
          gender: c.gender,
          hasPhoto: Boolean(c.photoKey),
          classroom: c.classroom,
        },
        status,
        checkInAt: r?.checkInAt?.toISOString() ?? null,
        checkOutAt: r?.checkOutAt?.toISOString() ?? null,
        droppedOffBy: r?.droppedOffBy ?? null,
        pickedUpBy: r?.pickedUpBy ?? null,
        method: r?.method ?? null,
        note: r?.note ?? null,
      };
    });
    return { date, rows, counts };
  }

  async actOnChild(auth: AuthContext, childId: string, input: ChildAttendanceActionInput) {
    const daycareId = requireBranch(auth);
    const child = await this.prisma.scoped.child.findFirst({
      where: { AND: [{ id: childId, status: 'ACTIVE' }, await this.childScope(auth)] },
    });
    if (!child) throw new NotFoundException();
    const date = input.date ?? (await this.today(daycareId));
    if (date > (await this.today(daycareId)))
      throw err('future_date', 'Cannot record a future day');
    const day = dbDate(date);
    const existing = await this.prisma.scoped.childAttendance.findFirst({
      where: { childId, date: day },
    });
    const now = new Date();
    const base = {
      recordedById: auth.userId,
      note: input.note ?? existing?.note ?? null,
      method: 'MANUAL' as const,
    };

    switch (input.action) {
      case 'CLEAR':
        if (existing)
          await this.prisma.scoped.childAttendance.delete({ where: { id: existing.id } });
        break;
      case 'ABSENT':
        await this.upsertChild(childId, day, existing?.id, {
          ...base,
          status: 'ABSENT',
          checkInAt: null,
          checkOutAt: null,
          droppedOffBy: null,
          pickedUpBy: null,
        });
        break;
      case 'CHECK_IN':
        await this.upsertChild(childId, day, existing?.id, {
          ...base,
          status: 'ATTENDED',
          checkInAt: now,
          checkOutAt: null,
          droppedOffBy: input.person ?? null,
          pickedUpBy: null,
        });
        await this.logEvent(daycareId, {
          childId,
          direction: 'IN',
          method: 'MANUAL',
          actorId: auth.userId,
        });
        break;
      case 'CHECK_OUT':
        if (!existing?.checkInAt || existing.status !== 'ATTENDED') {
          throw err('not_checked_in', 'Child is not checked in');
        }
        await this.upsertChild(childId, day, existing.id, {
          ...base,
          status: 'DEPARTURE',
          checkOutAt: now,
          pickedUpBy: input.person ?? null,
        });
        await this.logEvent(daycareId, {
          childId,
          direction: 'OUT',
          method: 'MANUAL',
          actorId: auth.userId,
        });
        break;
    }
    return this.roster(auth, { date, search: undefined, classroomId: undefined }).then((r) =>
      r.rows.find((x) => x.child.id === childId)!,
    );
  }

  private async upsertChild(
    childId: string,
    date: Date,
    id: string | undefined,
    data: Omit<Prisma.ChildAttendanceUncheckedCreateInput, 'childId' | 'date' | 'daycareId'>,
  ) {
    if (id) await this.prisma.scoped.childAttendance.update({ where: { id }, data });
    else
      await this.prisma.scoped.childAttendance.create({
        data: { ...data, childId, date } as never,
      });
  }

  private logEvent(
    daycareId: string,
    e: Omit<Prisma.AttendanceEventUncheckedCreateInput, 'daycareId'>,
  ) {
    return this.prisma.raw.attendanceEvent.create({ data: { ...e, daycareId } });
  }

  // ---------------- Staff ----------------

  async staffDay(auth: AuthContext, date?: string): Promise<{ date: string; rows: StaffDayRow[] }> {
    const daycareId = requireBranch(auth);
    const d = date ?? (await this.today(daycareId));
    const members = await this.prisma.scoped.membership.findMany({
      where: { role: { in: ['MANAGER', 'STAFF'] }, status: 'ACTIVE' },
      include: {
        user: { select: { fullName: true, avatarUrl: true } },
        staffDays: { where: { date: dbDate(d) } },
      },
      orderBy: { user: { fullName: 'asc' } },
    });
    return {
      date: d,
      rows: members.map((m) => {
        const r = m.staffDays[0];
        return {
          membershipId: m.id,
          fullName: m.user.fullName,
          avatarUrl: m.user.avatarUrl,
          staffType: m.staffType,
          checkInAt: r?.checkInAt.toISOString() ?? null,
          checkOutAt: r?.checkOutAt?.toISOString() ?? null,
          method: r?.method ?? null,
          distanceM: r?.distanceM ?? null,
        };
      }),
    };
  }

  /** Toggles a staff member's day: no record → in; open → out; closed → error. */
  private async toggleStaff(
    daycareId: string,
    membershipId: string,
    method: AttendanceMethod,
    actorId: string,
    geo?: { latitude: number; longitude: number; distanceM: number },
  ): Promise<KioskResultItem> {
    await this.debounce(daycareId, { membershipId });
    const date = dbDate(await this.today(daycareId));
    const now = new Date();
    const m = await this.prisma.raw.membership.findUniqueOrThrow({
      where: { id: membershipId },
      include: { user: true },
    });
    const existing = await this.prisma.raw.staffAttendance.findFirst({
      where: { membershipId, date },
    });
    let direction: 'IN' | 'OUT';
    if (!existing) {
      await this.prisma.raw.staffAttendance.create({
        data: {
          daycareId,
          membershipId,
          date,
          checkInAt: now,
          method,
          distanceM: geo?.distanceM ?? null,
        },
      });
      direction = 'IN';
    } else if (!existing.checkOutAt) {
      await this.prisma.raw.staffAttendance.update({
        where: { id: existing.id },
        data: { checkOutAt: now },
      });
      direction = 'OUT';
    } else {
      throw new ConflictException({
        code: 'already_checked_out',
        message: 'Already checked out today',
      });
    }
    await this.logEvent(daycareId, { membershipId, direction, method, actorId, ...geo });
    return { kind: 'STAFF', name: m.user.fullName, direction, at: now.toISOString() };
  }

  /** Toggles each child: no record/absent/vacation → in; attended → out; departed → skipped. */
  private async toggleChildren(
    daycareId: string,
    childIds: string[],
    person: string,
    method: AttendanceMethod,
    actorId: string,
    direction?: 'IN' | 'OUT',
  ): Promise<KioskResultItem[]> {
    const date = dbDate(await this.today(daycareId));
    const now = new Date();
    const items: KioskResultItem[] = [];
    for (const childId of childIds) {
      const child = await this.prisma.raw.child.findFirstOrThrow({ where: { id: childId } });
      const r = await this.prisma.raw.childAttendance.findFirst({ where: { childId, date } });
      if (r?.status === 'DEPARTURE') continue;
      // Explicit choice: only check in children who are not in; only check out children who are.
      if (direction === 'IN' && r?.status === 'ATTENDED') continue;
      if (direction === 'OUT' && r?.status !== 'ATTENDED') continue;
      if (r?.status === 'ATTENDED') {
        await this.prisma.raw.childAttendance.update({
          where: { id: r.id },
          data: {
            status: 'DEPARTURE',
            checkOutAt: now,
            pickedUpBy: person,
            method,
            recordedById: actorId,
          },
        });
        items.push({
          kind: 'CHILD',
          name: child.fullName,
          direction: 'OUT',
          at: now.toISOString(),
        });
        await this.logEvent(daycareId, { childId, direction: 'OUT', method, actorId });
      } else {
        const data = {
          status: 'ATTENDED' as const,
          checkInAt: now,
          checkOutAt: null,
          droppedOffBy: person,
          pickedUpBy: null,
          method,
          recordedById: actorId,
        };
        if (r) await this.prisma.raw.childAttendance.update({ where: { id: r.id }, data });
        else
          await this.prisma.raw.childAttendance.create({
            data: { ...data, daycareId, childId, date },
          });
        items.push({ kind: 'CHILD', name: child.fullName, direction: 'IN', at: now.toISOString() });
        await this.logEvent(daycareId, { childId, direction: 'IN', method, actorId });
      }
    }
    if (!items.length)
      throw new ConflictException(
        direction === 'IN'
          ? { code: 'already_checked_in', message: 'Already checked in' }
          : direction === 'OUT'
            ? { code: 'not_checked_in', message: 'Not checked in yet' }
            : { code: 'already_checked_out', message: 'Already picked up today' },
      );
    return items;
  }

  private async debounce(
    daycareId: string,
    who: { membershipId?: string; childId?: { in: string[] } },
  ) {
    const recent = await this.prisma.raw.attendanceEvent.findFirst({
      // Only self-service scans count; staff corrections on the roster never block a scan.
      where: {
        daycareId,
        ...who,
        method: { in: ['QR', 'PIN', 'GEO'] },
        at: { gte: new Date(Date.now() - ATTENDANCE.DEBOUNCE_SECONDS * 1000) },
      },
    });
    if (recent)
      throw new ConflictException({ code: 'too_soon', message: 'Already recorded a moment ago' });
  }

  /** Resolves a person (staff or parent) in a branch and records their attendance. */
  private async recordFor(
    daycareId: string,
    membership: { id: string; role: string; userId: string; user: { fullName: string } },
    method: AttendanceMethod,
    actorId: string,
    childIds?: string[],
    direction?: 'IN' | 'OUT',
  ): Promise<KioskResult> {
    if (membership.role === 'STAFF' || membership.role === 'MANAGER') {
      if (direction) await this.assertStaffDirection(daycareId, membership.id, direction);
      return {
        person: membership.user.fullName,
        items: [await this.toggleStaff(daycareId, membership.id, method, actorId)],
      };
    }
    const kids = await this.prisma.raw.child.findMany({
      where: {
        daycareId,
        deletedAt: null,
        status: 'ACTIVE',
        guardians: { some: { userId: membership.userId } },
      },
      select: { id: true },
    });
    let ids = kids.map((k) => k.id);
    if (childIds?.length) ids = ids.filter((id) => childIds.includes(id));
    if (!ids.length) throw err('no_children', 'No linked children in this branch');
    await this.debounce(daycareId, { childId: { in: ids } });
    return {
      person: membership.user.fullName,
      items: await this.toggleChildren(
        daycareId,
        ids,
        membership.user.fullName,
        method,
        actorId,
        direction,
      ),
    };
  }

  // ---------------- Kiosk ----------------

  async kioskToken(auth: AuthContext): Promise<KioskToken> {
    const daycareId = requireBranch(auth);
    const b = await this.branch(daycareId);
    const t = kioskToken(this.secret, daycareId);
    return {
      token: t.token,
      expiresAt: t.expiresAt.toISOString(),
      refreshInSeconds: t.refreshInSeconds,
      branch: { id: b.id, name: b.name, nameEn: b.nameEn, hasLogo: Boolean(b.logoKey) },
    };
  }

  /**
   * A person types their PIN on the kiosk (kiosk runs under a staff session of that branch).
   * Attempt limit: 5 wrong PINs within 5 minutes on a kiosk locks it for the rest of the window.
   */
  async kioskPin(auth: AuthContext, pin: string): Promise<KioskResult> {
    const daycareId = requireBranch(auth);
    const since = new Date(Date.now() - PIN_LOCK_MS);
    const failures = await this.prisma.raw.auditLog.count({
      where: {
        daycareId,
        actorId: auth.userId,
        action: 'kiosk.pin_failed',
        createdAt: { gte: since },
      },
    });
    if (failures >= PIN_MAX_FAILURES) {
      throw new HttpException(
        { code: 'pin_locked', message: 'Too many wrong PINs, try again later' },
        429,
      );
    }
    const m = await this.prisma.raw.membership.findFirst({
      where: {
        daycareId,
        pinHash: pinHash(this.secret, daycareId, pin),
        status: 'ACTIVE',
        deletedAt: null,
      },
      include: { user: { select: { fullName: true } } },
    });
    if (!m) {
      await this.prisma.raw.auditLog.create({
        data: { daycareId, actorId: auth.userId, action: 'kiosk.pin_failed', entity: 'Membership' },
      });
      throw err('invalid_pin', 'Unknown PIN');
    }
    return this.recordFor(daycareId, m, 'PIN', m.userId);
  }

  private async scanContext(auth: AuthContext, token: string) {
    const daycareId = verifyKioskToken(this.secret, token);
    if (!daycareId) throw err('invalid_qr', 'QR expired or invalid');
    if (!(await this.feature(daycareId, FeatureToggle.CHILD_QR_ATTENDANCE))) {
      throw new ForbiddenException({
        code: 'feature_disabled',
        message: 'QR attendance is disabled',
      });
    }
    const m = await this.prisma.raw.membership.findFirst({
      where: { daycareId, userId: auth.userId, status: 'ACTIVE', deletedAt: null },
      include: { user: { select: { fullName: true } } },
    });
    if (!m)
      throw new ForbiddenException({ code: 'not_member', message: 'Not a member of this branch' });
    const tokenHash = createHash('sha256').update(token).digest('hex');
    const used = await this.prisma.raw.kioskTokenUse.findUnique({
      where: { tokenHash_userId: { tokenHash, userId: auth.userId } },
    });
    if (used) throw new ConflictException({ code: 'qr_used', message: 'This QR was already used' });
    return { daycareId, m, tokenHash };
  }

  /** What scanning this QR would do for the signed-in person. Writes nothing. */
  async kioskPreview(auth: AuthContext, token: string): Promise<KioskPreview> {
    const { daycareId, m } = await this.scanContext(auth, token);
    const b = await this.branch(daycareId);
    const date = dbDate(await this.today(daycareId));
    const base = {
      branch: { id: b.id, name: b.name, nameEn: b.nameEn },
      person: m.user.fullName,
      expiresInSeconds: kioskTokenExpiresIn(token),
    };
    if (m.role === 'STAFF' || m.role === 'MANAGER') {
      const r = await this.prisma.raw.staffAttendance.findFirst({
        where: { membershipId: m.id, date },
      });
      return {
        ...base,
        kind: 'STAFF',
        staffNext: !r ? 'IN' : !r.checkOutAt ? 'OUT' : null,
        children: [],
      };
    }
    const kids = await this.prisma.raw.child.findMany({
      where: {
        daycareId,
        deletedAt: null,
        status: 'ACTIVE',
        guardians: { some: { userId: m.userId } },
      },
      orderBy: { fullName: 'asc' },
    });
    const recs = await this.prisma.raw.childAttendance.findMany({
      where: { date, childId: { in: kids.map((k) => k.id) } },
    });
    return {
      ...base,
      kind: 'PARENT',
      staffNext: null,
      children: kids.map((k) => {
        const r = recs.find((x) => x.childId === k.id);
        const status = r?.status ?? 'NO_RECORD';
        return {
          id: k.id,
          fullName: k.fullName,
          status,
          next: status === 'DEPARTURE' ? null : status === 'ATTENDED' ? 'OUT' : 'IN',
        };
      }),
    };
  }

  /**
   * check_in(token): a signed-in staff member or parent scans the kiosk QR (app or phone camera).
   * The token is branch-bound, short-lived and single-use per person.
   */
  async kioskScan(
    auth: AuthContext,
    token: string,
    childIds?: string[],
    direction?: 'IN' | 'OUT',
  ): Promise<KioskResult> {
    const { daycareId, m, tokenHash } = await this.scanContext(auth, token);
    const result = await this.recordFor(daycareId, m, 'QR', auth.userId, childIds, direction);
    await this.prisma.raw.kioskTokenUse
      .create({ data: { tokenHash, userId: auth.userId } })
      .catch(() => undefined);
    // Housekeeping: tokens older than an hour can't be valid anyway.
    void this.prisma.raw.kioskTokenUse
      .deleteMany({ where: { usedAt: { lt: new Date(Date.now() - 3_600_000) } } })
      .catch(() => undefined);
    return result;
  }

  private async assertStaffDirection(
    daycareId: string,
    membershipId: string,
    direction: 'IN' | 'OUT',
  ) {
    const date = dbDate(await this.today(daycareId));
    const r = await this.prisma.raw.staffAttendance.findFirst({ where: { membershipId, date } });
    if (direction === 'IN' && r)
      throw new ConflictException({ code: 'already_checked_in', message: 'Already checked in' });
    if (direction === 'OUT' && (!r || r.checkOutAt))
      throw new ConflictException({ code: 'not_checked_in', message: 'Not checked in yet' });
  }

  // ---------------- Personal PIN ----------------

  async regeneratePin(auth: AuthContext): Promise<{ pin: string }> {
    const daycareId = requireBranch(auth);
    if (!auth.membershipId)
      throw new ForbiddenException({ code: 'not_member', message: 'No membership' });
    for (let i = 0; i < 20; i++) {
      const pin = String(randomInt(0, 1_000_000)).padStart(6, '0');
      try {
        await this.prisma.raw.membership.update({
          where: { id: auth.membershipId },
          data: { pinHash: pinHash(this.secret, daycareId, pin) },
        });
        await this.audit.log({
          action: 'attendance.pin_regenerated',
          entity: 'Membership',
          entityId: auth.membershipId,
        });
        return { pin };
      } catch {
        // Unique collision in this branch — try another PIN.
      }
    }
    throw new ConflictException({ code: 'conflict', message: 'Could not allocate a PIN' });
  }

  // ---------------- Geofenced staff check-in ----------------

  async geoCheck(auth: AuthContext, input: GeoCheckInput): Promise<KioskResult> {
    const daycareId = requireBranch(auth);
    if (!auth.membershipId || !['STAFF', 'MANAGER'].includes(auth.role ?? '')) {
      throw new ForbiddenException({ code: 'staff_only', message: 'Staff only' });
    }
    if (!(await this.feature(daycareId, FeatureToggle.STAFF_GEOFENCED_ATTENDANCE))) {
      throw new ForbiddenException({
        code: 'feature_disabled',
        message: 'Location check-in is disabled',
      });
    }
    const b = await this.branch(daycareId);
    if (b.latitude == null || b.longitude == null)
      throw err('branch_location_missing', 'Branch location not set');
    const distanceM = haversineM(b.latitude, b.longitude, input.latitude, input.longitude);
    // Allow GPS uncertainty up to 50 m on top of the radius.
    const allowance = Math.min(input.accuracy ?? 0, 50);
    if (distanceM > b.geofenceRadiusM + allowance) {
      throw new BadRequestException({
        code: 'outside_geofence',
        message: `You are ${distanceM} m away`,
        distanceM,
      });
    }
    const m = await this.prisma.raw.membership.findUniqueOrThrow({
      where: { id: auth.membershipId },
      include: { user: { select: { fullName: true } } },
    });
    const item = await this.toggleStaff(daycareId, m.id, 'GEO', auth.userId, {
      latitude: input.latitude,
      longitude: input.longitude,
      distanceM,
    });
    return { person: m.user.fullName, items: [item] };
  }

  // ---------------- Me ----------------

  async me(auth: AuthContext): Promise<MyAttendance> {
    const daycareId = auth.daycareId;
    if (!daycareId) {
      return {
        date: localDate(),
        staff: null,
        children: [],
        hasPin: false,
        geofence: { enabled: false, configured: false, radiusM: 0 },
        kioskEnabled: false,
      };
    }
    const b = await this.branch(daycareId);
    const date = localDate(new Date(), b.timezone);
    const day = dbDate(date);
    const m = auth.membershipId
      ? await this.prisma.raw.membership.findUnique({ where: { id: auth.membershipId } })
      : null;
    let staff: MyAttendance['staff'] = null;
    if (m && (m.role === 'STAFF' || m.role === 'MANAGER')) {
      const r = await this.prisma.raw.staffAttendance.findFirst({
        where: { membershipId: m.id, date: day },
      });
      staff = {
        checkInAt: r?.checkInAt.toISOString() ?? null,
        checkOutAt: r?.checkOutAt?.toISOString() ?? null,
      };
    }
    const kids = await this.prisma.raw.child.findMany({
      where: {
        daycareId,
        deletedAt: null,
        status: 'ACTIVE',
        guardians: { some: { userId: auth.userId } },
      },
      include: { attendance: { where: { date: day } } },
      orderBy: { fullName: 'asc' },
    });
    const vacation = await this.approvedVacationChildIds(
      daycareId,
      day,
      kids.map((k) => k.id),
    );
    return {
      date,
      staff,
      children: kids.map((k) => {
        const r = k.attendance[0];
        return {
          id: k.id,
          fullName: k.fullName,
          status: this.dayStatus(r, vacation.has(k.id)),
          checkInAt: r?.checkInAt?.toISOString() ?? null,
          checkOutAt: r?.checkOutAt?.toISOString() ?? null,
        };
      }),
      hasPin: Boolean(m?.pinHash),
      geofence: {
        enabled: await this.feature(daycareId, FeatureToggle.STAFF_GEOFENCED_ATTENDANCE),
        configured: b.latitude != null && b.longitude != null,
        radiusM: b.geofenceRadiusM,
      },
      kioskEnabled: await this.feature(daycareId, FeatureToggle.CHILD_QR_ATTENDANCE),
    };
  }

  // ---------------- Vacations ----------------

  private toVacation(
    v: Prisma.VacationRequestGetPayload<{ include: { child: { include: { classroom: true } } } }>,
    requestedBy: string,
  ): VacationDto {
    return {
      id: v.id,
      child: {
        id: v.child.id,
        fullName: v.child.fullName,
        classroom: v.child.classroom?.name ?? null,
      },
      requestedBy,
      startDate: isoDate(v.startDate),
      endDate: isoDate(v.endDate),
      reason: v.reason,
      status: v.status,
      reviewNote: v.reviewNote,
      createdAt: v.createdAt.toISOString(),
    };
  }

  private async names(ids: string[]): Promise<Map<string, string>> {
    const users = await this.prisma.raw.user.findMany({
      where: { id: { in: ids } },
      select: { id: true, fullName: true },
    });
    return new Map(users.map((u) => [u.id, u.fullName]));
  }

  /** Parent requests a vacation for their own child (any branch). */
  async requestVacation(auth: AuthContext, input: VacationRequestInput): Promise<VacationDto> {
    const child = await this.prisma.raw.child.findFirst({
      where: {
        id: input.childId,
        deletedAt: null,
        status: 'ACTIVE',
        guardians: { some: { userId: auth.userId } },
      },
      include: { classroom: true },
    });
    if (!child) throw new NotFoundException();
    const v = await this.prisma.raw.vacationRequest.create({
      data: {
        daycareId: child.daycareId,
        childId: child.id,
        requestedById: auth.userId,
        startDate: dbDate(input.startDate),
        endDate: dbDate(input.endDate),
        reason: input.reason ?? null,
      },
      include: { child: { include: { classroom: true } } },
    });
    await this.audit.log({
      action: 'vacation.request',
      entity: 'VacationRequest',
      entityId: v.id,
      daycareId: child.daycareId,
    });
    return this.toVacation(v, (await this.names([auth.userId])).get(auth.userId) ?? '');
  }

  async myVacations(auth: AuthContext): Promise<VacationDto[]> {
    const rows = await this.prisma.raw.vacationRequest.findMany({
      where: { requestedById: auth.userId },
      include: { child: { include: { classroom: true } } },
      orderBy: { createdAt: 'desc' },
      take: 50,
    });
    const n = await this.names([auth.userId]);
    return rows.map((v) => this.toVacation(v, n.get(v.requestedById) ?? ''));
  }

  async listVacations(
    auth: AuthContext,
    status?: 'PENDING' | 'APPROVED' | 'REJECTED',
  ): Promise<VacationDto[]> {
    const rows = await this.prisma.scoped.vacationRequest.findMany({
      where: {
        ...(status ? { status } : {}),
        child: { AND: [await this.childScope(auth), { deletedAt: null }] },
      },
      include: { child: { include: { classroom: true } } },
      orderBy: [{ status: 'asc' }, { startDate: 'asc' }],
      take: 200,
    });
    const n = await this.names([...new Set(rows.map((r) => r.requestedById))]);
    return rows.map((v) => this.toVacation(v, n.get(v.requestedById) ?? ''));
  }

  async reviewVacation(
    auth: AuthContext,
    id: string,
    input: VacationReviewInput,
  ): Promise<VacationDto> {
    const v = await this.prisma.scoped.vacationRequest.findFirst({
      where: { id, child: await this.childScope(auth) },
    });
    if (!v) throw new NotFoundException();
    const updated = await this.prisma.scoped.vacationRequest.update({
      where: { id },
      data: {
        status: input.decision,
        reviewNote: input.note ?? null,
        reviewedById: auth.userId,
        reviewedAt: new Date(),
      },
      include: { child: { include: { classroom: true } } },
    });
    await this.audit.log({
      action: `vacation.${input.decision.toLowerCase()}`,
      entity: 'VacationRequest',
      entityId: id,
    });
    return this.toVacation(
      updated,
      (await this.names([v.requestedById])).get(v.requestedById) ?? '',
    );
  }

  // ---------------- Dashboard support ----------------

  /** Day counts for children matching `where` in the given branches. */
  async dayCounts(daycareIds: string[], date: string, where: Prisma.ChildWhereInput) {
    const day = dbDate(date);
    const children = await this.prisma.raw.child.findMany({
      where: { AND: [where, { daycareId: { in: daycareIds }, deletedAt: null, status: 'ACTIVE' }] },
      select: { id: true, daycareId: true },
    });
    const ids = children.map((c) => c.id);
    const [records, vacations] = await Promise.all([
      this.prisma.raw.childAttendance.findMany({
        where: { childId: { in: ids }, date: day },
        select: { childId: true, status: true },
      }),
      this.prisma.raw.vacationRequest.findMany({
        where: {
          childId: { in: ids },
          status: 'APPROVED',
          startDate: { lte: day },
          endDate: { gte: day },
        },
        select: { childId: true },
      }),
    ]);
    const rec = new Map(records.map((r) => [r.childId, r]));
    const vac = new Set(vacations.map((v) => v.childId));
    const counts: Record<DayStatus, number> = {
      NO_RECORD: 0,
      ATTENDED: 0,
      ABSENT: 0,
      VACATION: 0,
      DEPARTURE: 0,
    };
    for (const id of ids) counts[this.dayStatus(rec.get(id), vac.has(id))] += 1;
    return { total: ids.length, counts };
  }

  childScopeFor(auth: AuthContext) {
    return this.childScope(auth);
  }
}
