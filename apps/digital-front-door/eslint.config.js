// ESLint flat config. Read alongside `apps/digital-front-door/AGENTS.md`.
// Type-aware rules start at `warn` severity in the initial scaffold pass;
// flip to `error` once the empty scaffold reports zero warnings (see tasks.md 12.10).

const { defineConfig } = require('eslint/config')
const expoConfig = require('eslint-config-expo/flat')

module.exports = defineConfig([
  // Global ignores — MUST be a standalone config object (only `ignores` key)
  // to be treated as a project-wide ignore in flat config.
  {
    ignores: [
      'dist/**',
      '.expo/**',
      'web-build/**',
      'coverage/**',
      'node_modules/**',
      'ios/**',
      'android/**',
      'assets/**',
    ],
  },

  expoConfig,

  {
    linterOptions: {
      reportUnusedDisableDirectives: false,
    },
  },

  // Tier 1 — file / import / type / logging hygiene.
  {
    plugins: {
      i18next: require('eslint-plugin-i18next'),
      'simple-import-sort': require('eslint-plugin-simple-import-sort'),
      'check-file': require('eslint-plugin-check-file'),
      '@tanstack/query': require('@tanstack/eslint-plugin-query'),
    },
    rules: {
      'i18next/no-literal-string': 'error',
      'simple-import-sort/imports': 'error',
      'simple-import-sort/exports': 'error',
      'no-console': 'error',
    },
    settings: {
      i18next: {
        localesPaths: ['src/lib/i18n/locales'],
      },
    },
  },

  // TypeScript-aware rules (warn during scaffold; flip to error per task 12.10).
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parserOptions: {
        projectService: true,
      },
    },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/consistent-type-definitions': ['error', 'type'],
      '@typescript-eslint/consistent-type-assertions': [
        'error',
        { assertionStyle: 'never' },
      ],
      '@typescript-eslint/use-unknown-in-catch-callback-variable': 'error',
      '@typescript-eslint/prefer-nullish-coalescing': 'error',
      '@typescript-eslint/promise-function-async': 'error',
      '@typescript-eslint/no-restricted-types': [
        'error',
        {
          types: {
            Function: { message: 'Use a specific function signature instead.' },
            '{}': {
              message:
                'Use `Record<string, never>` for empty objects or a precise shape.',
            },
            Object: { message: 'Use `object` or a precise shape instead.' },
          },
        },
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'TSEnumDeclaration',
          message:
            'TS enums are banned. Use a string union type + `as const` instead.',
        },
        {
          selector:
            "CallExpression[callee.name='forwardRef'], CallExpression[callee.object.name='React'][callee.property.name='forwardRef']",
          message:
            'React 19 ref-as-prop: pass `ref` as a prop instead of `forwardRef`.',
        },
      ],
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['../*'],
              message:
                'Use `@/*` alias for cross-folder imports; only same-folder relative `./` is allowed.',
            },
          ],
        },
      ],
      'react-hooks/rules-of-hooks': 'error',
      'react-hooks/exhaustive-deps': 'error',
      'react/function-component-definition': [
        'error',
        {
          namedComponents: 'function-declaration',
          unnamedComponents: 'arrow-function',
        },
      ],
      'import/no-default-export': 'error',
      '@tanstack/query/exhaustive-deps': 'error',
    },
  },

  // Route files + config files MUST use default exports.
  {
    files: [
      'src/app/**/*.{ts,tsx}',
      '*.config.{js,ts,mjs,cjs}',
      'app.config.{js,ts}',
      'babel.config.{js,ts}',
      'metro.config.{js,ts}',
      'tailwind.config.{js,ts}',
      'jest.config.{js,ts}',
    ],
    rules: {
      'import/no-default-export': 'off',
    },
  },

  // Disallow raw useQuery / useMutation in screens and UI primitives.
  {
    files: ['src/app/**/*.{ts,tsx}', 'src/components/ui/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-syntax': [
        'error',
        {
          selector:
            'CallExpression[callee.name=/^useQuery$|^useMutation$|^useInfiniteQuery$/]',
          message:
            'Raw TanStack hooks are not allowed here. Wrap in `src/modules/<x>/hooks/use-*.ts`.',
        },
      ],
    },
  },

  // Logger is the only place `console.*` is allowed.
  {
    files: ['src/lib/logger.ts'],
    rules: {
      'no-console': 'off',
    },
  },

  // Test files: relax casts, literal strings, import order, cross-folder relatives,
  // and function-component-definition (test helpers commonly return inline components).
  {
    files: ['__tests__/**/*.{ts,tsx}', 'jest.setup.ts'],
    rules: {
      '@typescript-eslint/consistent-type-assertions': 'off',
      'i18next/no-literal-string': 'off',
      'simple-import-sort/imports': 'off',
      'no-restricted-imports': 'off',
      'react/function-component-definition': 'off',
    },
  },

  // Filename naming convention — kebab-case files everywhere under src/.
  // Expo-router special filenames are exempt: `_layout.tsx`, `+not-found.tsx`,
  // `[param].tsx`, `[...rest].tsx`, etc.
  {
    files: ['src/**/*.{ts,tsx}'],
    ignores: [
      'src/app/**/_layout.{ts,tsx}',
      'src/app/**/+*.{ts,tsx}',
      'src/app/**/[[]*.{ts,tsx}',
    ],
    rules: {
      'check-file/filename-naming-convention': [
        'error',
        {
          'src/**/*.{ts,tsx}': 'KEBAB_CASE',
        },
        { ignoreMiddleExtensions: true },
      ],
    },
  },
])
