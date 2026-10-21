import next from 'eslint-config-next'

const configuration = [
  // `lib/payload/types.ts` est généré par `pnpm payload:generer-types`.
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts', 'lib/payload/types.ts'] },
  ...next,
]

export default configuration
