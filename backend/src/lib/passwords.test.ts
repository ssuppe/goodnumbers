import { describe, it, expect } from 'vitest';
import { hashPassword, verifyPassword } from './passwords.js';

describe('Password Utility', () => {
  it('should hash a password and return a string in salt:hash format', () => {
    const password = 'my-secure-password';
    const hash = hashPassword(password);

    expect(hash).toBeDefined();
    expect(typeof hash).toBe('string');
    expect(hash.split(':')).toHaveLength(2);
  });

  it('should verify a correct password', () => {
    const password = 'my-secure-password';
    const hash = hashPassword(password);

    const result = verifyPassword(password, hash);
    expect(result).toBe(true);
  });

  it('should reject an incorrect password', () => {
    const password = 'my-secure-password';
    const wrongPassword = 'wrong-password';
    const hash = hashPassword(password);

    const result = verifyPassword(wrongPassword, hash);
    expect(result).toBe(false);
  });

  it('should produce different hashes for the same password due to random salt', () => {
    const password = 'same-password';
    const hash1 = hashPassword(password);
    const hash2 = hashPassword(password);

    expect(hash1).not.toEqual(hash2);
    expect(verifyPassword(password, hash1)).toBe(true);
    expect(verifyPassword(password, hash2)).toBe(true);
  });

  it('should handle malformed hashes gracefully', () => {
    expect(verifyPassword('password', '')).toBe(false);
    expect(verifyPassword('password', 'no-colon')).toBe(false);
    expect(verifyPassword('password', 'salt:hash:extra')).toBe(false);
  });
});
