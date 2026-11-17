import type { z } from 'zod';

/** Flattens zod issues to { "path.to.field": "message_code" } (first issue per path). */
export const issuesByPath = (error: z.ZodError): Record<string, string> => {
  const out: Record<string, string> = {};
  for (const i of error.issues) {
    const key = i.path.join('.');
    if (!(key in out)) out[key] = i.message;
  }
  return out;
};
