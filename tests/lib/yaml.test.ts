import { describe, it, expect } from "vitest";
import { parseDiagram, stringifyDiagram } from "@/lib/yaml";

const SAMPLE = `version: 1
nodes:
  - type: client
    id: c1
    label: Client
    rps: 10
  - type: service
    id: s1
    label: Service
    latency_ms: 20
edges:
  - id: e1
    source: c1
    target: s1
    kind: sync
`;

describe("yaml helpers", () => {
  it("parses a valid YAML diagram", () => {
    const d = parseDiagram(SAMPLE);
    expect(d.nodes).toHaveLength(2);
    expect(d.edges).toHaveLength(1);
  });

  it("throws a readable error on invalid YAML", () => {
    expect(() => parseDiagram("nodes: [")).toThrow();
  });

  it("throws on schema-invalid input", () => {
    expect(() => parseDiagram("version: 1\nnodes: []\nedges: [{id: x, source: a, target: b, kind: sync}]")).toThrow();
  });

  it("round-trips parse -> stringify -> parse", () => {
    const d1 = parseDiagram(SAMPLE);
    const text = stringifyDiagram(d1);
    const d2 = parseDiagram(text);
    expect(d2).toEqual(d1);
  });
});
