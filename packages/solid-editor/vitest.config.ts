import solid from 'vite-plugin-solid'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [solid()],
  test: {
    globals: true,
    include: ['test/**/*.test.ts'],
    // Exclude browser tests from default run
    exclude: ['test/**/*.browser.test.ts', 'test/**/*.browser.test.tsx'],
  },
})
