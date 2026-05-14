import { describe, expect, it } from "vitest";
import type { Diagram } from "@/schema";
import { serializeDiagramForExport } from "@/lib/export";
import { stringifyDiagram } from "@/lib/yaml";

const diagram: Diagram = {
  version: 1,
  nodes: [
    { type: "client", id: "c", label: "Client", rps: 1, pattern: "constant", payload_size: 0 },
    { type: "service", id: "s", label: "Service", latency_ms: 10, capacity_rps: 1000, error_rate: 0 },
  ],
  edges: [{ id: "cs", source: "c", target: "s", kind: "sync", latency_ms: 1, weight: 1 }],
};

describe("export helpers", () => {
  it("serializes YAML exports with the same text as stringifyDiagram", () => {
    const text = serializeDiagramForExport(diagram);

    expect(text.length).toBeGreaterThan(0);
    expect(text).toBe(stringifyDiagram(diagram));
  });
});
