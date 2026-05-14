import { describe, expect, it } from "vitest";
import { createEngine } from "@/engine";
import { parseDiagram } from "@/lib/yaml";

const yaml = `
version: 1
nodes:
  - { id: c, type: client, label: C, rps: 200, pattern: constant }
  - { id: s, type: service, label: S, latency_ms: 50, capacity_rps: 50, error_rate: 0,
      resources: { cpu_per_request_ms: 10, mem_per_request_mb: 1, cpu_limit_ms_per_sec: 1000, mem_limit_mb: 1024 },
      hpa: { min_replicas: 1, max_replicas: 5, target_cpu: 60, cooldown_ticks: 3 } }
edges:
  - { id: e1, source: c, target: s, kind: sync, latency_ms: 1, weight: 1 }
`;

function runFor(engine: ReturnType<typeof createEngine>, totalMs: number, dtMs: number): number[] {
  const samples: number[] = [];
  for (let t = 0; t < totalMs; t += dtMs) {
    engine.tick(dtMs);
    samples.push(engine.state.nodes.s.replicas ?? 1);
  }
  return samples;
}

describe("HPA scaling integration", () => {
  it("scales replicas up under sustained load and settles within bounds", () => {
    const diagram = parseDiagram(yaml);
    const engine = createEngine(diagram, 7);

    expect(engine.state.nodes.s.replicas).toBe(1);

    const replicas = runFor(engine, 10_000, 100);
    const maxReplicas = Math.max(...replicas);
    const finalReplicas = engine.state.nodes.s.replicas ?? 1;

    const finalWindow = replicas.slice(-10);

    expect(maxReplicas).toBeGreaterThan(1);
    expect(finalReplicas).toBeGreaterThan(1);
    expect(finalReplicas).toBeLessThanOrEqual(5);
    expect(finalWindow.every((replicas) => replicas === finalReplicas)).toBe(true);
  });
});
