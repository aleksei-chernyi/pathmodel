/* eslint-env node */
// ESLint flat config for ESLint v9+
// Migrated from .eslintrc.cjs and .eslintignore

const js = require("@eslint/js")
const tsParser = require("@typescript-eslint/parser")
const tsPlugin = require("@typescript-eslint/eslint-plugin")
const eslintPluginPrettier = require("eslint-plugin-prettier")
let prettierConfig
try {
  // Use eslint-config-prettier's flat config (if available)
  prettierConfig = require("eslint-config-prettier")
} catch {
  prettierConfig = null
}

module.exports = [
  // Ignore patterns (replacement for .eslintignore)
  { ignores: ["dist/**", "node_modules/**"] },

  // TypeScript files only
  {
    files: ["**/*.ts"],
    languageOptions: {
      parser: tsParser,
      parserOptions: {
        ecmaVersion: 2021,
        sourceType: "module",
        // We don't require a project here to keep linting fast/simple
      },
    },
    plugins: {
      "@typescript-eslint": tsPlugin,
      prettier: eslintPluginPrettier,
    },
    rules: {
      // Keep formatting delegated to Prettier, but surface differences as warnings
      "prettier/prettier": "warn",

      // Mirror prior .eslintrc.cjs choices
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/explicit-module-boundary-types": "off",
      "@typescript-eslint/no-explicit-any": "off",
      // Apps type-check the shipped source with `verbatimModuleSyntax` (e.g. the Vite template).
      "@typescript-eslint/consistent-type-imports": "error",
    },
  },

  // Disable rules that would conflict with Prettier (if available)
  ...(prettierConfig ? [prettierConfig] : []),
]
