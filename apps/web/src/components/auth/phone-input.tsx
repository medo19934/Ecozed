'use client';

import { DEFAULT_COUNTRY_CODE } from '@latif/shared';
import { useState } from 'react';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';

const CODES = ['+966', '+971', '+965', '+973', '+974', '+968', '+962', '+20', '+212', '+1', '+44'];

const split = (value: string) => {
  const code = CODES.find((c) => value.startsWith(c)) ?? DEFAULT_COUNTRY_CODE;
  return { code, national: value.startsWith(code) ? value.slice(code.length) : '' };
};

/** Country code select + national number, emitting E.164 (e.g. +966501234567). */
export function PhoneInput({
  id,
  value,
  onChange,
  invalid,
  describedBy,
  codeLabel,
}: {
  id: string;
  value: string;
  onChange: (v: string) => void;
  invalid?: boolean;
  describedBy?: string;
  codeLabel: string;
}) {
  const [{ code, national }, setParts] = useState(() => split(value));
  const emit = (c: string, n: string) => {
    const digits = n.replace(/\D/g, '').replace(/^0+/, '');
    setParts({ code: c, national: n });
    onChange(digits ? `${c}${digits}` : '');
  };

  return (
    <div dir="ltr" className="flex gap-2">
      <select
        aria-label={codeLabel}
        value={code}
        onChange={(e) => emit(e.target.value, national)}
        className={cn(
          'h-11 rounded-xl border border-input bg-card px-2 text-sm outline-none focus-visible:ring-[3px] focus-visible:ring-ring/30',
        )}
      >
        {CODES.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>
      <Input
        id={id}
        type="tel"
        inputMode="tel"
        autoComplete="tel-national"
        placeholder="5X XXX XXXX"
        value={national}
        aria-invalid={invalid || undefined}
        aria-describedby={describedBy}
        onChange={(e) => emit(code, e.target.value)}
      />
    </div>
  );
}
