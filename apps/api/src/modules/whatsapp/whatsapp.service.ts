import { Injectable, Logger } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { AssistantOp, AssistantResult } from '@latif/shared';
import type { AuthContext } from '../../common/decorators/auth.decorators';
import { RequestContext } from '../../common/context/request-context';
import { effectivePermissions } from '../../common/guards/permissions';
import type { Prisma } from '../../generated/prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AssistantService } from '../assistant/assistant.service';
import { AuditService } from '../audit/audit.service';
import { Transcriber } from './transcriber';
import { WhatsAppClient } from './whatsapp.client';

/** The parts of a WhatsApp Cloud API webhook message the agent uses. */
export interface InboundMessage {
  id: string;
  from: string; // international number without "+", e.g. 9665XXXXXXXX
  type: string;
  text?: { body: string };
  audio?: { id: string; mime_type?: string };
}

const norm = (s: string) =>
  s
    .trim()
    .toLowerCase()
    .replace(/[أإآ]/g, 'ا')
    .replace(/[.!؟?،]/g, '');
const CONFIRM = ['تم', 'نعم', 'اعتمد', 'اكد', 'موافق', 'احفظ', 'yes', 'ok', 'confirm'];
const CANCEL = ['الغاء', 'لا', 'الغ', 'cancel', 'no'];
const HELP = ['مساعده', 'help', 'ساعدني', '؟', '?'];
const PERIOD: Record<string, string> = { MONTHLY: 'شهري', TERM: 'فصلي', YEARLY: 'سنوي' };
const ROLE: Record<string, string> = {
  MANAGER: 'مدير فرع',
  STAFF: 'معلمة/موظف',
  PARENT: 'ولي أمر',
};
const FEATURE: Record<string, string> = {
  messages: 'الرسائل',
  dailyReports: 'التقارير اليومية',
  subscriptions: 'الاشتراكات',
  calendar: 'التقويم',
  units: 'الوحدات',
  childQrAttendance: 'حضور QR',
  staffGeofencedAttendance: 'حضور الموظفين بالموقع',
  dailyStoryAi: 'القصة اليومية',
};

const HELP_TEXT = [
  'أهلًا 👋 أنا وكيل لطيف كيدز على واتساب.',
  'اكتب أو سجّل رسالة صوتية، مثل:',
  '• أضف معلمة اسمها سارة sara@x.com في فصل Duck Class',
  '• أضف فصل Monkey Class بسعة 15',
  '• انقل الطفل سعد إلى فصل Panda Class',
  '• أوقف حساب سارة',
  '• أوقف التقارير اليومية',
  'أو الصق جدولًا من Excel (سطر العناوين ثم الصفوف).',
  'أرسل لك قائمة التغييرات، وتردّ «تم» للحفظ أو «إلغاء».',
].join('\n');

/** One line per proposed change (Arabic). */
export function describe(op: AssistantOp): string {
  const b = op.branch ? ` (${op.branch})` : '';
  switch (op.type) {
    case 'class.create':
      return `إضافة فصل «${op.name}» بسعة ${op.capacity}${b}`;
    case 'user.create':
      return `إضافة ${ROLE[op.role]}: ${op.fullName}${op.email || op.phone ? ` — ${op.email ?? op.phone}` : ''}${op.classNames.length ? ` — ${op.classNames.join('، ')}` : ''}${b}`;
    case 'user.update':
      return `تعديل ${op.match}${b}`;
    case 'user.deactivate':
      return `إيقاف حساب ${op.match}${b}`;
    case 'child.create':
      return `إضافة الطفل ${op.fullName} (${op.birthDate})${op.className ? ` — ${op.className}` : ''} — ولي الأمر: ${op.guardianName}${b}`;
    case 'child.move':
      return `نقل ${op.childName} إلى ${op.className}${b}`;
    case 'branch.update':
      return `تحديث بيانات الفرع${b}`;
    case 'feature.set':
      return `${op.enabled ? 'تشغيل' : 'إيقاف'}: ${FEATURE[op.key] ?? op.key}${b}`;
    case 'plan.create':
      return `إضافة باقة «${op.name}» بسعر ${op.price} ر.س (${PERIOD[op.period] ?? op.period})${b}`;
  }
}

const WARN: Record<string, string> = {
  not_understood: 'لم أفهم',
  class_added: 'سيُضاف فصل جديد',
  branch_not_allowed: 'فرع غير مسموح لك',
  note_not_read: 'الملاحظة مع الملف لا تُقرأ',
  missing_name: 'الاسم مفقود',
  missing_birth_date: 'تاريخ الميلاد مفقود',
  missing_gender: 'الجنس مفقود',
  missing_guardian: 'ولي الأمر مفقود',
  missing_guardian_contact: 'جوال أو بريد ولي الأمر مفقود',
  missing_contact: 'البريد أو الجوال مفقود',
  missing_price: 'السعر مفقود',
  unknown_columns: 'لم أتعرف على أعمدة الجدول',
  unknown_row: 'سطر غير مفهوم',
};
function warning(w: string): string {
  const row = w.match(/^row (\d+): (\w+)$/);
  if (row) return `السطر ${row[1]}: ${WARN[row[2]!] ?? row[2]}`;
  const [code, ...rest] = w.split(':');
  return `${WARN[code!] ?? code}${rest.length ? `: ${rest.join(':').trim()}` : ''}`;
}
const DETAIL: Record<string, string> = {
  exists: 'موجود مسبقًا',
  other_branch: 'فرع غير مسموح',
  forbidden_manager: 'غير مسموح لمدير الفرع',
  forbidden: 'غير مسموح',
};

/**
 * WhatsApp agent: the admin's text or voice note → proposed changes (same rules as the smart
 * assistant) → «تم» applies them as that admin (same permissions, RLS and audit log).
 */
@Injectable()
export class WhatsAppService {
  private readonly log = new Logger(WhatsAppService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly assistant: AssistantService,
    private readonly client: WhatsAppClient,
    private readonly transcriber: Transcriber,
    private readonly audit: AuditService,
  ) {}

  /** Handles every message in a Cloud API webhook payload. */
  async handleWebhook(payload: unknown): Promise<void> {
    const p = payload as { entry?: { changes?: { value?: { messages?: InboundMessage[] } }[] }[] };
    for (const entry of p.entry ?? []) {
      for (const change of entry.changes ?? []) {
        for (const msg of change.value?.messages ?? []) {
          try {
            await this.handle(msg);
          } catch (e) {
            this.log.error(`WhatsApp message ${msg.id} failed: ${(e as Error).message}`);
            await this.client.send(msg.from, 'صار خطأ غير متوقع، حاول مرة ثانية بعد قليل.');
          }
        }
      }
    }
  }

  /** Only admins and branch managers, matched by their registered phone number. */
  private async authFor(from: string): Promise<AuthContext | null> {
    const phone = `+${from.replace(/\D/g, '')}`;
    const user = await this.prisma.raw.user.findFirst({
      where: { phone, deletedAt: null, disabledAt: null },
      include: {
        memberships: {
          where: {
            status: 'ACTIVE',
            deletedAt: null,
            role: 'MANAGER',
            daycare: { deletedAt: null },
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    });
    if (!user) return null;
    if (user.isSuperAdmin) {
      const branch =
        (user.lastDaycareId &&
          (await this.prisma.raw.daycare.findFirst({
            where: { id: user.lastDaycareId, deletedAt: null },
          }))) ||
        (await this.prisma.raw.daycare.findFirst({
          where: { deletedAt: null },
          orderBy: { createdAt: 'asc' },
        }));
      return {
        userId: user.id,
        daycareId: branch ? branch.id : null,
        role: 'SUPER_ADMIN',
        permissions: effectivePermissions('SUPER_ADMIN', []),
        isSuperAdmin: true,
        membershipId: null,
      };
    }
    const m = user.memberships[0];
    if (!m) return null;
    return {
      userId: user.id,
      daycareId: m.daycareId,
      role: 'MANAGER',
      permissions: effectivePermissions('MANAGER', m.permissions),
      isSuperAdmin: false,
      membershipId: m.id,
    };
  }

  /** Runs fn as that admin (tenant, RLS identity and audit actor). */
  private as<T>(auth: AuthContext, fn: () => Promise<T>): Promise<T> {
    return RequestContext.run(
      {
        requestId: `wa-${randomUUID()}`,
        userId: auth.userId,
        daycareId: auth.daycareId,
        role: auth.role,
        permissions: auth.permissions,
        isSuperAdmin: auth.isSuperAdmin,
        membershipId: auth.membershipId,
      },
      fn,
    );
  }

  private async handle(msg: InboundMessage): Promise<void> {
    // WhatsApp retries webhooks: handle each message id once.
    const fresh = await this.prisma.raw.agentInbound
      .create({ data: { id: msg.id } })
      .then(() => true)
      .catch((e: { code?: string }) => {
        if (e.code === 'P2002') return false; // already handled
        throw e;
      });
    if (!fresh) return;

    const auth = await this.authFor(msg.from);
    if (!auth) {
      // Unknown numbers get no data, just a short notice.
      await this.client.send(msg.from, 'هذا الرقم غير مسجّل كمدير في لطيف كيدز.');
      return;
    }

    let text = msg.text?.body?.trim() ?? '';
    if (msg.type === 'audio' && msg.audio) {
      const media = await this.client.media(msg.audio.id);
      const heard = media ? await this.transcriber.toText(media.bytes, media.mime) : null;
      if (!heard) {
        await this.client.send(msg.from, 'ما قدرت أقرأ الرسالة الصوتية، اكتبها نصًا لو سمحت.');
        return;
      }
      text = heard;
      await this.client.send(msg.from, `🎙️ سمعت: «${heard}»`);
    }
    if (!text) {
      await this.client.send(msg.from, HELP_TEXT);
      return;
    }

    const word = norm(text);
    if (CONFIRM.includes(word)) return this.confirm(msg.from, auth);
    if (CANCEL.includes(word)) {
      const had = await this.prisma.raw.agentPending.deleteMany({ where: { userId: auth.userId } });
      await this.client.send(
        msg.from,
        had.count ? 'تم الإلغاء، ما حفظت شيء.' : 'ما فيه تغييرات بانتظار التأكيد.',
      );
      return;
    }
    if (HELP.includes(word)) {
      await this.client.send(msg.from, HELP_TEXT);
      return;
    }

    const plan = await this.as(auth, () => this.assistant.plan(auth, { message: text }));
    const lines: string[] = [];
    if (plan.operations.length) {
      lines.push(`📝 فهمت ${plan.operations.length} تغيير:`);
      plan.operations.forEach((op, i) => lines.push(`${i + 1}. ${describe(op)}`));
    }
    if (plan.warnings.length) {
      lines.push('', ...plan.warnings.slice(0, 10).map((w) => `⚠️ ${warning(w)}`));
    }
    if (!plan.operations.length) {
      lines.push('', 'اكتب «مساعدة» لأمثلة الأوامر.');
      await this.client.send(msg.from, lines.join('\n').trim());
      return;
    }
    await this.prisma.raw.agentPending.upsert({
      where: { userId: auth.userId },
      create: {
        userId: auth.userId,
        daycareId: auth.daycareId,
        operations: plan.operations as unknown as Prisma.InputJsonValue,
      },
      update: {
        daycareId: auth.daycareId,
        operations: plan.operations as unknown as Prisma.InputJsonValue,
        createdAt: new Date(),
      },
    });
    lines.push('', 'ردّ «تم» للحفظ، أو «إلغاء».');
    await this.client.send(msg.from, lines.join('\n'));
  }

  private async confirm(to: string, auth: AuthContext): Promise<void> {
    const pending = await this.prisma.raw.agentPending.findUnique({
      where: { userId: auth.userId },
    });
    // A pending list older than 30 minutes is not applied by a late "تم".
    if (!pending || Date.now() - pending.createdAt.getTime() > 30 * 60 * 1000) {
      if (pending) await this.prisma.raw.agentPending.delete({ where: { userId: auth.userId } });
      await this.client.send(to, 'ما فيه تغييرات بانتظار التأكيد. أرسل طلبك من جديد.');
      return;
    }
    await this.prisma.raw.agentPending.delete({ where: { userId: auth.userId } });
    const ops = pending.operations as unknown as AssistantOp[];
    const results: AssistantResult[] = await this.as(auth, () => this.assistant.apply(auth, ops));
    await this.as(auth, () =>
      this.audit.log({
        action: 'whatsapp.apply',
        entity: 'Assistant',
        metadata: { count: ops.length },
      }),
    );
    const done = results.filter((r) => r.status === 'done').length;
    const lines = [`✅ تم حفظ ${done} من ${results.length}.`];
    results.forEach((r) => {
      if (r.status !== 'done') {
        const code = (r.detail ?? '').split(':')[0]!;
        lines.push(
          `• ${describe(ops[r.index]!)} — ${r.status === 'skipped' ? 'تم التخطي' : 'فشل'}${r.detail ? ` (${DETAIL[code] ?? r.detail})` : ''}`,
        );
      }
    });
    const issued = results.map((r) => r.issued).filter(Boolean);
    if (issued.length) {
      lines.push('', '🔑 كلمات مرور مؤقتة (تظهر مرة وحدة):');
      issued.forEach((i) => lines.push(`${i!.fullName}: ${i!.identifier} — ${i!.tempPassword}`));
    }
    await this.client.send(to, lines.join('\n'));
  }
}
