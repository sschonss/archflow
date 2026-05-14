var _a;
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
function githubPagesFallback404() {
    return {
        name: "github-pages-fallback-404",
        closeBundle: function () {
            var outDir = path.resolve(__dirname, "dist");
            var indexPath = path.join(outDir, "index.html");
            if (!existsSync(indexPath))
                return;
            var indexHtml = readFileSync(indexPath, "utf8");
            writeFileSync(join(outDir, "404.html"), "<!-- GitHub Pages SPA fallback: generated from built index.html. -->\n".concat(indexHtml));
        },
    };
}
var join = path.join;
export default defineConfig({
    // GH Pages can serve from /archflow/ by setting VITE_BASE=/archflow/.
    base: (_a = process.env.VITE_BASE) !== null && _a !== void 0 ? _a : "/",
    plugins: [react(), githubPagesFallback404()],
    resolve: {
        alias: { "@": path.resolve(__dirname, "src") },
    },
});
