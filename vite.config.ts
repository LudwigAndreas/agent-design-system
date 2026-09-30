import { fileURLToPath } from "node:url";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const resolvePath = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      "@ds": resolvePath("./src/design-system"),
      "@agent": resolvePath("./src/agent"),
      "@app": resolvePath("./src/app"),
    },
  },
});
