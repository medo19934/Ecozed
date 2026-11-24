import {
  Body,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiExcludeController } from '@nestjs/swagger';
import type { RawBodyRequest } from '@nestjs/common';
import type { Request } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import { Public } from '../../common/decorators/auth.decorators';
import { AppConfig } from '../../config/app-config.service';
import { WhatsAppClient } from './whatsapp.client';
import { WhatsAppService } from './whatsapp.service';

/** WhatsApp Cloud API webhook + a local simulator (WHATSAPP_SIMULATOR=true only). */
@ApiExcludeController()
@Public()
@Controller('whatsapp')
export class WhatsAppController {
  constructor(
    private readonly wa: WhatsAppService,
    private readonly client: WhatsAppClient,
    private readonly config: AppConfig,
  ) {}

  /** Meta's one-time webhook verification. */
  @Get('webhook')
  verify(
    @Query('hub.mode') mode: string,
    @Query('hub.verify_token') token: string,
    @Query('hub.challenge') challenge: string,
  ) {
    const expected = this.config.get('WHATSAPP_VERIFY_TOKEN');
    if (mode !== 'subscribe' || !expected || token !== expected) throw new ForbiddenException();
    return challenge;
  }

  /** Incoming messages. Signed by Meta with the app secret (X-Hub-Signature-256). */
  @HttpCode(200)
  @Post('webhook')
  async webhook(@Req() req: RawBodyRequest<Request>, @Body() body: unknown) {
    const secret = this.config.get('WHATSAPP_APP_SECRET');
    if (!secret) throw new ForbiddenException({ code: 'whatsapp_not_configured' });
    const sig = String(req.headers['x-hub-signature-256'] ?? '');
    const mac = `sha256=${createHmac('sha256', secret)
      .update(req.rawBody ?? Buffer.alloc(0))
      .digest('hex')}`;
    if (sig.length !== mac.length || !timingSafeEqual(Buffer.from(sig), Buffer.from(mac))) {
      throw new UnauthorizedException({ code: 'bad_signature' });
    }
    await this.wa.handleWebhook(body);
    return { ok: true };
  }

  /** Local testing: pretend a WhatsApp text arrived from `from`, return the agent's replies. */
  @HttpCode(200)
  @Post('simulate')
  async simulate(@Body() body: { from: string; text: string }) {
    if (!this.config.get('WHATSAPP_SIMULATOR')) throw new ForbiddenException();
    const before = this.client.outbox.length;
    await this.wa.handleWebhook({
      entry: [
        {
          changes: [
            {
              value: {
                messages: [
                  {
                    id: `sim-${Date.now()}-${Math.random()}`,
                    from: body.from,
                    type: 'text',
                    text: { body: body.text },
                  },
                ],
              },
            },
          ],
        },
      ],
    });
    return { replies: this.client.outbox.slice(before).map((m) => m.text) };
  }
}
