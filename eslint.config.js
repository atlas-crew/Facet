import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import eslintConfigPrettier from 'eslint-config-prettier/flat'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // Generated outputs are intentionally outside the lint surface so
  // `eslint .` reports source debt instead of bundled/transformed artifacts.
  globalIgnores([
    'coverage',
    'coverage/**',
    'dist',
    'dist/**',
    'dist-*',
    'dist-*/**',
    'dist-unmin',
    'dist-unmin/**',
    'dist-unmin-*',
    'dist-unmin-*/**',
    '.vercel',
    '.vercel/**',
    '**/.vercel/**',
    '.agents',
    '.claude',
    '.codanna',
    'backlog',
    'brand',
    'playwright-report',
    'test-results',
  ]),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
        },
      ],
    },
  },
  // Keep Prettier last so later ESLint config does not re-enable formatting rules.
  eslintConfigPrettier,
])
