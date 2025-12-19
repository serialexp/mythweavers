import { join } from 'node:path'
import { defineConfig } from '@solidjs/start/config'
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'

export default defineConfig({
  vite: {
    plugins: [vanillaExtractPlugin()],
    resolve: {
      alias: {
        '~': join(process.cwd(), 'src'),
      },
    },
    ssr: {
      noExternal: ['@mythweavers/shared', '@mythweavers/ui'],
    },
    server: {
      port: 3333,
    },
  },
})
