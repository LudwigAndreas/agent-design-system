import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vitest/config";

const resolvePath = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  // Vitest ships its own Vite, so the plugin is registered here rather than
  // reusing vite.config.ts — mixing the two Vite copies breaks the types.
  plugins: [react()],
  resolve: {
    alias: {
      "@ds": resolvePath("./src/design-system"),
      "@agent": resolvePath("./src/agent"),
      "@app": resolvePath("./src/app"),
    },
  },
  test: {
    globals: true,
    environment: "jsdom",
    // An opaque origin (the about:blank default) leaves localStorage undefined,
    // and the shell's persistence tests need it.
    environmentOptions: { jsdom: { url: "http://localhost:5173" } },
    setupFiles: ["./vitest.setup.ts"],
    css: false,
  },
});
