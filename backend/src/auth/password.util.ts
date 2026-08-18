import * as bcrypt from 'bcrypt';
import { randomBytes, createHash } from 'crypto';

const SALT_ROUNDS = 10;
const ONE_TIME_PASSWORD_LENGTH = 12;
// Avoid visually ambiguous characters (0/O, 1/l/I) since these are read aloud/typed manually.
const ONE_TIME_PASSWORD_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789';

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, SALT_ROUNDS);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

/** Generates a random one-time password to hand out to a newly created/reset candidate. */
export function generateOneTimePassword(): string {
  const bytes = randomBytes(ONE_TIME_PASSWORD_LENGTH);
  let result = '';
  for (let i = 0; i < ONE_TIME_PASSWORD_LENGTH; i++) {
    result += ONE_TIME_PASSWORD_ALPHABET[bytes[i] % ONE_TIME_PASSWORD_ALPHABET.length];
  }
  return result;
}

/** Refresh tokens are opaque random strings; only their hash is ever persisted. */
export function generateRefreshToken(): string {
  return randomBytes(48).toString('base64url');
}

export function hashRefreshToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
