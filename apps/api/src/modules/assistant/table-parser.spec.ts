import { AssistantOpSchema } from '@latif/shared';
import { z } from 'zod';
import { toStrictSchema } from './ai-planner';
import { dateOf, genderOf, looksTabular, parseDelimited, phoneOf, readTable } from './table-parser';

describe('assistant table reader', () => {
  it('parses quoted CSV, TSV and semicolons', () => {
    expect(parseDelimited('a,b\n"x, y","q ""z"""')).toEqual([
      ['a', 'b'],
      ['x, y', 'q "z"'],
    ]);
    expect(parseDelimited('a\tb\n1\t2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ]);
    expect(parseDelimited('a;b\n1;2')[1]).toEqual(['1', '2']);
    expect(looksTabular('name,email\nSara,s@x.com')).toBe(true);
    expect(looksTabular('Add a teacher called Sara')).toBe(false);
  });

  it('normalises dates, genders and Saudi phones', () => {
    expect(dateOf('2022-03-05')).toBe('2022-03-05');
    expect(dateOf('5/3/2022')).toBe('2022-03-05');
    expect(dateOf('٢٠٢٢/٠٣/٠٥')).toBe('2022-03-05');
    expect(dateOf('31/02/2022')).toBeNull();
    expect(genderOf('أنثى')).toBe('FEMALE');
    expect(genderOf('ذكر')).toBe('MALE');
    expect(genderOf('F')).toBe('FEMALE');
    expect(phoneOf('0501234567')).toBe('+966501234567');
    expect(phoneOf('٠٥٠١٢٣٤٥٦٧')).toBe('+966501234567');
    expect(phoneOf('+44 7700 900123')).toBe('+447700900123');
  });

  it('reads an Arabic children sheet, skipping incomplete rows with a reason', () => {
    const csv = [
      'اسم الطفل,الجنس,تاريخ الميلاد,الفصل,ولي الأمر,جوال ولي الأمر,صلة القرابة',
      'ليان,أنثى,2022-01-10,العصافير,أم ليان,0501112223,أم',
      'سعد,ذكر,,العصافير,أبو سعد,0501112224,أب',
      'نورة,أنثى,2021-05-01,,أم نورة,,',
    ].join('\n');
    const r = readTable(csv);
    expect(r.operations).toEqual([
      expect.objectContaining({
        type: 'child.create',
        fullName: 'ليان',
        gender: 'FEMALE',
        birthDate: '2022-01-10',
        className: 'العصافير',
        guardianName: 'أم ليان',
        guardianPhone: '+966501112223',
        guardianRelationship: 'أم',
      }),
    ]);
    expect(r.warnings).toEqual(['row 3: missing_birth_date', 'row 4: missing_guardian_contact']);
  });

  it('reads staff / parents / managers, classes and plans (English or mixed "type" column)', () => {
    const r = readTable(
      [
        'type,name,email,phone,role,class,capacity,price,period,branch',
        'teacher,Sara Ali,SARA@x.com,,,Birds,,,,',
        'manager,Huda,huda@x.com,,,,,,,Al Rayan',
        'parent,Abu Saad,,0500000001,,,,,,',
        'class,Birds,,,,,15,,,',
        'plan,Monthly full day,,,,,,1500,monthly,',
      ].join('\n'),
    );
    expect(r.warnings).toEqual([]);
    expect(r.operations.map((o) => o.type)).toEqual([
      'user.create',
      'user.create',
      'user.create',
      'class.create',
      'plan.create',
    ]);
    expect(r.operations[0]).toMatchObject({
      role: 'STAFF',
      email: 'sara@x.com',
      classNames: ['Birds'],
    });
    expect(r.operations[1]).toMatchObject({ role: 'MANAGER', branch: 'Al Rayan' });
    expect(r.operations[2]).toMatchObject({ role: 'PARENT', phone: '+966500000001' });
    expect(r.operations[3]).toMatchObject({ name: 'Birds', capacity: 15 });
    expect(r.operations[4]).toMatchObject({ price: 1500, period: 'MONTHLY' });
    for (const op of r.operations) expect(AssistantOpSchema.safeParse(op).success).toBe(true);
  });

  it('reports unknown columns instead of guessing', () => {
    expect(readTable('foo,bar\n1,2').warnings).toEqual(['unknown_columns']);
  });
});

describe('assistant structured-output schema', () => {
  it('closes every object and makes every property required (nullable when optional)', () => {
    const schema = toStrictSchema(z.toJSONSchema(AssistantOpSchema, { io: 'input' })) as {
      anyOf: {
        properties: Record<string, unknown>;
        required: string[];
        additionalProperties: boolean;
      }[];
    };
    expect(schema.anyOf.length).toBe(9);
    for (const variant of schema.anyOf) {
      expect(variant.additionalProperties).toBe(false);
      expect(variant.required.sort()).toEqual(Object.keys(variant.properties).sort());
    }
    expect(JSON.stringify(schema)).not.toMatch(/"(minLength|maximum|pattern|format|default)"/);
  });
});
