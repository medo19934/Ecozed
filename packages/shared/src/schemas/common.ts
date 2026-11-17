import { z } from 'zod';
import { PAGINATION } from '../constants';

export const IdSchema = z.uuid();

export const PaginationQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce
    .number()
    .int()
    .min(1)
    .max(PAGINATION.MAX_PAGE_SIZE)
    .default(PAGINATION.DEFAULT_PAGE_SIZE),
  search: z.string().trim().max(200).optional(),
  sort: z.string().max(50).optional(),
  order: z.enum(['asc', 'desc']).default('desc'),
});
export type PaginationQuery = z.infer<typeof PaginationQuerySchema>;

/** Saudi-friendly phone normalisation: "05XXXXXXXX" / "5XXXXXXXX" → "+9665XXXXXXXX". */
export const normalizePhone = (raw: string): string => {
  const v = raw.replace(/[\s()-]/g, '').replace(/[٠-٩]/g, (d) => String(d.charCodeAt(0) - 0x0660));
  if (/^05\d{8}$/.test(v)) return `+966${v.slice(1)}`;
  if (/^5\d{8}$/.test(v)) return `+966${v}`;
  if (/^9665\d{8}$/.test(v)) return `+${v}`;
  if (/^00\d+$/.test(v)) return `+${v.slice(2)}`;
  return v;
};

/** E.164-ish phone, e.g. +966501234567 (local 05… numbers are accepted and normalised). */
export const PhoneSchema = z
  .string()
  .trim()
  .transform(normalizePhone)
  .pipe(z.string().regex(/^\+[1-9]\d{6,14}$/, 'invalid_phone'));

export const EmailSchema = z.string().trim().toLowerCase().pipe(z.email());
