import { resolve } from 'node:path'
import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig({
  plugins: [vanillaExtractPlugin(), solid({ ssr: true })],
  build: {
    lib: {
      entry: {
        index: resolve(__dirname, 'src/index.ts'),
        'theme/index': resolve(__dirname, 'src/theme/tokens-only.ts'),
      },
      formats: ['es'],
    },
    rollupOptions: {
      external: ['solid-js', 'solid-js/web', 'solid-js/store'],
    },
    cssCodeSplit: false,
  },
})
