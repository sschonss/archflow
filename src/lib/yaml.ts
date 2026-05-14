import { parse, stringify } from "yaml";
import { DiagramSchema, type Diagram } from "@/schema";

export function parseDiagram(text: string): Diagram {
  const raw = parse(text);
  return DiagramSchema.parse(raw);
}

export function stringifyDiagram(diagram: Diagram): string {
  // Validate before serialization to refuse to emit a broken file.
  const validated = DiagramSchema.parse(diagram);
  return stringify(validated, { lineWidth: 0 });
}
