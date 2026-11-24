import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.service';

const GRAPH = 'https://graph.facebook.com/v21.0';

export interface OutboxMessage {
  to: string;
  text: string;
  at: string;
}

/**
 * Talks to the WhatsApp Cloud API. Without WHATSAPP_TOKEN (local testing) replies go to an
 * in-memory outbox instead, so the agent can be tried with the simulator.
 */
@Injectable()
export class WhatsAppClient {
  private readonly log = new Logger(WhatsAppClient.name);
  readonly outbox: OutboxMessage[] = [];

  constructor(private readonly config: AppConfig) {}

  get live(): boolean {
    return Boolean(
      this.config.get('WHATSAPP_TOKEN') && this.config.get('WHATSAPP_PHONE_NUMBER_ID'),
    );
  }

  async send(to: string, text: string): Promise<void> {
    // WhatsApp text messages are limited to 4096 characters.
    const body = text.length > 4000 ? `${text.slice(0, 3990)}…` : text;
    if (!this.live) {
      this.outbox.push({ to, text: body, at: new Date().toISOString() });
      if (this.outbox.length > 200) this.outbox.shift();
      return;
    }
    const res = await fetch(`${GRAPH}/${this.config.get('WHATSAPP_PHONE_NUMBER_ID')}/messages`, {
      method: 'POST',
      headers: {
        authorization: `Bearer ${this.config.get('WHATSAPP_TOKEN')}`,
        'content-type': 'application/json',
      },
      body: JSON.stringify({ messaging_product: 'whatsapp', to, type: 'text', text: { body } }),
    });
    if (!res.ok)
      this.log.warn(`WhatsApp send failed ${res.status}: ${(await res.text()).slice(0, 200)}`);
  }

  /** Downloads a voice note (media id → bytes). */
  async media(mediaId: string): Promise<{ bytes: Buffer; mime: string } | null> {
    if (!this.live) return null;
    const auth = { authorization: `Bearer ${this.config.get('WHATSAPP_TOKEN')}` };
    const meta = await fetch(`${GRAPH}/${mediaId}`, { headers: auth });
    if (!meta.ok) return null;
    const { url, mime_type } = (await meta.json()) as { url: string; mime_type: string };
    const file = await fetch(url, { headers: auth });
    if (!file.ok) return null;
    return { bytes: Buffer.from(await file.arrayBuffer()), mime: mime_type };
  }
}
