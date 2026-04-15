import { describe, it, expect } from 'vitest';
import * as fs from 'fs/promises';
import * as path from 'path';

describe('Monorepo Configuration Integrity', () => {
  // Paths relative to this test file
  const rootDir = path.resolve(__dirname, '../../..');
  const packagesDir = path.join(rootDir, 'packages');
  const backendDir = path.resolve(__dirname, '../..');

  it('should ensure all local packages are referenced in backend tsconfig.json', async () => {
    // 1. Get list of local packages in the workspace
    const entries = await fs.readdir(packagesDir, { withFileTypes: true });
    const packageNames = entries
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    // 2. Read backend tsconfig
    const tsconfigPath = path.join(backendDir, 'tsconfig.json');
    const tsconfigContent = await fs.readFile(tsconfigPath, 'utf-8');
    // Parse JSON
    const tsconfig = JSON.parse(tsconfigContent);
    const references = tsconfig.references || [];

    // 3. Verify each package is referenced AND mapped
    const paths = tsconfig.compilerOptions.paths || {};
    packageNames.forEach((pkg) => {
      // Check Reference
      const expectedRefPath = `../packages/${pkg}`;
      const hasReference = references.some(
        (ref: { path: string }) => ref.path === expectedRefPath,
      );
      expect(
        hasReference,
        `Missing "references" entry in backend/tsconfig.json for ${expectedRefPath}. Please add it to ensure proper build order.`,
      ).toBe(true);

      // Check Path Alias
      const expectedPathKey = `@goodnumbers/${pkg}`;
      const expectedPathValue = `../packages/${pkg}`;
      expect(paths).toHaveProperty(expectedPathKey);
      expect(paths[expectedPathKey]).toContain(expectedPathValue);
    });
  });

  it('should ensure all local packages have aliases in backend vitest.config.ts', async () => {
    // 1. Get list of local packages
    const entries = await fs.readdir(packagesDir, { withFileTypes: true });
    const packageNames = entries
      .filter((dirent) => dirent.isDirectory())
      .map((dirent) => dirent.name);

    // 2. Read backend vitest config (as text, since we can't easily require ts files here)
    const vitestConfigPath = path.join(backendDir, 'vitest.config.ts');
    const vitestConfigContent = await fs.readFile(vitestConfigPath, 'utf-8');

    // 3. Verify each package is aliased
    packageNames.forEach((pkg) => {
      const expectedAlias = `'@goodnumbers/${pkg}'`;
      expect(
        vitestConfigContent,
        `Missing alias in backend/vitest.config.ts for ${expectedAlias}. Please add it to resolve sources during testing.`,
      ).toContain(expectedAlias);
    });
  });
});
