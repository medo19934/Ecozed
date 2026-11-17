'use client';

import { useTranslations } from 'next-intl';
import { useState } from 'react';
import type { z } from 'zod';
import { issuesByPath } from './zod-errors';

/** Client-side zod validation with localized messages (falls back to "required"). */
export function useFieldErrors() {
  const te = useTranslations('errors');
  const tc = useTranslations('common');
  const [errors, setErrors] = useState<Record<string, string>>({});
  const validate = <S extends z.ZodType>(schema: S, value: unknown): z.infer<S> | null => {
    const r = schema.safeParse(value);
    if (r.success) {
      setErrors({});
      return r.data;
    }
    const raw = issuesByPath(r.error);
    setErrors(
      Object.fromEntries(
        Object.entries(raw).map(([k, code]) => [
          k,
          te.has(code as never) ? te(code as never) : tc('required'),
        ]),
      ),
    );
    return null;
  };
  return { errors, validate, setErrors };
}
