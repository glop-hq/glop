import { defineConfig } from "tsup";

const define = {
  __DEFAULT_SERVER_URL__: JSON.stringify(
    process.env.GLOP_DEFAULT_SERVER_URL || "http://localhost:3000"
  ),
};

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: true,
    clean: true,
    define,
  },
  {
    entry: ["src/lib/pr-comment-worker.ts"],
    format: ["esm"],
    dts: false,
    clean: true,
    outDir: "dist/lib",
    define,
  },
]);
