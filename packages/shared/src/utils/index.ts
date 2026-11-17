import type { Paginated } from '../types';

export const paginate = <T>(
  items: T[],
  total: number,
  page: number,
  pageSize: number,
): Paginated<T> => ({
  items,
  total,
  page,
  pageSize,
  totalPages: Math.max(1, Math.ceil(total / pageSize)),
});

/** Age as { years, months } at `at` (default now). */
export const ageParts = (birthDate: Date, at: Date = new Date()) => {
  let months =
    (at.getFullYear() - birthDate.getFullYear()) * 12 + (at.getMonth() - birthDate.getMonth());
  if (at.getDate() < birthDate.getDate()) months -= 1;
  months = Math.max(0, months);
  return { years: Math.floor(months / 12), months: months % 12 };
};
export * from './menus';
