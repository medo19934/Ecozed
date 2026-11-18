import { z } from 'zod';
import { FeatureToggleSchema } from '../enums';
import { PlanPeriodSchema } from './finance';

/**
 * Smart assistant: a chat message or CSV becomes a list of operations.
 * Operations are only a proposal — the admin reviews them, then they are applied one by one
 * through the normal services (same permissions, Row Level Security and audit log).
 */
const name = z.string().trim().min(1).max(120);
const optText = (max: number) => z.string().trim().max(max).optional();
/** Branch name (general admin only); omitted = the active branch. */
const branch = optText(120);

export const AssistantOpSchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('class.create'),
    branch,
    name: z.string().trim().min(1).max(80),
    capacity: z.number().int().min(1).max(200).default(20),
    minAgeMonths: z.number().int().min(0).max(144).optional(),
    maxAgeMonths: z.number().int().min(0).max(144).optional(),
  }),
  z.object({
    type: z.literal('user.create'),
    branch,
    role: z.enum(['MANAGER', 'STAFF', 'PARENT']),
    fullName: name,
    email: optText(160),
    phone: optText(20),
    classNames: z.array(z.string().trim().max(80)).max(10).default([]),
  }),
  z.object({
    type: z.literal('user.update'),
    branch,
    /** Email, phone or full name of the person to change. */
    match: name,
    fullName: optText(120),
    phone: optText(20),
    role: z.enum(['MANAGER', 'STAFF', 'PARENT']).optional(),
    classNames: z.array(z.string().trim().max(80)).max(10).optional(),
  }),
  z.object({
    type: z.literal('user.deactivate'),
    branch,
    match: name,
  }),
  z.object({
    type: z.literal('child.create'),
    branch,
    fullName: name,
    gender: z.enum(['MALE', 'FEMALE']),
    birthDate: z.iso.date(),
    className: optText(80),
    guardianName: name,
    guardianRelationship: z.string().trim().min(1).max(40).default('ولي أمر'),
    guardianPhone: optText(20),
    guardianEmail: optText(160),
    medicalNotes: optText(500),
  }),
  z.object({
    type: z.literal('child.move'),
    branch,
    childName: name,
    className: z.string().trim().min(1).max(80),
  }),
  z.object({
    type: z.literal('branch.update'),
    branch,
    name: optText(120),
    nameEn: optText(120),
    phone: optText(20),
    email: optText(160),
    city: optText(80),
    address: optText(300),
  }),
  z.object({
    type: z.literal('feature.set'),
    branch,
    key: FeatureToggleSchema,
    enabled: z.boolean(),
  }),
  z.object({
    type: z.literal('plan.create'),
    branch,
    name: z.string().trim().min(2).max(80),
    price: z.number().min(0).max(1_000_000),
    period: PlanPeriodSchema.default('MONTHLY'),
  }),
]);
export type AssistantOp = z.infer<typeof AssistantOpSchema>;
export type AssistantOpType = AssistantOp['type'];

export const AssistantPlanRequestSchema = z.object({
  message: z.string().trim().max(20_000).default(''),
  /** Raw CSV / TSV text of an attached file (read in the browser). */
  file: z.object({ name: z.string().max(200), text: z.string().max(2_000_000) }).optional(),
});
export type AssistantPlanRequest = z.infer<typeof AssistantPlanRequestSchema>;

export const AssistantApplySchema = z.object({
  operations: z.array(AssistantOpSchema).min(1).max(500),
});
export type AssistantApplyInput = z.infer<typeof AssistantApplySchema>;
