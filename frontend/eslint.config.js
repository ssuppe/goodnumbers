import { defineConfig } from "eslint/config";
import globals from "globals";
import tseslint from "typescript-eslint";
import pluginJs from "@eslint/js";
import pluginReactConfig from "eslint-plugin-react/configs/recommended.js";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import vitest from "@vitest/eslint-plugin"; // Keep this for the plugin rules
import vitestGlobals from "vitest/globals"; // Import vitest globals

export default defineConfig([
  {
    ignores: ["dist/"],
  },

  // Apply basic rules that are not type-aware
  pluginJs.configs.recommended,
  ...tseslint.configs.recommended,

  // Apply the powerful, type-aware rules using the project service
  {
    files: ["**/*.{ts,tsx}"],
    extends: [...tseslint.configs.recommendedTypeChecked],
    languageOptions: {
      parserOptions: {
        projectService: {
          // This is the definitive fix for the new error.
          // It tells the service to allow linting of config files
          // that aren't explicitly in a tsconfig.
          allowDefaultProject: ["./eslint.config.js"],
        },
        tsconfigRootDir: import.meta.dirname,
      },
    },
  },

  // React-specific configuration (does not need to be type-aware)
  {
    files: ["src/**/*.{ts,tsx}"],
    ...pluginReactConfig,
    languageOptions: {
      globals: {
        ...globals.browser,
      },
    },
    settings: {
      react: { version: "detect" },
    },
    plugins: {
      "react-refresh": reactRefresh,
      "react-hooks": reactHooks,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react/react-in-jsx-scope": "off",
      "react-refresh/only-export-components": [
        "warn",
        { allowConstantExport: true },
      ],
    },
  },
  // Test-specific configuration
  {
    files: ["src/**/*.test.{ts,tsx}"],
    languageOptions: {
      globals: vitestGlobals, // Add vitest globals here
    },
    plugins: {
      vitest: vitest, // Keep the plugin for rules
    },
    rules: {
      ...vitest.configs.recommended.rules, // Spread the recommended rules
      "@typescript-eslint/unbound-method": "off",
    },
  },
]);
