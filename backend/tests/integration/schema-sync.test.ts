import { describe, it, expect } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';
import { GlucoseUnit } from '@goodnumbers/common';

describe('Architectural Guardrails', () => {
  it('should ensure the Prisma schema enum and the common enum are synchronized', async () => {
    // 1. Read the Prisma schema file
    const schemaPath = path.resolve(__dirname, '../../prisma/schema.prisma');
    const schemaContent = await fs.readFile(schemaPath, 'utf-8');

    // 2. Parse the enum members from the schema using a regex
    const prismaEnumRegex = /enum\s*GlucoseUnit\s*\{([\s\S]+?)\}/;
    const match = schemaContent.match(prismaEnumRegex);
    expect(match, 'GlucoseUnit enum not found in schema.prisma').not.toBeNull();

    const prismaMembers = match![1]
      .replace(/\r\n/g, '\n') // Normalize newlines
      .split('\n')
      .map((line) => line.trim())
      .filter((line) => line && !line.startsWith('//'));

    // 3. Get the members from the common package's enum
    const commonMembers = Object.keys(GlucoseUnit);

    // 4. Assert they are identical
    expect(prismaMembers).toEqual(commonMembers);
  });
});
