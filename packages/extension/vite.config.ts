import { defineConfig } from "vite";
import { crx } from "@crxjs/vite-plugin";
import manifest from "./manifest.json" with { type: "json" };

export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    outDir: "dist",
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Chrome extension bundles shouldn't hash filenames referenced by the manifest.
        chunkFileNames: "assets/[name].js",
      },
    },
  },
});
