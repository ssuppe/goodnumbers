import { describe, it, expect } from 'vitest';
import { readFileSync } from 'fs';
import { globSync } from 'glob';
import path from 'path';

describe('Architectural Integrity Guardrails', () => {
  it('GUARDRAIL: should NOT use @src module aliases in compiled backend source files', () => {
    // We scan the source files for @src imports. 
    // These work in Vitest but fail in the compiled Node.js runtime.
    const files = globSync('backend/src/**/*.ts', { ignore: 'node_modules/**' });
    const violations: string[] = [];

    files.forEach(file => {
      const content = readFileSync(file, 'utf-8');
      if (content.includes("from '@src/")) {
        violations.push(file);
      }
    });

    expect(violations, 
      `Found @src imports in the following files. Use relative imports instead to prevent runtime 500 errors:\n${violations.join('\n')}`
    ).toHaveLength(0);
  });

  it('GUARDRAIL: should enforce .js extensions in ESM imports', () => {
    // ESM in Node.js requires explicit file extensions.
    // Standardizing on .js extensions even in .ts source files is the project convention.
    const files = globSync('backend/src/**/*.ts', { ignore: 'node_modules/**' });
    const violations: string[] = [];

    files.forEach(file => {
      const content = readFileSync(file, 'utf-8');
      // Look for relative imports that don't end in .js or other allowed extensions
      const importRegex = /from\s+['"](\.\.?\/[^'"]+)['"]/g;
      let match;
      while ((match = importRegex.exec(content)) !== null) {
        const importPath = match[1];
        if (!importPath.endsWith('.js') && !importPath.endsWith('.css') && !importPath.endsWith('.svg')) {
          violations.push(`${file}: ${importPath}`);
        }
      }
    });

    expect(violations, 
      `Found relative imports missing .js extensions. ESM requires explicit extensions:\n${violations.join('\n')}`
    ).toHaveLength(0);
  });
});
