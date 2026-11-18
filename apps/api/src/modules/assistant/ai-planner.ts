import Anthropic from '@anthropic-ai/sdk';
import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { AssistantOpSchema, FeatureToggle, type AssistantOp } from '@latif/shared';
import { z } from 'zod';
import { AppConfig } from '../../config/app-config.service';

type Json = Record<string, unknown>;

/**
 * JSON schema for structured outputs: every object closed (additionalProperties false), every
 * property required, optional ones nullable. Range/format keywords are dropped — the result is
 * validated again with the shared zod schema before anything is shown or applied.
 */
export function toStrictSchema(node: unknown): unknown {
  if (Array.isArray(node)) return node.map(toStrictSchema);
  if (!node || typeof node !== 'object') return node;
  const src = node as Json;
  const out: Json = {};
  for (const [k, v] of Object.entries(src)) {
    if (
      [
        '$schema',
        'default',
        'minLength',
        'maxLength',
        'minimum',
        'maximum',
        'minItems',
        'maxItems',
        'pattern',
        'format',
        'exclusiveMinimum',
        'exclusiveMaximum',
      ].includes(k)
    )
      continue;
    out[k === 'oneOf' ? 'anyOf' : k] = toStrictSchema(v);
  }
  if (out.type === 'object' && out.properties) {
    const props = out.properties as Json;
    const required = new Set((src.required as string[] | undefined) ?? []);
    for (const key of Object.keys(props)) {
      if (!required.has(key)) props[key] = { anyOf: [props[key], { type: 'null' }] };
    }
    out.required = Object.keys(props);
    out.additionalProperties = false;
  }
  return out;
}

const OUTPUT_SCHEMA = toStrictSchema({
  type: 'object',
  properties: {
    reply: { type: 'string' },
    operations: { type: 'array', items: z.toJSONSchema(AssistantOpSchema, { io: 'input' }) },
  },
  required: ['reply', 'operations'],
}) as Json;

const dropNulls = (v: unknown): unknown =>
  Array.isArray(v)
    ? v.map(dropNulls)
    : v && typeof v === 'object'
      ? Object.fromEntries(
          Object.entries(v as Json)
            .filter(([, x]) => x !== null)
            .map(([k, x]) => [k, dropNulls(x)]),
        )
      : v;

export interface PlannerContext {
  locale: 'ar' | 'en';
  today: string;
  activeBranch: string | null;
  /** Branches the admin may change (managers: only their own). */
  branches: string[];
  classes: string[];
}

export interface AiPlan {
  reply: string;
  operations: AssistantOp[];
  /** Operations Claude proposed that failed validation (dropped). */
  invalid: number;
}

const SYSTEM = `You turn a daycare administrator's message into data-entry operations for the "Latif Kids" platform.
Return a short reply (same language as the user, 1-3 sentences) and the list of operations.

Rules:
- Only propose operations the message clearly asks for. Never invent people, phone numbers, emails or dates.
- If something required is missing (for a child: birth date, gender, a guardian name and phone or email; for a user: email or phone), do not guess: leave that item out and ask for it in the reply.
- "branch": leave null for the active branch; otherwise use a branch name exactly as listed in the context.
- Class names should match existing classes when the user means one of them; a new class needs a class.create operation first.
- Dates are YYYY-MM-DD. Saudi mobile numbers may be written 05XXXXXXXX.
- Roles: MANAGER = branch manager, STAFF = teacher or staff member, PARENT = parent / guardian.
- Feature keys: ${Object.values(FeatureToggle).join(', ')}.
- Plan periods: MONTHLY, TERM, YEARLY. Prices are in SAR.
- To change a person, use user.update or user.deactivate with "match" set to their email, phone or full name.
- Nothing is saved by you: the administrator reviews the list and confirms it. Do not claim that changes were made.
- If the message is a question or small talk, answer briefly with an empty operations list.`;

/** Free-text → operations, via the Claude API (only when ANTHROPIC_API_KEY is configured). */
@Injectable()
export class AiPlanner {
  private readonly log = new Logger(AiPlanner.name);
  private client: Anthropic | null = null;

  constructor(private readonly config: AppConfig) {}

  get enabled(): boolean {
    return Boolean(this.config.get('ANTHROPIC_API_KEY'));
  }

  private api(): Anthropic {
    this.client ??= new Anthropic({ apiKey: this.config.get('ANTHROPIC_API_KEY') });
    return this.client;
  }

  async plan(
    message: string,
    history: { role: 'user' | 'assistant'; text: string }[],
    ctx: PlannerContext,
  ): Promise<AiPlan> {
    if (!this.enabled) throw new ServiceUnavailableException({ code: 'ai_not_configured' });
    const context = [
      `Today: ${ctx.today}. Reply language: ${ctx.locale === 'ar' ? 'Arabic' : 'English'}.`,
      `Active branch: ${ctx.activeBranch ?? 'none'}.`,
      `Branches you may use: ${ctx.branches.join(' | ') || 'none'}.`,
      `Existing classes in the active branch: ${ctx.classes.join(' | ') || 'none'}.`,
    ].join('\n');
    const messages: Anthropic.Beta.BetaMessageParam[] = [
      ...history.map((h) => ({ role: h.role, content: h.text })),
      { role: 'user', content: `${context}\n\n---\n${message}` },
    ];
    // Conversation must start with a user turn.
    while (messages[0]?.role === 'assistant') messages.shift();
    let response: Anthropic.Beta.BetaMessage;
    try {
      response = await this.api().beta.messages.create({
        model: this.config.get('ASSISTANT_MODEL'),
        max_tokens: 16000,
        system: SYSTEM,
        messages,
        output_config: { effort: 'medium', format: { type: 'json_schema', schema: OUTPUT_SCHEMA } },
        // If the main model declines, the API retries on a fallback model in the same call.
        betas: ['server-side-fallback-2026-07-01'],
        fallbacks: 'default',
      });
    } catch (e) {
      if (e instanceof Anthropic.AuthenticationError) {
        throw new ServiceUnavailableException({ code: 'ai_bad_key' });
      }
      if (e instanceof Anthropic.RateLimitError) {
        throw new ServiceUnavailableException({ code: 'ai_busy' });
      }
      if (e instanceof Anthropic.APIError) {
        this.log.warn(`Claude API ${e.status}: ${e.message}`);
        throw new ServiceUnavailableException({ code: 'ai_failed' });
      }
      throw e;
    }
    if (response.stop_reason === 'refusal') {
      return { reply: '', operations: [], invalid: 0 };
    }
    const text = response.content
      .map((b) => (b.type === 'text' ? b.text : ''))
      .join('')
      .trim();
    let parsed: { reply?: unknown; operations?: unknown };
    try {
      parsed = JSON.parse(text) as typeof parsed;
    } catch {
      this.log.warn(`Unparseable assistant output (stop_reason ${response.stop_reason})`);
      throw new ServiceUnavailableException({ code: 'ai_failed' });
    }
    const operations: AssistantOp[] = [];
    let invalid = 0;
    for (const raw of Array.isArray(parsed.operations) ? parsed.operations : []) {
      const op = AssistantOpSchema.safeParse(dropNulls(raw));
      if (op.success) operations.push(op.data);
      else invalid++;
    }
    return { reply: typeof parsed.reply === 'string' ? parsed.reply : '', operations, invalid };
  }
}
