import js from '@eslint/js'
import vitest from '@vitest/eslint-plugin'
import { defineConfig, globalIgnores } from 'eslint/config'
import importPlugin from 'eslint-plugin-import-x'
import { createTypeScriptImportResolver } from 'eslint-import-resolver-typescript'
import i18next from 'eslint-plugin-i18next'
import reactDom from 'eslint-plugin-react-dom'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import reactX from 'eslint-plugin-react-x'
import testingLibrary from 'eslint-plugin-testing-library'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default defineConfig([
  globalIgnores(['dist', 'coverage', 'playwright-report', 'test-results', 'src/routeTree.gen.ts']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    plugins: {
      'import-x': importPlugin,
      'react-x': reactX,
      'react-dom': reactDom,
    },
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    settings: {
      'import-x/resolver-next': [
        createTypeScriptImportResolver({ project: './tsconfig.app.json' }),
      ],
    },
    rules: {
      // stylistic owned by Biome
      'no-extra-semi': 'off',
      semi: 'off',
      quotes: 'off',
      indent: 'off',

      // module isolation
      'import-x/no-restricted-paths': [
        'error',
        {
          zones: [
            {
              target: './src/modules/*/!(_shared)',
              from: './src/modules/*',
              except: ['./_shared/**'],
              message:
                'modules/* cannot import sibling modules. Promote to lib/, components/, or hooks/.',
            },
          ],
        },
      ],

      'import-x/order': [
        'warn',
        {
          groups: ['builtin', 'external', 'internal', 'parent', 'sibling', 'index'],
          pathGroups: [{ pattern: '@/**', group: 'internal' }],
          'newlines-between': 'always',
          alphabetize: { order: 'asc', caseInsensitive: true },
        },
      ],

      'import-x/no-default-export': 'error',

      // allow underscore-prefixed args / vars (intentional unused, e.g. stub api)
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
    },
  },
  {
    // routes/** may default-export (TanStack Router file-based requirement)
    // also allow inline component + Route export (fast-refresh exception)
    files: ['src/routes/**/*.{ts,tsx}'],
    rules: {
      'import-x/no-default-export': 'off',
      'react-refresh/only-export-components': 'off',
    },
  },
  {
    // i18n: ban literal user-facing strings in component files
    files: ['src/components/**/*.tsx', 'src/modules/**/components/**/*.tsx', 'src/routes/**/*.tsx'],
    plugins: { i18next },
    rules: {
      'i18next/no-literal-string': [
        'warn',
        { markupOnly: true, ignoreAttribute: ['data-testid', 'role'] },
      ],
    },
  },
  {
    // Vitest + RTL tests
    files: ['src/**/*.test.{ts,tsx}', 'src/test/**/*.{ts,tsx}'],
    plugins: { 'testing-library': testingLibrary, vitest },
    rules: {
      ...testingLibrary.configs.react.rules,
      ...vitest.configs.recommended.rules,
    },
  },
  {
    // explicit cleanup needed because vitest globals:false disables RTL auto-cleanup
    files: ['src/test/setup.ts'],
    rules: { 'testing-library/no-manual-cleanup': 'off' },
  },
  {
    // Playwright E2E — not testing-library
    files: ['tests-e2e/**/*.{ts,tsx}'],
    rules: {
      'import-x/no-default-export': 'off',
    },
  },
  {
    // config files & vite config can default-export and run in node
    files: ['*.config.{js,ts}', 'vite.config.ts', 'vitest.config.ts', 'playwright.config.ts'],
    rules: { 'import-x/no-default-export': 'off' },
    languageOptions: { globals: globals.node },
  },
])
