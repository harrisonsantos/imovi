import base from '@imovi/config/eslint/base';

export default [
  // Artefatos de build do Next/Vercel e ambientes gerados
  { ignores: ['.vercel/**', '.next/**', 'next-env.d.ts'] },
  ...base,
];
