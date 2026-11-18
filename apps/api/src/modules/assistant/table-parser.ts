import type { AssistantOp } from '@latif/shared';

/**
 * Rule-based reader for CSV / TSV / pasted spreadsheet rows (Arabic or English headers).
 * No AI involved: each row becomes one proposed operation, or a warning explaining why not.
 */

/** RFC 4180-ish parser; the delimiter is detected from the header line (, ; tab). */
export function parseDelimited(text: string): string[][] {
  const clean = (text.charCodeAt(0) === 0xfeff ? text.slice(1) : text).replace(/\r\n?/g, '\n');
  const firstLine = clean.split('\n').find((l) => l.trim()) ?? '';
  const delimiter = [',', '\t', ';', '|'].reduce(
    (best, d) => (firstLine.split(d).length > firstLine.split(best).length ? d : best),
    ',',
  );
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = '';
  let quoted = false;
  for (let i = 0; i < clean.length; i++) {
    const c = clean[i]!;
    if (quoted) {
      if (c === '"' && clean[i + 1] === '"') {
        cell += '"';
        i++;
      } else if (c === '"') quoted = false;
      else cell += c;
    } else if (c === '"' && cell === '') quoted = true;
    else if (c === delimiter) {
      row.push(cell.trim());
      cell = '';
    } else if (c === '\n') {
      row.push(cell.trim());
      if (row.some((x) => x)) rows.push(row);
      row = [];
      cell = '';
    } else cell += c;
  }
  row.push(cell.trim());
  if (row.some((x) => x)) rows.push(row);
  return rows;
}

/** Does pasted text look like a table (header + at least one row, 2+ columns)? */
export function looksTabular(text: string): boolean {
  const rows = parseDelimited(text);
  return rows.length >= 2 && rows[0]!.length >= 2 && rows.slice(1).every((r) => r.length >= 2);
}

type Field =
  | 'type'
  | 'branch'
  | 'name'
  | 'childName'
  | 'gender'
  | 'birthDate'
  | 'className'
  | 'classNames'
  | 'guardianName'
  | 'guardianPhone'
  | 'guardianEmail'
  | 'relationship'
  | 'email'
  | 'phone'
  | 'role'
  | 'capacity'
  | 'price'
  | 'period'
  | 'medical';

const norm = (s: string) =>
  s
    .toLowerCase()
    .replace(/[ً-ْ]/g, '') // Arabic diacritics
    .replace(/[أإآ]/g, 'ا')
    .replace(/ة/g, 'ه')
    .replace(/[_\-.:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

// Order matters: more specific headers first (e.g. "guardian phone" before "phone").
const HEADERS: [Field, string[]][] = [
  ['type', ['type', 'kind', 'نوع', 'النوع']],
  ['branch', ['branch', 'فرع', 'الفرع']],
  [
    'guardianPhone',
    [
      'guardian phone',
      'parent phone',
      'mother phone',
      'father phone',
      'جوال ولي الامر',
      'هاتف ولي الامر',
      'رقم ولي الامر',
      'جوال الام',
      'جوال الاب',
    ],
  ],
  ['guardianEmail', ['guardian email', 'parent email', 'بريد ولي الامر', 'ايميل ولي الامر']],
  [
    'guardianName',
    [
      'guardian',
      'guardian name',
      'parent',
      'parent name',
      'ولي الامر',
      'اسم ولي الامر',
      'الام',
      'الاب',
    ],
  ],
  ['relationship', ['relationship', 'relation', 'صله القرابه', 'القرابه', 'الصله']],
  [
    'childName',
    [
      'child',
      'child name',
      'student',
      'student name',
      'kid',
      'اسم الطفل',
      'الطفل',
      'اسم الطالب',
      'الطالب',
    ],
  ],
  [
    'birthDate',
    ['birth date', 'birthdate', 'dob', 'date of birth', 'birthday', 'تاريخ الميلاد', 'الميلاد'],
  ],
  ['gender', ['gender', 'sex', 'الجنس', 'جنس']],
  ['classNames', ['classes', 'الفصول']],
  [
    'className',
    ['class', 'class name', 'classroom', 'group', 'الفصل', 'فصل', 'اسم الفصل', 'المجموعه'],
  ],
  ['email', ['email', 'e mail', 'mail', 'البريد', 'البريد الالكتروني', 'الايميل', 'ايميل']],
  [
    'phone',
    ['phone', 'mobile', 'phone number', 'الجوال', 'جوال', 'الهاتف', 'رقم الجوال', 'الموبايل'],
  ],
  ['role', ['role', 'position', 'job', 'الدور', 'الوظيفه', 'المسمى']],
  ['capacity', ['capacity', 'seats', 'السعه', 'العدد']],
  ['price', ['price', 'amount', 'fee', 'fees', 'السعر', 'المبلغ', 'الرسوم']],
  ['period', ['period', 'billing', 'المده', 'الفتره']],
  [
    'medical',
    ['medical', 'medical notes', 'allergies', 'notes', 'ملاحظات', 'ملاحظات طبيه', 'الحساسيه'],
  ],
  ['name', ['name', 'full name', 'fullname', 'الاسم', 'الاسم الكامل', 'اسم']],
];

export function mapHeaders(header: string[]): (Field | null)[] {
  const used = new Set<Field>();
  return header.map((h) => {
    const n = norm(h);
    const hit =
      HEADERS.find(([f, names]) => !used.has(f) && names.some((x) => norm(x) === n)) ??
      HEADERS.find(([f, names]) => !used.has(f) && names.some((x) => n.includes(norm(x))));
    if (!hit) return null;
    used.add(hit[0]);
    return hit[0];
  });
}

const includesAny = (v: string, words: string[]) => words.some((w) => norm(v).includes(norm(w)));

function kindOf(type: string | undefined, has: (f: Field) => boolean) {
  if (type) {
    if (includesAny(type, ['child', 'kid', 'student', 'طفل', 'طالب'])) return 'child';
    if (includesAny(type, ['class', 'فصل'])) return 'class';
    if (includesAny(type, ['plan', 'package', 'باقه', 'خطه', 'اشتراك'])) return 'plan';
    if (includesAny(type, ['manager', 'مدير'])) return 'MANAGER';
    if (includesAny(type, ['parent', 'guardian', 'ولي'])) return 'PARENT';
    if (includesAny(type, ['teacher', 'staff', 'معلم', 'موظف'])) return 'STAFF';
  }
  if (has('birthDate') || has('childName')) return 'child';
  if (has('price')) return 'plan';
  if (has('capacity') && !has('email') && !has('phone')) return 'class';
  if (has('email') || has('phone') || has('role')) return 'user';
  return null;
}

const roleOf = (v: string | undefined): 'MANAGER' | 'STAFF' | 'PARENT' => {
  if (v && includesAny(v, ['manager', 'مدير'])) return 'MANAGER';
  if (v && includesAny(v, ['parent', 'guardian', 'ولي'])) return 'PARENT';
  return 'STAFF';
};

export const genderOf = (v: string | undefined): 'MALE' | 'FEMALE' | null => {
  if (!v) return null;
  const n = norm(v);
  if (['f', 'female', 'girl', 'انثى', 'انثي', 'بنت'].includes(n) || n.startsWith('fem'))
    return 'FEMALE';
  if (['m', 'male', 'boy', 'ذكر', 'ولد', 'ابن'].includes(n)) return 'MALE';
  return null;
};

/** YYYY-MM-DD, DD/MM/YYYY, YYYY/MM/DD (Western or Arabic-Indic digits). */
export function dateOf(v: string | undefined): string | null {
  if (!v) return null;
  const s = v.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).trim();
  let y: number, m: number, d: number;
  let r = s.match(/^(\d{4})[-/.](\d{1,2})[-/.](\d{1,2})/);
  if (r) [y, m, d] = [+r[1]!, +r[2]!, +r[3]!];
  else if ((r = s.match(/^(\d{1,2})[-/.](\d{1,2})[-/.](\d{4})/)))
    [d, m, y] = [+r[1]!, +r[2]!, +r[3]!];
  else return null;
  const dt = new Date(Date.UTC(y, m - 1, d));
  if (dt.getUTCMonth() !== m - 1 || y < 1990 || y > 2100) return null;
  return dt.toISOString().slice(0, 10);
}

/** Saudi local numbers (05XXXXXXXX / 5XXXXXXXX / 9665…) → +9665XXXXXXXX; others kept. */
export function phoneOf(v: string | undefined): string | undefined {
  if (!v) return undefined;
  const digits = v.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[^\d+]/g, '');
  if (!digits) return undefined;
  if (/^05\d{8}$/.test(digits)) return `+966${digits.slice(1)}`;
  if (/^5\d{8}$/.test(digits)) return `+966${digits}`;
  if (/^9665\d{8}$/.test(digits)) return `+${digits}`;
  if (/^00\d+$/.test(digits)) return `+${digits.slice(2)}`;
  return digits;
}

const periodOf = (v: string | undefined): 'MONTHLY' | 'TERM' | 'YEARLY' => {
  if (v && includesAny(v, ['year', 'annual', 'سنوي', 'سنه'])) return 'YEARLY';
  if (v && includesAny(v, ['term', 'semester', 'quarter', 'فصلي', 'ترم'])) return 'TERM';
  return 'MONTHLY';
};

const numOf = (v: string | undefined) => {
  if (!v) return null;
  const n = Number(
    v.replace(/[٠-٩]/g, (d) => String('٠١٢٣٤٥٦٧٨٩'.indexOf(d))).replace(/[^\d.]/g, ''),
  );
  return Number.isFinite(n) && v.trim() !== '' ? n : null;
};

export interface TableReading {
  operations: AssistantOp[];
  /** Row-level problems, as i18n-free short codes + row numbers: "row 3: missing_birth_date". */
  warnings: string[];
  rows: number;
}

/** Turns a table into proposed operations (one per row). */
export function readTable(text: string): TableReading {
  const rows = parseDelimited(text);
  const warnings: string[] = [];
  const operations: AssistantOp[] = [];
  if (rows.length < 2) return { operations, warnings: ['no_rows'], rows: 0 };
  const fields = mapHeaders(rows[0]!);
  if (fields.every((f) => f === null))
    return { operations, warnings: ['unknown_columns'], rows: 0 };
  rows.slice(1).forEach((cells, i) => {
    const rowNo = i + 2;
    const get = (f: Field) => {
      const idx = fields.indexOf(f);
      const v = idx >= 0 ? cells[idx]?.trim() : undefined;
      return v ? v : undefined;
    };
    const has = (f: Field) => fields.includes(f) && Boolean(get(f));
    const branch = get('branch');
    const warn = (code: string) => warnings.push(`row ${rowNo}: ${code}`);
    const kind = kindOf(get('type'), has);
    if (kind === 'child') {
      const fullName = get('childName') ?? get('name');
      const birthDate = dateOf(get('birthDate'));
      const gender = genderOf(get('gender'));
      const guardianName = get('guardianName');
      const guardianPhone = phoneOf(
        get('guardianPhone') ?? (has('childName') ? get('phone') : undefined),
      );
      const guardianEmail = get('guardianEmail') ?? (has('childName') ? get('email') : undefined);
      if (!fullName) return warn('missing_name');
      if (!birthDate) return warn('missing_birth_date');
      if (!gender) return warn('missing_gender');
      if (!guardianName) return warn('missing_guardian');
      if (!guardianPhone && !guardianEmail) return warn('missing_guardian_contact');
      operations.push({
        type: 'child.create',
        branch,
        fullName,
        gender,
        birthDate,
        className: get('className'),
        guardianName,
        guardianRelationship: get('relationship') ?? 'ولي أمر',
        guardianPhone,
        guardianEmail: guardianEmail?.toLowerCase(),
        medicalNotes: get('medical'),
      });
    } else if (kind === 'class') {
      const name = get('className') ?? get('name');
      if (!name) return warn('missing_name');
      operations.push({
        type: 'class.create',
        branch,
        name,
        capacity: Math.min(200, Math.max(1, numOf(get('capacity')) ?? 20)),
      });
    } else if (kind === 'plan') {
      const name = get('name');
      const price = numOf(get('price'));
      if (!name) return warn('missing_name');
      if (price === null) return warn('missing_price');
      operations.push({
        type: 'plan.create',
        branch,
        name,
        price,
        period: periodOf(get('period')),
      });
    } else if (kind) {
      const fullName = get('name');
      const email = get('email')?.toLowerCase();
      const phone = phoneOf(get('phone'));
      if (!fullName) return warn('missing_name');
      if (!email && !phone) return warn('missing_contact');
      const classes = (get('classNames') ?? get('className') ?? '')
        .split(/[،,;|/]+/)
        .map((x) => x.trim())
        .filter(Boolean);
      operations.push({
        type: 'user.create',
        branch,
        role: kind === 'user' ? roleOf(get('role')) : kind,
        fullName,
        email,
        phone,
        classNames: classes,
      });
    } else warn('unknown_row');
  });
  return { operations, warnings, rows: rows.length - 1 };
}
