import { z } from 'zod';

export const ThreadKindSchema = z.enum(['CHILD', 'STAFF', 'ANNOUNCEMENT']);
export type ThreadKind = z.infer<typeof ThreadKindSchema>;

export const ThreadListQuerySchema = z.object({
  tab: z.enum(['all', 'staff', 'parents']).default('all'),
  search: z.string().trim().max(100).optional(),
});

export const OpenThreadSchema = z.discriminatedUnion('kind', [
  z.object({ kind: z.literal('CHILD'), childId: z.uuid() }),
  z.object({ kind: z.literal('STAFF'), userId: z.uuid() }),
  z.object({
    kind: z.literal('ANNOUNCEMENT'),
    title: z.string().trim().min(2).max(120),
    classroomId: z.uuid().nullable().optional(),
  }),
]);
export type OpenThreadInput = z.infer<typeof OpenThreadSchema>;

export const SendMessageSchema = z.object({ body: z.string().trim().min(1).max(4000) });
export type SendMessageInput = z.infer<typeof SendMessageSchema>;

export const MessagePageQuerySchema = z.object({ before: z.iso.datetime().optional() });
