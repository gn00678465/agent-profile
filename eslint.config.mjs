import antfu from '@antfu/eslint-config';
import reactRefresh from 'eslint-plugin-react-refresh';

export default antfu(
  {
    react: true,
    typescript: true,
    stylistic: false, // disable @stylistic/eslint-plugin — codebase predates this formatter

    ignores: [
      'dist/**',
      'dist-electron/**',
      'release/**',
      '.github/**',
      // Markdown files — antfu lints code blocks inside .md by default
      '**/*.md',
      // Vite scaffold remnants not used by the app
      'src/App.tsx',
      'src/main.tsx',
      'src/App.css',
      'src/index.css',
      // Config files written without antfu formatting style
      'postcss.config.js',
      '*.config.js',
    ],

    rules: {
      // ── TypeScript — keep these; they match the original config ────────────
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],

      // ── Rules disabled because they conflict with the existing codebase ────
      // Import / module style
      'perfectionist/sort-imports': 'off',
      'perfectionist/sort-named-imports': 'off',
      'perfectionist/sort-named-exports': 'off',
      'import/consistent-type-specifier-style': 'off',
      'import/first': 'off',

      // Unicorn — opinionated replacements not adopted in this codebase
      'unicorn/prefer-node-protocol': 'off',
      'unicorn/prefer-number-properties': 'off',

      // antfu-specific formatting
      'antfu/if-newline': 'off',
      'antfu/consistent-list-newline': 'off',

      // JSON key ordering
      'jsonc/sort-keys': 'off',

      // TypeScript style preferences (existing code uses type aliases + direct imports)
      'ts/consistent-type-imports': 'off',
      'ts/consistent-type-definitions': 'off',
      'ts/no-use-before-define': 'off',

      // UI: confirm() is used intentionally for delete confirmations
      'no-alert': 'off',

      // String concatenation style — existing code uses both concat and template literals
      'prefer-template': 'off',

      // Regexp rules — existing regex patterns are not being changed on this branch
      'regexp/no-super-linear-backtracking': 'off',
      'regexp/no-useless-character-class': 'off',

      // React — existing design choices not being refactored on this branch
      'react/component-hook-factories': 'off',

      // react-hooks plugin name conflict (antfu uses react/* namespace, not react-hooks/*)
      'react-hooks/exhaustive-deps': 'off',

      // No-restricted-globals: allow `global` in test/setup files
      'no-restricted-globals': 'off',
    },
  },

  // ── Main & Preload: Node.js context ─────────────────────────────────────────
  {
    files: ['src/main/**/*.ts', 'src/preload/**/*.ts'],
    rules: {
      'node/prefer-global/process': 'off',
      'node/prefer-global/buffer': 'off',
    },
  },

  // ── Renderer: browser context + Vite HMR (react-refresh) ────────────────────
  {
    files: ['src/renderer/**/*.{ts,tsx}'],
    plugins: { 'react-refresh': reactRefresh },
    rules: {
      'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
    },
  },
  {
    files: ['src/renderer/components/ui/*.tsx'],
    rules: {
      'react-refresh/only-export-components': 'off',
    },
  },

  // ── Tests ────────────────────────────────────────────────────────────────────
  {
    files: ['**/__tests__/**', '**/*.test.{ts,tsx}', 'src/test/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/no-unsafe-function-type': 'off',
      'test/prefer-lowercase-title': 'off',
    },
  },
);
