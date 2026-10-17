import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { version } from "./package.json";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "release-info",
      generateBundle() {
        this.emitFile({
          type: "asset",
          fileName: "version.json",
          source: JSON.stringify({
            version,
            commit: process.env.COMMIT_REF ?? null,
            builtAt: new Date().toISOString(),
          }),
        });
      },
    },
  ],
  server: { port: 5173, strictPort: true },
});
