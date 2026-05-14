import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { defineConfig, type Plugin } from "vite";
import react from "@vitejs/plugin-react";

function githubPagesFallback404(): Plugin {
  return {
    name: "github-pages-fallback-404",
    closeBundle() {
      const outDir = path.resolve(__dirname, "dist");
      const indexPath = path.join(outDir, "index.html");
      if (!existsSync(indexPath)) return;

      const indexHtml = readFileSync(indexPath, "utf8");
      writeFileSync(join(outDir, "404.html"), `<!-- GitHub Pages SPA fallback: generated from built index.html. -->\n${indexHtml}`);
    },
  };
}

const { join } = path;

export default defineConfig({
  // GH Pages can serve from /archflow/ by setting VITE_BASE=/archflow/.
  base: process.env.VITE_BASE ?? "/",
  plugins: [react(), githubPagesFallback404()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
