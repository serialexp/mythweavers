import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import { defineConfig } from 'histoire'
import { HstSolid } from 'histoire-plugin-solid'
import solid from 'vite-plugin-solid'

export default defineConfig({
  plugins: [HstSolid()],
  storyMatch: ['**/*.story.tsx'],
  setupFile: './src/histoire.setup.ts',
  // For SolidJS, use web transform mode for JSX files (not SSR transform)
  // This ensures the solid plugin transforms JSX as client-side components
  viteNodeTransformMode: {
    web: [/\.[jt]sx$/],
  },
  // Inline solid-js to prevent histoire from pre-bundling it with SSR entry
  viteNodeInlineDeps: [/solid-js/],
  vite: {
    plugins: [vanillaExtractPlugin(), solid()],
    resolve: {
      // Force browser + development conditions to get client-side SolidJS
      // Histoire sets conditions: ['node'] for server which would resolve to SSR bundle
      conditions: ['development', 'browser', 'import', 'default'],
    },
  },
  theme: {
    title: 'Writer UI',
  },
  tree: {
    groups: [
      {
        id: 'design-tokens',
        title: 'Design Tokens',
      },
      {
        id: 'components',
        title: 'Components',
      },
      {
        id: 'layout',
        title: 'Layout',
      },
      {
        id: 'editor',
        title: 'Editor',
      },
    ],
  },
})
