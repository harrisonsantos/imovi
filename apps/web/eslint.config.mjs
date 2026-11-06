import base from '@imovi/config/eslint/base';

export default [
  // Artefatos de build e ambientes gerados
  { ignores: ['.vercel/**', '.next/**', '.open-next/**', '.wrangler/**', 'next-env.d.ts'] },
  ...base,
];
