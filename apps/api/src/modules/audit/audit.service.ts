import { Injectable, Logger } from '@nestjs/common';
import { RequestContext } from '../../common/context/request-context';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';

export interface AuditEntry {
  action: string;
  entity: string;
  entityId?: string | null;
  metadata?: Prisma.InputJsonValue;
  /** Override actor/tenant (e.g. during signup before context is populated). */
  actorId?: string | null;
  daycareId?: string | null;
}

/** Writes sensitive-action audit records. Never throws into the caller. */
@Injectable()
export class AuditService {
  private readonly logger = new Logger(AuditService.name);

  constructor(private readonly prisma: PrismaService) {}

  async log(entry: AuditEntry): Promise<void> {
    const ctx = RequestContext.get();
    try {
      await this.prisma.raw.auditLog.create({
        data: {
          action: entry.action,
          entity: entry.entity,
          entityId: entry.entityId ?? null,
          metadata: entry.metadata,
          actorId: entry.actorId !== undefined ? entry.actorId : (ctx?.userId ?? null),
          daycareId: entry.daycareId !== undefined ? entry.daycareId : (ctx?.daycareId ?? null),
          ip: ctx?.ip,
          userAgent: ctx?.userAgent,
        },
      });
    } catch (err) {
      this.logger.error(`Failed to write audit log ${entry.action}`, err as Error);
    }
  }
}
