import globals from 'globals';
import pluginJs from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  {
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node, // Add Node.js globals
      },
      parser: tseslint.parser,
      parserOptions: {
        project: './tsconfig.eslint.json', // Ensure type-aware linting
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
  },
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['**/*.js'], // For plain JS files, disable type-checking
    ...tseslint.configs.disableTypeChecked,
  },
  {
    files: ['jest.config.cjs'], // Target jest.config.cjs
    rules: {
      '@typescript-eslint/no-var-requires': 'off', // Allow require in CJS files
      '@typescript-eslint/no-explicit-any': 'off', // Allow any in CJS files if needed
    },
    ...tseslint.configs.disableTypeChecked, // Disable type checking for this file
  },
  {
    rules: {
      // Re-enable stricter rules as requested by the user
      '@typescript-eslint/no-explicit-any': 'error', // Set to error
      '@typescript-eslint/no-namespace': 'error', // Set to error
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_' },
      ], // Set to error
    },
  },
  {
    ignores: ['dist/**'],
  },
];
