import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("Vite Pages configuration", () => {
  it("defaults to root base path for local/dev builds", () => {
    const viteConfig = readFileSync(join(process.cwd(), "vite.config.ts"), "utf8");

    expect(viteConfig).toContain('base: process.env.VITE_BASE ?? "/"');
  });

  it("rewrites the built 404 page from processed dist/index.html", () => {
    const viteConfig = readFileSync(join(process.cwd(), "vite.config.ts"), "utf8");

    expect(viteConfig).toContain("githubPagesFallback404");
    expect(viteConfig).toContain('writeFileSync(join(outDir, "404.html")');
  });

  it("ships a GitHub Pages SPA fallback copied from index.html", () => {
    const fallbackPath = join(process.cwd(), "public", "404.html");
    expect(existsSync(fallbackPath)).toBe(true);

    const fallback = readFileSync(fallbackPath, "utf8");
    const index = readFileSync(join(process.cwd(), "index.html"), "utf8");
    expect(fallback).toContain("GitHub Pages SPA fallback");
    expect(fallback).toContain(index.trim());
  });
});
