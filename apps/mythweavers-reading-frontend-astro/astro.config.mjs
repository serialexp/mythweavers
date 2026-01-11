import { defineConfig } from 'astro/config'
import solidJs from '@astrojs/solid-js'
import node from '@astrojs/node'
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'

export default defineConfig({
  output: 'server',
  adapter: node({
    mode: 'standalone',
  }),
  integrations: [solidJs()],
  vite: {
    plugins: [vanillaExtractPlugin()],
    ssr: {
      noExternal: ['@mythweavers/shared', '@mythweavers/ui'],
    },
  },
  server: {
    port: 3202,
  },
})
