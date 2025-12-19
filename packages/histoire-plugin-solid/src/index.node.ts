import type { Plugin } from 'histoire'

export function HstSolid(): Plugin {
  return {
    name: 'histoire-plugin-solid',

    defaultConfig() {
      return {
        supportMatch: [
          {
            id: 'solid',
            patterns: ['**/*.story.tsx', '**/*.story.jsx'],
            pluginIds: ['solid'],
          },
        ],
      }
    },

    // Note: We don't set browser conditions here anymore because it breaks SSR
    // during story collection. The preview phase runs in an actual browser
    // so it doesn't need the condition override.

    supportPlugin: {
      id: 'solid',
      moduleName: 'histoire-plugin-solid',
      setupFn: 'setupSolid',
      importStoryComponent: (file, index) => `import Comp${index} from ${JSON.stringify(file.moduleId)}`,
    },
  }
}

export * from './helpers.js'
