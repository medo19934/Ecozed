import { Injectable, Logger } from '@nestjs/common';

export const OTP_SENDER = Symbol('OTP_SENDER');

/** Delivery channel for OTP codes (SMS/WhatsApp/email). Real providers land in Phase 6. */
export interface OtpSender {
  send(identifier: string, code: string, purpose: string): Promise<void>;
}

@Injectable()
export class LoggingOtpSender implements OtpSender {
  private readonly logger = new Logger('OtpSender');

  async send(identifier: string, code: string, purpose: string): Promise<void> {
    const masked = identifier.replace(/.(?=.{3})/g, '*');
    this.logger.log(`OTP ${purpose} for ${masked}: ${code}`);
  }
}
