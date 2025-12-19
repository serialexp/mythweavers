import { vanillaExtractPlugin } from '@vanilla-extract/vite-plugin'
import { visualizer } from 'rollup-plugin-visualizer'
import { defineConfig } from 'vite'
import solid from 'vite-plugin-solid'

export default defineConfig({
  plugins: [
    vanillaExtractPlugin(),
    solid(),
    visualizer({
      open: false,
      gzipSize: true,
      brotliSize: true,
      filename: 'bundle-stats.json',
      template: 'raw-data',
    }),
  ],
  publicDir: 'public',
  server: {
    host: true,
    port: 3203,
    allowedHosts: ['localhost', '127.0.0.1', '0.0.0.0', 'home.serial-experiments.com'],
    proxy: {
      '/ollama/api': {
        target: 'http://localhost:11434',
        changeOrigin: true,
        secure: false,
        headers: {
          host: 'localhost:11434',
        },
        proxyTimeout: 180000,
        configure: (proxy, _options) => {
          proxy.on('error', (err, _req, _res) => {
            console.log('Proxy error:', err)
          })
          proxy.on('proxyReq', (proxyReq, req, _res) => {
            // Override headers to make it appear as localhost
            proxyReq.setHeader('host', 'localhost:11434')
            proxyReq.removeHeader('origin')
            proxyReq.removeHeader('referer')
            console.log('Proxying request:', req.method, req.url, `-> http://localhost:11434${proxyReq.path}`)
            console.log('Original request headers:', req.headers)
            console.log('Proxy request headers:', proxyReq.getHeaders())
            if (req.method === 'POST') {
              let body = ''
              req.on('data', (chunk) => {
                body += chunk.toString()
              })
              req.on('end', () => {
                console.log('POST body:', body)
              })
            }
          })
          proxy.on('proxyRes', (proxyRes, req, _res) => {
            console.log('Proxy response:', req.url, '->', proxyRes.statusCode)
            console.log('Response headers:', proxyRes.headers)
          })
        },
        rewrite: (path) => {
          const newPath = path.replace(/^\/ollama/, '')
          console.log('Rewriting path:', path, '->', newPath)
          return newPath
        },
      },
    },
  },
})
