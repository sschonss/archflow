import { describe, it, expect } from "vitest";
import { createEngine } from "@/engine";
import { parseDiagram } from "@/lib/yaml";

function runFor(eng: ReturnType<typeof createEngine>, totalMs: number, dt: number) {
  for (let t = 0; t < totalMs; t += dt) eng.tick(dt);
}

const yaml = `
version: 1
nodes:
  - id: s
    type: service
    label: S
    latency_ms: 1
    capacity_rps: 100
    error_rate: 0
    triggers:
      - { id: t1, cron: "*/1 * * * *" }
edges: []
`;

const workerYaml = `
version: 1
nodes:
  - id: w
    type: worker
    label: W
    concurrency: 1
    latency_ms: 1
    error_rate: 0
    triggers:
      - { id: t1, cron: "*/1 * * * *" }
edges: []
`;

describe("cron triggers integration", () => {
  it("fires once per simulated minute", () => {
    const diag = parseDiagram(yaml);
    const eng = createEngine(diag, 1);

    runFor(eng, 5 * 60_000, 100);

    expect(eng.state.counters.emitted).toBe(5);
  });

  it("processes worker cron particles instead of orphaning them", () => {
    const diag = parseDiagram(workerYaml);
    const eng = createEngine(diag, 1);

    runFor(eng, 5 * 60_000 + 100, 100);

    expect(eng.state.counters.emitted).toBe(5);
    expect(eng.state.counters.completed).toBe(5);
    expect(eng.state.particles).toHaveLength(0);
  });
});
