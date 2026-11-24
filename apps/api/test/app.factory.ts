import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { AppModule } from '../src/app.module';
import { configureApp } from '../src/bootstrap';
import { GOOGLE_VERIFIER, type GoogleVerifier } from '../src/modules/auth/google-verifier';

/**
 * Fake Google verifier: token format `fake:<email>:<sub>:<name>`.
 * Real verification is covered by google-auth-library; this tests our flows.
 */
export const fakeGoogle: GoogleVerifier = {
  async verify(idToken: string) {
    const [prefix, email, sub, name] = idToken.split(':');
    if (prefix !== 'fake' || !email || !sub) {
      const { UnauthorizedException } = await import('@nestjs/common');
      throw new UnauthorizedException({
        message: 'Invalid Google token',
        code: 'invalid_google_token',
      });
    }
    return { email, sub, name: name ?? email };
  },
};

export const googleToken = (email: string, sub: string, name = 'Test User') =>
  `fake:${email}:${sub}:${name}`.padEnd(24, '_');

export async function createTestApp(): Promise<INestApplication> {
  const moduleRef = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(GOOGLE_VERIFIER)
    .useValue(fakeGoogle)
    .compile();
  const app = configureApp(moduleRef.createNestApplication({ logger: ['error'], rawBody: true }));
  await app.init();
  return app;
}
