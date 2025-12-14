import { defineConfig } from "@solidjs/start/config";
import tailwindcss from "@tailwindcss/vite";
import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import { join } from "node:path";

export default defineConfig({
  vite: {
    plugins: [tailwindcss(), vanillaExtractPlugin()],
    resolve: {
      alias: {
        "~": join(process.cwd(), "src"),
      },
    },
    ssr: {
      noExternal: ["@writer/shared", "@mythweavers/ui"],
    },
    server: {
      port: 3333,
    },
  },
});
