import { playwright } from '@vitest/browser-playwright'
import solid from 'vite-plugin-solid'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [solid()],
  test: {
    globals: true,
    include: ['test/**/*.browser.test.ts', 'test/**/*.browser.test.tsx'],
    browser: {
      enabled: true,
      provider: playwright(),
      instances: [{ browser: 'chromium' }],
      headless: true,
    },
  },
})
