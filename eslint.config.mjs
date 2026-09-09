import next from 'eslint-config-next'

const configuration = [
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'] },
  ...next,
]

export default configuration
