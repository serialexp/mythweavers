import fs from 'node:fs'
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'
import pkg from './package.json'

export default defineConfig({
  plugins: [
    // Use client mode for all modules - collect module no longer uses SSR APIs
    solid({
      ssr: false,
    }),
    {
      name: 'histoire:preserve:import.dynamic',
      enforce: 'pre',
      transform(code) {
        if (code.includes('import(')) {
          return {
            code: code.replace(/import\(/g, 'import__dyn('),
          }
        }
      },
      closeBundle() {
        try {
          // Find all JS files in dist
          const findFiles = (dir: string): string[] => {
            if (!fs.existsSync(dir)) return []
            const files: string[] = []
            const entries = fs.readdirSync(dir, { withFileTypes: true })
            for (const entry of entries) {
              const path = `${dir}/${entry.name}`
              if (entry.isDirectory()) {
                files.push(...findFiles(path))
              } else if (entry.name.endsWith('.js')) {
                files.push(path)
              }
            }
            return files
          }

          const files = findFiles('./dist')
          for (const file of files) {
            const content = fs.readFileSync(file, 'utf-8')
            if (content.includes('import__dyn')) {
              fs.writeFileSync(file, content.replace(/import__dyn\(/g, 'import(/* @vite-ignore */'), 'utf-8')
            }
          }
        } catch (e) {
          console.error(e)
        }
      },
    },
  ],
  build: {
    emptyOutDir: false,
    outDir: 'dist',
    cssCodeSplit: false,
    rollupOptions: {
      external: [
        ...Object.keys(pkg.dependencies ?? {}).map((dep) => new RegExp(`^${dep}(\\/?)`)),
        ...Object.keys(pkg.peerDependencies ?? {}).map((dep) => new RegExp(`^${dep}(\\/?)`)),
        /^node:/,
        /^virtual:/,
        /^\$/, // Virtual modules
      ],

      input: ['src/index.ts', 'src/index.node.ts', 'src/client/index.ts', 'src/collect/index.tsx'],

      output: {
        entryFileNames: '[name].js',
        chunkFileNames: '[name].js',
        assetFileNames: '[name][extname]',
        preserveModules: true,
        preserveModulesRoot: 'src',
      },
      treeshake: false,
      preserveEntrySignatures: 'strict',
    },
  },
})
