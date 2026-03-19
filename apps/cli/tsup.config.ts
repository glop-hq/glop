import { defineConfig } from "tsup";

export default defineConfig([
  {
    entry: ["src/index.ts"],
    format: ["esm"],
    dts: true,
    clean: true,
    define: {
      __DEFAULT_SERVER_URL__: JSON.stringify(
        process.env.GLOP_DEFAULT_SERVER_URL || "http://localhost:3000"
      ),
    },
  },
  {
    entry: ["src/lib/pr-comment-worker.ts"],
    format: ["esm"],
    dts: false,
    outDir: "dist/lib",
    define: {
      __DEFAULT_SERVER_URL__: JSON.stringify(
        process.env.GLOP_DEFAULT_SERVER_URL || "http://localhost:3000"
      ),
    },
  },
]);
