// goodnumbers/src/lib/encryption.ts

import { createCipheriv, createDecipheriv, randomBytes } from 'crypto';

// --- Configuration & Key Validation ---

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH_BYTES = 12; // GCM standard IV size is 12 bytes (96 bits)
const AUTH_TAG_LENGTH_BYTES = 16; // GCM standard auth tag size is 16 bytes (128 bits)

const secretKeyHex = process.env.ENCRYPTION_KEY;

// CRITICAL: Fail fast if the encryption key is missing or invalid.
// This prevents the application from running in an insecure state.
if (!secretKeyHex) {
  throw new Error('FATAL: ENCRYPTION_KEY environment variable is not set.');
}
if (Buffer.from(secretKeyHex, 'hex').length !== 32) {
    throw new Error('FATAL: ENCRYPTION_KEY must be a 32-byte (64-character) hex string.');
}

const key = Buffer.from(secretKeyHex, 'hex');

// --- Public API ---

/**
 * Encrypts a plaintext string using AES-256-GCM.
 * The output is a single string that includes the initialization vector (IV) and authentication tag,
 * which are required for decryption.
 *
 * @param plaintext The string to encrypt. Cannot be null or undefined.
 * @returns A colon-separated string in the format "iv:authTag:ciphertext", with each part encoded in base64.
 */
export function encrypt(plaintext: string): string {
  if (plaintext == null) {
    throw new Error('Plaintext cannot be null or undefined.');
  }

  const iv = randomBytes(IV_LENGTH_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);

  const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
  const authTag = cipher.getAuthTag();

  // Combine all parts into a single string for easy storage in the database.
  return `${iv.toString('base64')}:${authTag.toString('base64')}:${ciphertext.toString('base64')}`;
}

/**
 * Decrypts a string that was encrypted with the `encrypt` function.
 *
 * @param encryptedPayload The "iv:authTag:ciphertext" string.
 * @returns The original plaintext string.
 * @throws An error if the payload is malformed or if decryption fails (e.g., tampered data).
 */
export function decrypt(encryptedPayload: string): string {
  if (encryptedPayload == null) {
    throw new Error('Encrypted payload cannot be null or undefined.');
  }

  const parts = encryptedPayload.split(':');
  if (parts.length !== 3) {
    throw new Error('Invalid encrypted payload format. Expected "iv:authTag:ciphertext".');
  }

  const iv = Buffer.from(parts[0], 'base64');
  const authTag = Buffer.from(parts[1], 'base64');
  const ciphertext = Buffer.from(parts[2], 'base64');

  // GCM uses the authentication tag to verify the integrity of the data.
  // If the ciphertext or IV was tampered with, this step will throw an error.
  const decipher = createDecipheriv(ALGORITHM, key, iv);
  decipher.setAuthTag(authTag);

  const decryptedText = Buffer.concat([decipher.update(ciphertext), decipher.final()]);

  return decryptedText.toString('utf8');
}