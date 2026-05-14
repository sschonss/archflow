import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import Ajv from "ajv";
import addFormats from "ajv-formats";
import { parse } from "yaml";

const examplesDir = join(process.cwd(), "src", "examples");
const exampleFiles = [
  "foundation-demo.archflow.yaml",
  "ecommerce.archflow.yaml",
  "scaling.yaml",
  "01-ecommerce.yaml",
  "02-microservices-async.yaml",
  "03-api-gateway.yaml",
  "04-k8s-autoscaling.yaml",
  "05-event-driven.yaml",
];

describe("generated JSON Schema", () => {
  it.each(exampleFiles)("validates %s", (file) => {
    const schema = JSON.parse(readFileSync(join(process.cwd(), "public", "schema", "archflow.schema.json"), "utf8"));
    const ajv = new Ajv({ allErrors: true });
    addFormats(ajv);
    const validate = ajv.compile(schema);
    const yaml = parse(readFileSync(join(examplesDir, file), "utf8"));

    expect(validate(yaml), JSON.stringify(validate.errors, null, 2)).toBe(true);
  });
});
