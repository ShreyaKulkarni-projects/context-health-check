import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts", "src/gptTokenizer.ts"],
  format: ["esm", "cjs"],
  dts: true,
  sourcemap: true,
  clean: true,
  target: "es2022",
});
