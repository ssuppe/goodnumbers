# Phase 1, Task 4: Build Credential Encryption Utility

**Author:** Gemini
**Date:** 2025-08-16
**Status:** Not Started

## 1. Goal

The primary goal of this task is to create a secure, self-contained utility for encrypting and decrypting sensitive user credentials, specifically their Nightscout URL and API token. This is a critical security measure to protect user data at rest in the database, as outlined in the Technical Specification.

We will use the built-in `crypto` module from Node.js to implement AES-256-GCM symmetric encryption, which provides both confidentiality and data integrity.

## 2. Background

According to the technical specification, all sensitive credentials must be encrypted before being stored. AES-256-GCM is a modern, authenticated encryption cipher that is ideal for this purpose.

The entire process relies on a single, secret encryption key that will be provided to the application via an environment variable (`ENCRYPTION_KEY`). This key must **never** be committed to source control.

## 3. File Structure

You will be creating two new files within the `goodnumbers/` project directory. You may need to create the `lib/` and `unit/` subdirectories if they do not already exist.

1.  **Implementation File:** `goodnumbers/src/lib/encryption.ts`
2.  **Test File:** `goodnumbers/tests/unit/encryption.test.ts`

The resulting structure will look like this:

```
goodnumbers/
├── src/
│   ├── index.ts
│   └── lib/
│       └── encryption.ts      <-- You will create this
└── tests/
    ├── integration/
    │   ├── database.test.ts
    │   └── server.test.ts
    └── unit/
        └── encryption.test.ts <-- You will create this
```

## 4. Implementation Steps

Follow these steps to create and test the encryption utility.

### Step 4.1: Set up the Environment Variable

The utility's security depends on a secret key that lives outside the codebase.

1.  In the `goodnumbers/` directory, create a file named `.env`. This file is used for local development and is already specified in `.gitignore` to prevent it from being committed.

2.  Generate a secure, 32-byte (256-bit) encryption key. You can use the Node.js REPL for this. Run the following command in your terminal and copy the output:
    ```bash
    node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
    ```

3.  Add the generated key to your `goodnumbers/.env` file. It should look like this:
    ```env
    # goodnumbers/.env
    ENCRYPTION_KEY=your_64_character_hex_key_goes_here
    ```

### Step 4.2: Implement the Encryption Module

Create the file `goodnumbers/src/lib/encryption.ts` and add the following code. The code is commented to explain each part of the process.

```typescript
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
```

### Step 4.3: Write the Unit Tests

A security utility is only useful if it's reliable. Create the test file `goodnumbers/tests/unit/encryption.test.ts` to verify its correctness and robustness.

```typescript
// goodnumbers/tests/unit/encryption.test.ts

// Set a valid key for the main test suite
process.env.ENCRYPTION_KEY = '151b795a05b8758bb36b9b3813333d5484373c0b735697525834c643a2b8593c';

import { encrypt, decrypt } from '../../src/lib/encryption';

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
    expect(() => decrypt(malformedPayload)).toThrow('Invalid encrypted payload format.');
  });

  it('should throw an error if the authentication tag is invalid (tampered data)', () => {
    const originalText = 'some data';
    const encrypted = encrypt(originalText);
    const parts = encrypted.split(':');
    
    // Tamper with the ciphertext by changing a character
    const tamperedCiphertext = Buffer.from(parts[2], 'base64').toString('hex').slice(0, -2) + '00';
    const tamperedPayload = `${parts[0]}:${parts[1]}:${Buffer.from(tamperedCiphertext, 'hex').toString('base64')}`;

    // The GCM authentication step in `decrypt` should fail
    expect(() => decrypt(tamperedPayload)).toThrow('Unsupported state or unable to authenticate data');
  });

  it('should throw an error for null or undefined input', () => {
    expect(() => encrypt(null as any)).toThrow('Plaintext cannot be null or undefined.');
    expect(() => decrypt(null as any)).toThrow('Encrypted payload cannot be null or undefined.');
    expect(() => encrypt(undefined as any)).toThrow('Plaintext cannot be null or undefined.');
    expect(() => decrypt(undefined as any)).toThrow('Encrypted payload cannot be null or undefined.');
  });
});

// This separate suite tests the module's initialization logic
describe('Encryption Utility Initialization', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    jest.resetModules(); // This is key to re-evaluating the module
    process.env = { ...OLD_ENV }; // Make a copy
  });

  afterAll(() => {
    process.env = OLD_ENV; // Restore original environment
  });

  it('should throw an error if ENCRYPTION_KEY is not set', () => {
    delete process.env.ENCRYPTION_KEY;
    // We use require() here to test the module's initial evaluation
    expect(() => require('../../src/lib/encryption')).toThrow('FATAL: ENCRYPTION_KEY environment variable is not set.');
  });

  it('should throw an error if ENCRYPTION_KEY is not a 32-byte hex string', () => {
    process.env.ENCRYPTION_KEY = 'this-is-not-a-valid-32-byte-hex-key';
    expect(() => require('../../src/lib/encryption')).toThrow('FATAL: ENCRYPTION_KEY must be a 32-byte (64-character) hex string.');
  });
});
```

### Step 4.4: Ensure Environment Variables are Loaded

For `process.env.ENCRYPTION_KEY` to be available when the main application runs (not just during tests), you must load the variables from your `.env` file at runtime.

1.  **Install `dotenv`**: If it's not already part of the project, add it as a dependency from within the `goodnumbers/` directory:
    ```bash
    npm install dotenv
    ```

2.  **Load at Startup**: In your application's main entry point, `goodnumbers/src/index.ts`, add the following line at the very top. It must execute before any other code that relies on environment variables.

    ```typescript
    // goodnumbers/src/index.ts
    import 'dotenv/config';

    // The rest of your application code follows...
    // import express from 'express';
    // ...
    ```

## 5. Final Steps

### Step 5.1: Run the Tests

Navigate to the `goodnumbers` directory and run the test suite to confirm that everything is working correctly.

```bash
cd goodnumbers
npm test
```

All tests in `encryption.test.ts` should pass.

### Step 5.2: Create an Example Environment File

To help other developers (and your future self), create a `goodnumbers/.env.example` file. This file will be committed to the repository and serves as a template for the required `.env` file.

```env
# goodnumbers/.env.example

# This key is used for encrypting/decrypting sensitive data at rest.
# It MUST be a 32-byte (64-character) hexadecimal string.
# Generate a new one for your local environment by running:
# node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
ENCRYPTION_KEY=
```

### Step 5.3: Commit Your Work

Stage your new files and commit them using the Conventional Commit message format specified in the project's development process.

```bash
# Run from the workspace root
git add goodnumbers/src/lib/encryption.ts goodnumbers/tests/unit/encryption.test.ts goodnumbers/.env.example
git commit -m "feat(utils): create encryption utility for sensitive data"
```

You have now completed Phase 1, Task 4.