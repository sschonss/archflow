var _a;
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";
export default defineConfig({
    // GH Pages will serve from /archflow/. Override via VITE_BASE if needed.
    base: (_a = process.env.VITE_BASE) !== null && _a !== void 0 ? _a : "/archflow/",
    plugins: [react()],
    resolve: {
        alias: { "@": path.resolve(__dirname, "src") },
    },
});
