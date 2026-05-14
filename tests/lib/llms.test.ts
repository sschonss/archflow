import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

describe("LLM discovery docs", () => {
  it("ships llms.txt with the project header and example links", () => {
    const llmsPath = join(process.cwd(), "public", "llms.txt");

    expect(existsSync(llmsPath)).toBe(true);

    const llms = readFileSync(llmsPath, "utf8");
    expect(llms).toContain("# archflow");
    expect(llms).toMatch(/src\/examples\/[\w-]+\.yaml/);
  });
});
