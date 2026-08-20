import solidPlugin from 'vite-plugin-solid'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [solidPlugin()],
  test: {
    globals: true,
    environment: 'happy-dom',
    exclude: ['e2e/**', 'node_modules/**', 'dist/**'],
    // Keep solid-js out of Vitest's prod dep pre-bundling so it is resolved with
    // the `development` condition below. Otherwise `solid-js/store` loads its dev
    // build while `solid-js` core loads prod (DEV === undefined), and createStore
    // throws "Cannot read properties of undefined (reading 'registerGraph')".
    server: {
      deps: {
        inline: [/solid-js/],
      },
    },
  },
  resolve: {
    conditions: ['development', 'browser'],
  },
})
