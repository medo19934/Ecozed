import { randomBytes, randomInt, scrypt as scryptCb, timingSafeEqual } from 'node:crypto';
import { promisify } from 'node:util';

const scrypt = promisify(scryptCb) as (pw: string, salt: Buffer, len: number) => Promise<Buffer>;

/** Stored as "scrypt$<salt base64>$<hash base64>". */
export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(16);
  const hash = await scrypt(password, salt, 32);
  return ['scrypt', salt.toString('base64'), hash.toString('base64')].join('$');
}

export async function verifyPassword(password: string, stored: string | null): Promise<boolean> {
  const [algo, salt, hash] = (stored ?? '').split('$');
  if (algo !== 'scrypt' || !salt || !hash) {
    // Same work either way so timing doesn't reveal unknown accounts.
    await scrypt(password, randomBytes(16), 32);
    return false;
  }
  const expected = Buffer.from(hash, 'base64');
  const actual = await scrypt(password, Buffer.from(salt, 'base64'), expected.length);
  return timingSafeEqual(actual, expected);
}

/** Readable one-time password for admins to hand over (no 0/O/1/l). */
export function tempPassword(length = 10): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789';
  return Array.from({ length }, () => chars[randomInt(chars.length)]).join('');
}
