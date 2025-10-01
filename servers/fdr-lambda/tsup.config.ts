import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["cjs"],
  dts: true,
  outDir: "dist",
  clean: true,
  // Bundle all dependencies including pg
  noExternal: [/.*/],
  platform: "node",
  target: "node22",
  minify: false,
  sourcemap: false,
});
