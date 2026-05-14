import { describe, it, expect } from "vitest";
import { DiagramSchema } from "@/schema/diagram";

describe("DiagramSchema", () => {
  it("accepts a minimal valid diagram with a Client and a Service", () => {
    const input = {
      version: 1,
      nodes: [
        { type: "client", id: "c1", label: "Client", rps: 10 },
        { type: "service", id: "s1", label: "Service", latency_ms: 20 },
      ],
      edges: [{ id: "e1", source: "c1", target: "s1", kind: "sync" }],
    };
    const result = DiagramSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("rejects an unknown node type", () => {
    const input = {
      version: 1,
      nodes: [{ type: "alien", id: "a1" }],
      edges: [],
    };
    expect(DiagramSchema.safeParse(input).success).toBe(false);
  });

  it("rejects an edge whose source or target is missing", () => {
    const input = {
      version: 1,
      nodes: [{ type: "client", id: "c1", label: "Client", rps: 10 }],
      edges: [{ id: "e1", source: "c1", target: "ghost", kind: "sync" }],
    };
    const parsed = DiagramSchema.safeParse(input);
    expect(parsed.success).toBe(false);
  });

  it("applies defaults: Client.pattern defaults to 'constant'", () => {
    const input = {
      version: 1,
      nodes: [{ type: "client", id: "c1", label: "C", rps: 5 }],
      edges: [],
    };
    const out = DiagramSchema.parse(input);
    const client = out.nodes[0];
    if (client.type !== "client") throw new Error("expected client");
    expect(client.pattern).toBe("constant");
  });
});
