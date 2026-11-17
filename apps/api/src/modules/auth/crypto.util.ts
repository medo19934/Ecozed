import { createHmac, randomBytes, randomInt, timingSafeEqual } from 'node:crypto';
import { OTP } from '@latif/shared';

export const hmac = (secret: string, value: string): string =>
  createHmac('sha256', secret).update(value).digest('hex');

export const randomToken = (bytes = 48): string => randomBytes(bytes).toString('base64url');

export const generateOtpCode = (length: number = OTP.LENGTH): string =>
  Array.from({ length }, () => randomInt(0, 10)).join('');

export const safeEqualHex = (a: string, b: string): boolean => {
  const ba = Buffer.from(a, 'hex');
  const bb = Buffer.from(b, 'hex');
  return ba.length === bb.length && timingSafeEqual(ba, bb);
};

/** URL-safe slug from a (possibly Arabic) name plus a random suffix. */
export const daycareSlug = (name: string): string => {
  const base = name
    .normalize('NFKD')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 40);
  return `${base || 'daycare'}-${randomBytes(3).toString('hex')}`;
};

export const isEmail = (identifier: string): boolean => identifier.includes('@');
