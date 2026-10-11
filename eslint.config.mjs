import { defineConfig, globalIgnores } from 'eslint/config'
import nextVitals from 'eslint-config-next/core-web-vitals'
import nextTs from 'eslint-config-next/typescript'

/**
 * Lint rules that keep the build's contracts honest: three loads only inside
 * the Stage, client files never pull in content or the drawing renderers, and
 * every visible string comes from src/content.
 */

const NO_THREE = {
  group: ['three', 'three/*'],
  allowTypeImports: true,
  message:
    'three loads only inside src/stage/runtime/** and src/scenes/**. Use the Stage API (src/stage/host.ts).',
}
const NO_DYNAMIC_THREE = {
  selector: 'ImportExpression[source.value=/^three/]',
  message: 'Dynamic import of three is only allowed in src/stage/runtime/** and src/scenes/**.',
}
// The compiler-derived react-hooks rules assume the React Compiler, which is off.
const COMPILER_RULES_OFF = Object.fromEntries(
  [
    'immutability',
    'refs',
    'purity',
    'set-state-in-effect',
    'set-state-in-render',
    'globals',
    'preserve-manual-memoization',
    'static-components',
    'use-memo',
    'unsupported-syntax',
    'incompatible-library',
  ].map((r) => [`react-hooks/${r}`, 'off']),
)

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    name: 'ae/no-three-outside-stage',
    files: ['src/**/*.{ts,tsx}'],
    ignores: ['src/stage/runtime/**', 'src/scenes/**'],
    rules: {
      '@typescript-eslint/no-restricted-imports': ['error', { patterns: [NO_THREE] }],
      'no-restricted-syntax': ['error', NO_DYNAMIC_THREE],
    },
  },
  {
    name: 'ae/client-boundary',
    files: ['src/**/*.client.{ts,tsx}'],
    rules: {
      '@typescript-eslint/no-restricted-imports': [
        'error',
        {
          patterns: [
            NO_THREE,
            {
              group: ['@/content', '@/content/*'],
              allowTypeImports: true,
              message: 'Client files get copy as props from Server Components.',
            },
            {
              group: ['roughjs', '@/drawings/render', '@/drawings/render/*', '@/drawings/files'],
              message: 'Drawing renderers are server-only.',
            },
          ],
        },
      ],
    },
  },
  {
    name: 'ae/compiler-rules-off',
    files: ['**/*.client.{ts,tsx}', 'src/stage/**/*.{ts,tsx}', 'src/scenes/**/*.ts'],
    rules: COMPILER_RULES_OFF,
  },
  {
    name: 'ae/svg-img',
    files: ['src/drawings/**/*.tsx', 'src/figures/**/*.tsx'],
    rules: { '@next/next/no-img-element': 'off' },
  },
  {
    name: 'ae/a11y',
    files: ['src/**/*.tsx'],
    rules: {
      'jsx-a11y/anchor-is-valid': 'error',
      'jsx-a11y/no-redundant-roles': 'error',
      'jsx-a11y/label-has-associated-control': 'error',
    },
  },
  {
    name: 'ae/copy-lives-in-content',
    files: [
      'src/components/**/*.tsx',
      'src/sections/**/*.tsx',
      'src/figures/**/*.tsx',
      'src/app/**/*.tsx',
    ],
    rules: {
      'react/jsx-no-literals': [
        'error',
        {
          noStrings: false,
          allowedStrings: ['·', '→', '↓', '←', '×', '/', '—', '–', ':', '*', '(', ')'],
        },
      ],
    },
  },
  globalIgnores([
    '.next/**',
    'out/**',
    'build/**',
    'next-env.d.ts',
    '.worktrees/**',
    'playwright-report/**',
    'test-results/**',
    '.lighthouse/**',
    'shots/**',
    'artifacts/**',
  ]),
])
