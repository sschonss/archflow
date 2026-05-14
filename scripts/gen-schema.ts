import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { zodToJsonSchema } from "zod-to-json-schema";
import { DiagramSchema } from "@/schema";

const repoRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const outputPath = join(repoRoot, "public", "schema", "archflow.schema.json");
const baseUrl = process.env.ARCHFLOW_BASE_URL ?? "https://example.com/archflow";
const schema = zodToJsonSchema(DiagramSchema, {
  name: "archflow",
  $refStrategy: "none",
});

const publicSchema = {
  ...schema,
  $id: `${baseUrl}/schema/archflow.schema.json`,
  $schema: "http://json-schema.org/draft-07/schema#",
};

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(publicSchema, null, 2)}\n`);
