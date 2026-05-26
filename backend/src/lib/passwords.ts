import { scryptSync, randomBytes, timingSafeEqual } from 'crypto';

// Hardened scrypt parameters for production-grade security
// N: CPU/Memory cost, r: block size, p: parallelization
const SCRYPT_PARAMS = {
  N: 16384,
  r: 8,
  p: 1,
  maxmem: 32 * 1024 * 1024, // 32MB limit
};

/**
 * Hashes a password using Node.js native scrypt with hardened parameters.
 * Format: salt:hash
 */
export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString('hex');
  const derivedKey = scryptSync(password, salt, 64, SCRYPT_PARAMS);
  return `${salt}:${derivedKey.toString('hex')}`;
}

/**
 * Verifies a password against a stored hash using the same hardened parameters.
 */
export function verifyPassword(password: string, storedValue: string): boolean {
  const [salt, hash] = storedValue.split(':');
  if (!salt || !hash) return false;

  const derivedKey = scryptSync(password, salt, 64, SCRYPT_PARAMS);
  const hashBuffer = Buffer.from(hash, 'hex');

  if (derivedKey.length !== hashBuffer.length) {
    return false;
  }

  // Use timingSafeEqual to prevent timing attacks
  return timingSafeEqual(hashBuffer, derivedKey);
}
