import { haversineM, kioskToken, verifyKioskToken } from './attendance.util';

describe('kiosk token', () => {
  const secret = 'test-secret';
  it('verifies for about two minutes only', () => {
    const t0 = Date.UTC(2026, 0, 1, 8, 0, 5);
    const { token } = kioskToken(secret, 'branch-1', t0);
    expect(verifyKioskToken(secret, token, t0)).toBe('branch-1');
    expect(verifyKioskToken(secret, token, t0 + 30_000)).toBe('branch-1');
    expect(verifyKioskToken(secret, token, t0 + 115_000)).toBe('branch-1');
    expect(verifyKioskToken(secret, token, t0 + 151_000)).toBeNull();
  });
  it('rejects tampered or foreign tokens', () => {
    const { token } = kioskToken(secret, 'branch-1');
    expect(verifyKioskToken('other', token)).toBeNull();
    const [p, , s] = token.split('.');
    const forged = Buffer.from(JSON.stringify({ v: 1, b: 'branch-2', w: 1, n: 'x' })).toString(
      'base64url',
    );
    expect(verifyKioskToken(secret, `${p}.${forged}.${s}`)).toBeNull();
  });
});

describe('haversine', () => {
  it('measures short distances in meters', () => {
    const d = haversineM(24.7136, 46.6753, 24.7145, 46.6753);
    expect(d).toBeGreaterThan(95);
    expect(d).toBeLessThan(105);
  });
});
