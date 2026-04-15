// file: backend/vitest.global-setup.ts
import { execSync } from 'child_process';
import crypto from 'crypto';
import 'dotenv/config'; // Load .env file first

export default function () {
  console.log('[GlobalSetup] Setting up the test database...');

  const dbFile = `test-${crypto.randomUUID()}.db`;
  process.env.DATABASE_URL = `file:${dbFile}`;
  console.log(`[GlobalSetup] DATABASE_URL set to: ${process.env.DATABASE_URL}`);

  execSync('npx prisma migrate deploy');
  console.log('[GlobalSetup] Migrations applied.');

  return () => {
    console.log('[GlobalTeardown] Tearing down the test database...');
  };
}
