import amdoxConfig from './packages/config/eslint-config.mjs';

export default [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/legacy/**',
      '**/.next/**',
      '**/.planning/**',
      '**/coverage/**',
      'test-lint.ts'
    ],
  },
  ...amdoxConfig,
];