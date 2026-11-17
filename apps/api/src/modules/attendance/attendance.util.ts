import { createHmac, randomBytes, timingSafeEqual } from 'node:crypto';
import { ATTENDANCE } from '@latif/shared';

/** @db.Date value for a YYYY-MM-DD string. */
export const dbDate = (iso: string): Date => new Date(`${iso}T00:00:00.000Z`);
export const isoDate = (d: Date): string => d.toISOString().slice(0, 10);

/** Great-circle distance in meters. */
export const haversineM = (aLat: number, aLng: number, bLat: number, bLng: number): number => {
  const R = 6371000;
  const rad = (d: number) => (d * Math.PI) / 180;
  const dLat = rad(bLat - aLat);
  const dLng = rad(bLng - aLng);
  const h =
    Math.sin(dLat / 2) ** 2 + Math.cos(rad(aLat)) * Math.cos(rad(bLat)) * Math.sin(dLng / 2) ** 2;
  return Math.round(2 * R * Math.asin(Math.sqrt(h)));
};

const b64 = (s: string) => Buffer.from(s).toString('base64url');
const sign = (secret: string, body: string) =>
  createHmac('sha256', secret).update(body).digest('base64url');

/** Rotating kiosk QR token: branch + 30 s window, HMAC-signed. */
export const kioskToken = (secret: string, daycareId: string, now = Date.now()) => {
  const w = Math.floor(now / 1000 / ATTENDANCE.QR_WINDOW_SECONDS);
  const body = b64(
    JSON.stringify({ v: 1, b: daycareId, w, n: randomBytes(6).toString('base64url') }),
  );
  return {
    token: `lk1.${body}.${sign(secret, body)}`,
    expiresAt: new Date((w + 2) * ATTENDANCE.QR_WINDOW_SECONDS * 1000),
    refreshInSeconds: (w + 1) * ATTENDANCE.QR_WINDOW_SECONDS - Math.floor(now / 1000),
  };
};

/**
 * Returns the branch id if the token is authentic and recent: up to ~2 minutes old, so a parent
 * who scans with the phone camera still has time to sign in (the QR on screen rotates every 30 s).
 */
export const verifyKioskToken = (
  secret: string,
  token: string,
  now = Date.now(),
): string | null => {
  const [prefix, body, sig] = token.split('.');
  if (prefix !== 'lk1' || !body || !sig) return null;
  const expected = Buffer.from(sign(secret, body));
  const got = Buffer.from(sig);
  if (expected.length !== got.length || !timingSafeEqual(expected, got)) return null;
  try {
    const p = JSON.parse(Buffer.from(body, 'base64url').toString()) as {
      v: number;
      b: string;
      w: number;
    };
    const current = Math.floor(now / 1000 / ATTENDANCE.QR_WINDOW_SECONDS);
    const age = current - p.w;
    return p.v === 1 && age >= -1 && age <= ATTENDANCE.QR_MAX_AGE_WINDOWS ? p.b : null;
  } catch {
    return null;
  }
};

export const pinHash = (secret: string, daycareId: string, pin: string) =>
  createHmac('sha256', secret).update(`pin:${daycareId}:${pin}`).digest('hex');

/** Seconds until a (valid) token stops being accepted. */
export const kioskTokenExpiresIn = (token: string, now = Date.now()): number => {
  try {
    const p = JSON.parse(Buffer.from(token.split('.')[1] ?? '', 'base64url').toString()) as {
      w: number;
    };
    const end = (p.w + ATTENDANCE.QR_MAX_AGE_WINDOWS + 1) * ATTENDANCE.QR_WINDOW_SECONDS;
    return Math.max(0, end - Math.floor(now / 1000));
  } catch {
    return 0;
  }
};
