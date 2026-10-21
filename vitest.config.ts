import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    environment: 'node',
  },
  resolve: {
    alias: {
      '@': new URL('./', import.meta.url).pathname,
      '@payload-config': new URL('./payload.config.ts', import.meta.url).pathname,
    },
  },
})
