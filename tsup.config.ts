/**
 * tsup 打包构建配置
 *
 * @author Ateng
 * @since 2026-10-08
 */
import { defineConfig } from "tsup";

export default defineConfig({
  entry: ["src/index.ts"],
  format: ["esm"],
  target: "node20",
  dts: true,
  clean: true,
  sourcemap: true,
  banner: {
    js: "#!/usr/bin/env node",
  },
  shims: true,
});
