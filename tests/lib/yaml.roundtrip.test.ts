import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { parseDiagram, stringifyDiagram } from "@/lib/yaml";

const examplesDir = join(process.cwd(), "src", "examples");
const exampleFiles = [
  "foundation-demo.archflow.yaml",
  "ecommerce.archflow.yaml",
  "scaling.yaml",
];

describe("example YAML round-trip", () => {
  for (const file of exampleFiles) {
    it(`${file} parses after stringify without changing the diagram`, () => {
      const text = readFileSync(join(examplesDir, file), "utf8");
      const diagram = parseDiagram(text);

      expect(parseDiagram(stringifyDiagram(diagram))).toEqual(diagram);
    });
  }
});
