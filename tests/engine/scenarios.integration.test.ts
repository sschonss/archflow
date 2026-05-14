import { describe, it, expect } from "vitest";
import { createEngine } from "@/engine";
import { parseDiagram } from "@/lib/yaml";

function runFor(eng: ReturnType<typeof createEngine>, totalMs: number, dt: number) {
  for (let t = 0; t < totalMs; t += dt) eng.tick(dt);
}

const yaml = `
version: 1
nodes:
  - { id: c,  type: client,  label: C, rps: 50, pattern: constant }
  - { id: sa, type: service, label: A, latency_ms: 5, capacity_rps: 1000, error_rate: 0 }
  - { id: sb, type: service, label: B, latency_ms: 5, capacity_rps: 1000, error_rate: 0 }
edges:
  - { id: ca, source: c, target: sa, kind: sync, latency_ms: 1, weight: 100, tags: [scenario:checkout] }
  - { id: cb, source: c, target: sb, kind: sync, latency_ms: 1, weight: 1, tags: [scenario:browse] }
scenarios:
  - { id: browse, origin: c, weight: 1 }
`;

describe("scenarios pin routing", () => {
  it("routes a scenario to its tagged edge even when weights favor another edge", () => {
    const diag = parseDiagram(yaml);
    const eng = createEngine(diag, 7);

    runFor(eng, 2_000, 100);

    const aCount = eng.state.metrics.sa?.completes.length ?? 0;
    const bCount = eng.state.metrics.sb?.completes.length ?? 0;

    expect(aCount).toBe(0);
    expect(bCount).toBeGreaterThan(0);
  });
});
