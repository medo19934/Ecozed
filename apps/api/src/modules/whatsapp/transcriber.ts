import { Injectable, Logger } from '@nestjs/common';
import { AppConfig } from '../../config/app-config.service';

/** Voice note → Arabic text with ElevenLabs speech-to-text (optional; needs ELEVENLABS_API_KEY). */
@Injectable()
export class Transcriber {
  private readonly log = new Logger(Transcriber.name);

  constructor(private readonly config: AppConfig) {}

  get enabled(): boolean {
    return Boolean(this.config.get('ELEVENLABS_API_KEY'));
  }

  async toText(bytes: Buffer, mime: string): Promise<string | null> {
    if (!this.enabled) return null;
    const form = new FormData();
    form.append('model_id', 'scribe_v1');
    form.append('language_code', 'ara');
    form.append('file', new Blob([new Uint8Array(bytes)], { type: mime }), 'voice.ogg');
    const res = await fetch('https://api.elevenlabs.io/v1/speech-to-text', {
      method: 'POST',
      headers: { 'xi-api-key': this.config.get('ELEVENLABS_API_KEY') },
      body: form,
    });
    if (!res.ok) {
      this.log.warn(`Speech-to-text failed ${res.status}`);
      return null;
    }
    const { text } = (await res.json()) as { text?: string };
    return text?.trim() || null;
  }
}
