import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin"
import { defineConfig } from "vite"
import solid from "vite-plugin-solid"

export default defineConfig({
  plugins: [vanillaExtractPlugin(), solid()],
  publicDir: "public",
  server: {
    host: true,
    port: 3204,
    allowedHosts: ['localhost', '127.0.0.1', '0.0.0.0', 'admin.mythweavers.home.serial-experiments.com'],
  },
})
