// goodnumbers/tests/unit/encryption.test.ts
// Set a valid key for the main test suite
process.env.ENCRYPTION_KEY =
  '151b795a05b8758bb36b9b3813333d5484373c0b735697525834c643a2b8593c';

import { encrypt, decrypt } from '../../src/lib/encryption';
import { jest } from '@jest/globals';

describe('Encryption Utility', () => {
  it('should encrypt and decrypt a string successfully', () => {
    const originalText = 'This is a secret message for Nightscout!';
    const encrypted = encrypt(originalText);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(originalText);
    expect(encrypted).not.toBe(originalText);
  });

  it('should correctly handle an empty string', () => {
    const originalText = '';
    const encrypted = encrypt(originalText);
    const decrypted = decrypt(encrypted);

    expect(decrypted).toBe(originalText);
  });

  it('should produce a different encrypted output for the same input due to the random IV', () => {
    const originalText = 'Same input, different output.';
    const encrypted1 = encrypt(originalText);
    const encrypted2 = encrypt(originalText);

    expect(encrypted1).not.toBe(encrypted2);
  });

  it('should throw an error if trying to decrypt a malformed payload', () => {
    const malformedPayload = 'this:is:not:valid';
    expect(() => decrypt(malformedPayload)).toThrow(
      'Invalid encrypted payload format.',
    );
  });

  it('should throw an error if the authentication tag is invalid (tampered data)', () => {
    const originalText = 'some data';
    const encrypted = encrypt(originalText);
    const parts = encrypted.split(':');

    // Tamper with the ciphertext by changing a character
    const tamperedCiphertext =
      Buffer.from(parts[2], 'base64').toString('hex').slice(0, -2) + '00';
    const tamperedPayload = `${parts[0]}:${parts[1]}:${Buffer.from(tamperedCiphertext, 'hex').toString('base64')}`;

    // The GCM authentication step in `decrypt` should fail
    expect(() => decrypt(tamperedPayload)).toThrow(
      'Unsupported state or unable to authenticate data',
    );
  });

  it('should throw an error for null or undefined input', () => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => encrypt(null as any)).toThrow(
      'Plaintext cannot be null or undefined.',
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => decrypt(null as any)).toThrow(
      'Encrypted payload cannot be null or undefined.',
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => encrypt(undefined as any)).toThrow(
      'Plaintext cannot be null or undefined.',
    );
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    expect(() => decrypt(undefined as any)).toThrow(
      'Encrypted payload cannot be null or undefined.',
    );
  });
});

// This separate suite tests the module's initialization logic
describe('Encryption Utility Initialization', () => {
  const originalEnvKey = process.env.ENCRYPTION_KEY;

  afterEach(() => {
    process.env.ENCRYPTION_KEY = originalEnvKey;
    jest.resetModules();
  });

  it('should throw an error if ENCRYPTION_KEY is not set', async () => {
    delete process.env.ENCRYPTION_KEY;
    jest.resetModules(); // Ensure module cache is cleared before import

    await expect(async () => {
      await import('../../src/lib/encryption');
    }).rejects.toThrow(
      'FATAL: ENCRYPTION_KEY environment variable is not set.',
    );
  });

  it('should throw an error if ENCRYPTION_KEY is not a 32-byte hex string', async () => {
    process.env.ENCRYPTION_KEY = 'this-is-not-a-valid-32-byte-hex-key';
    jest.resetModules(); // Ensure module cache is cleared before import

    await expect(async () => {
      await import('../../src/lib/encryption');
    }).rejects.toThrow(
      'FATAL: ENCRYPTION_KEY must be a 32-byte (64-character) hex string.',
    );
  });
});
