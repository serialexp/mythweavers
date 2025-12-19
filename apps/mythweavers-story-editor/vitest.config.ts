import solidPlugin from 'vite-plugin-solid'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [solidPlugin()],
  test: {
    globals: true,
    environment: 'happy-dom',
  },
  resolve: {
    conditions: ['development', 'browser'],
  },
})
