import { FeatureToggle, type AssistantOp } from '@latif/shared';
import { phoneOf, readTable } from './table-parser';

/**
 * Free, rule-based reading of short chat messages (Arabic or English) — no paid AI.
 * Understands one instruction per line, plus "key: value" cards (one person / child per block).
 */

const norm = (s: string) =>
  s
    .replace(/[ً-ْـ]/g, '')
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/ى/g, 'ي')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();

const EMAIL = /[\w.+-]+@[\w-]+(?:\.[\w-]+)+/;
const PHONE = /(?:\+|00)?[\d٠-٩][\d٠-٩\s-]{7,15}[\d٠-٩]/;

/** Module names people actually type → feature key. */
const MODULES: [FeatureToggle, string[]][] = [
  [
    FeatureToggle.DAILY_REPORTS,
    ['التقارير اليوميه', 'التقرير اليومي', 'daily reports', 'daily report'],
  ],
  [FeatureToggle.MESSAGES, ['الرسائل', 'المحادثات', 'messages', 'messaging', 'chat']],
  [FeatureToggle.SUBSCRIPTIONS, ['الاشتراكات', 'المدفوعات', 'subscriptions', 'payments']],
  [FeatureToggle.CALENDAR, ['التقويم', 'الفعاليات', 'calendar', 'events']],
  [FeatureToggle.UNITS, ['الوحدات', 'units']],
  [FeatureToggle.CHILD_QR_ATTENDANCE, ['حضور qr', 'الحضور بالرمز', 'qr', 'kiosk']],
  [FeatureToggle.STAFF_GEOFENCED_ATTENDANCE, ['حضور الموظفين', 'staff attendance', 'geofence']],
  [FeatureToggle.DAILY_STORY_AI, ['القصه اليوميه', 'daily story']],
];

const roleWord = (w: string): 'MANAGER' | 'STAFF' | 'PARENT' | null => {
  const n = norm(w);
  if (/^(مدير|مديره|manager|branch manager)$/.test(n)) return 'MANAGER';
  if (/^(معلم|معلمه|موظف|موظفه|teacher|staff)$/.test(n)) return 'STAFF';
  if (/^(ولي امر|ولي الامر|ام|اب|parent|guardian)$/.test(n)) return 'PARENT';
  return null;
};

const ADD = '(?:أضف|اضف|اضيف|أضيف|سجل|سجّل|add|create|new)(?:\\s+(?:a|an|new|the))?';

/** One instruction line → operation, or null when not understood. */
export function readCommand(line: string): AssistantOp | null {
  const raw = line.trim().replace(/[.。]$/, '');
  if (!raw) return null;
  const n = norm(raw);
  let m: RegExpMatchArray | null;

  // Move a child: "انقل الطفل سعد إلى فصل الفراشات" / "move Saad to class Butterflies".
  if (
    (m = raw.match(
      /^(?:انقل|انقلي|move)\s+(?:الطفل|الطفله|الطفلة|child|kid)?\s*(.+?)\s+(?:إلى|الى|to)\s+(?:فصل|الفصل|class)?\s*(.+?)$/i,
    ))
  ) {
    return { type: 'child.move', childName: m[1]!.trim(), className: m[2]!.trim() };
  }
  // Deactivate a person: "أوقف حساب سارة" / "deactivate sara@x.com".
  if (
    (m = raw.match(
      /^(?:أوقف|اوقف|عطّل|عطل|deactivate|disable)\s+(?:حساب|account(?:\s+of)?|user)\s+(.+)$/i,
    ))
  ) {
    return { type: 'user.deactivate', match: m[1]!.trim() };
  }
  // Module switch: "أوقف التقارير اليومية" / "turn on messages".
  if (
    (m = n.match(
      /^(اوقف|عطل|الغ|شغل|فعل|turn off|turn on|disable|enable|switch off|switch on)\s+(.+)$/,
    ))
  ) {
    const enabled = /^(شغل|فعل|turn on|enable|switch on)$/.test(m[1]!);
    const target = m[2]!.replace(/^(خاصيه|ميزه|وحده|module|the)\s+/, '');
    const hit = MODULES.find(([, names]) => names.some((x) => target.startsWith(norm(x))));
    if (hit) return { type: 'feature.set', key: hit[0], enabled };
  }
  // Add a class: "أضف فصل العصافير بسعة 15" / "add class Birds capacity 15".
  if (
    (m = raw.match(
      new RegExp(
        `^${ADD}\\s+(?:فصل|فصلا|فصلًا|class)\\s+(.+?)(?:\\s+(?:بسعة|سعة|سعته|capacity|with capacity)\\s+(\\d+))?$`,
        'i',
      ),
    ))
  ) {
    return { type: 'class.create', name: m[1]!.trim(), capacity: m[2] ? Number(m[2]) : 20 };
  }
  // Add a plan: "أضف باقة شهرية بسعر 1500" / "add plan Monthly 1500".
  if (
    (m = raw.match(
      new RegExp(
        `^${ADD}\\s+(?:باقة|باقه|خطة|plan)\\s+(.+?)\\s+(?:بسعر|سعر|price|for|at)?\\s*(\\d+(?:\\.\\d+)?)`,
        'i',
      ),
    ))
  ) {
    const period = /سنوي|year/i.test(raw) ? 'YEARLY' : /فصلي|term/i.test(raw) ? 'TERM' : 'MONTHLY';
    return { type: 'plan.create', name: m[1]!.trim(), price: Number(m[2]), period };
  }
  // Add a person: "أضف معلمة اسمها سارة العتيبي sara@x.com 0501234567 في فصل العصافير".
  if (
    (m = raw.match(
      new RegExp(
        `^${ADD}\\s+(معلمة|معلمه|معلم|موظفة|موظف|مديرة|مدير|ولي أمر|ولي امر|teacher|staff|manager|parent|guardian)\\s+(.+)$`,
        'i',
      ),
    ))
  ) {
    const role = roleWord(m[1]!);
    let rest = m[2]!;
    const email = rest.match(EMAIL)?.[0];
    if (email) rest = rest.replace(email, ' ');
    const phoneRaw = rest.match(PHONE)?.[0];
    if (phoneRaw) rest = rest.replace(phoneRaw, ' ');
    let classNames: string[] = [];
    // "في فصل Panda Class" keeps the full name; only English "to the Birds class" drops the word.
    const cls =
      rest.match(/(?:to the|in the)\s+(.+?)\s+class$/i) ??
      rest.match(/(?:في فصل|بفصل|لفصل|في الفصل|in class|to class)\s+(.+?)$/i);
    if (cls) {
      classNames = cls[1]!
        .split(/[،,و]\s*|\s+and\s+/)
        .map((x) => x.trim())
        .filter(Boolean);
      rest = rest.slice(0, cls.index);
    }
    const fullName = rest
      .replace(/^(?:اسمها|اسمه|باسم|named|called)\s+/i, '')
      .replace(/\s+(?:بريدها|بريده|جوالها|جواله|email|phone)\s*$/i, '')
      .replace(/\s+/g, ' ')
      .trim();
    if (!role || !fullName) return null;
    return {
      type: 'user.create',
      role,
      fullName,
      email: email?.toLowerCase(),
      phone: phoneOf(phoneRaw),
      classNames,
    };
  }
  return null;
}

/** "الاسم: سارة" style blocks → one table (header from the keys). */
function readCards(text: string) {
  const blocks = text
    .split(/\n\s*\n/)
    .map((b) => b.split('\n').map((l) => l.match(/^\s*([^:：]{1,40})[:：]\s*(.+)$/)))
    .filter((lines) => lines.length >= 2 && lines.every(Boolean));
  if (blocks.length === 0) return null;
  const keys: string[] = [];
  for (const lines of blocks)
    for (const l of lines) if (!keys.includes(l![1]!.trim())) keys.push(l![1]!.trim());
  const cell = (v: string) => `"${v.replace(/"/g, '""')}"`;
  const rows = blocks.map((lines) =>
    keys.map((k) => cell(lines.find((l) => l![1]!.trim() === k)?.[2]?.trim() ?? '')).join(','),
  );
  return readTable([keys.map(cell).join(','), ...rows].join('\n'));
}

export interface TextReading {
  operations: AssistantOp[];
  warnings: string[];
}

/** Reads a chat message: "key: value" cards, else one instruction per line. */
export function readText(text: string): TextReading {
  const cards = readCards(text);
  if (cards && cards.operations.length + cards.warnings.length > 0) return cards;
  const operations: AssistantOp[] = [];
  const warnings: string[] = [];
  for (const line of text
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)) {
    const op = readCommand(line);
    if (op) operations.push(op);
    else warnings.push(`not_understood: ${line.slice(0, 80)}`);
  }
  return { operations, warnings };
}
