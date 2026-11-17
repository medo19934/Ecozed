import { Injectable, UnauthorizedException } from '@nestjs/common';
import { OAuth2Client } from 'google-auth-library';
import { AppConfig } from '../../config/app-config.service';
import { csv } from '../../config/env';

export const GOOGLE_VERIFIER = Symbol('GOOGLE_VERIFIER');

export interface GoogleIdentity {
  sub: string;
  email: string;
  name: string;
  picture?: string;
  locale?: string;
}

export interface GoogleVerifier {
  verify(idToken: string): Promise<GoogleIdentity>;
}

/** Verifies Google ID tokens (signature, expiry, audience, verified email). */
@Injectable()
export class GoogleIdTokenVerifier implements GoogleVerifier {
  private readonly client = new OAuth2Client();
  private readonly audiences: string[];

  constructor(config: AppConfig) {
    this.audiences = csv(config.get('GOOGLE_CLIENT_IDS'));
  }

  async verify(idToken: string): Promise<GoogleIdentity> {
    if (!this.audiences.length) {
      throw new UnauthorizedException({
        message: 'Google sign-in is not configured',
        code: 'google_not_configured',
      });
    }
    try {
      const ticket = await this.client.verifyIdToken({ idToken, audience: this.audiences });
      const p = ticket.getPayload();
      if (!p?.sub || !p.email || !p.email_verified) throw new Error('unverified');
      return {
        sub: p.sub,
        email: p.email.toLowerCase(),
        name: p.name ?? p.email.split('@')[0]!,
        picture: p.picture,
        locale: p.locale,
      };
    } catch (e) {
      if (e instanceof UnauthorizedException) throw e;
      throw new UnauthorizedException({
        message: 'Invalid Google token',
        code: 'invalid_google_token',
      });
    }
  }
}
