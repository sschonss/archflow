import { describe, expect, it } from "vitest";
import { createEngine } from "@/engine";
import type { Diagram } from "@/schema";
import type { Particle } from "@/engine/types";

const diagram: Diagram = {
  version: 1,
  nodes: [
    {
      id: "s",
      type: "service",
      label: "S",
      latency_ms: 1000,
      capacity_rps: 100,
      error_rate: 0,
      resources: {
        cpu_per_request_ms: 5,
        mem_per_request_mb: 100,
        cpu_limit_ms_per_sec: 1000,
        mem_limit_mb: 100,
      },
      hpa: { min_replicas: 1, max_replicas: 5, target_cpu_pct: 70, stabilization_ticks: 3 },
    },
  ],
  edges: [],
};

function particle(id: number): Particle {
  return {
    id,
    originType: "http",
    bornAt: 0,
    location: { kind: "node", id: "s" },
    status: "in_flight",
  };
}

describe("tick resource wiring", () => {
  it("records utilization and fails OOM particles through normal failure counters", () => {
    const engine = createEngine(diagram, 1);
    engine.state.particles.push(particle(1), particle(2));
    engine.state.nodes.s.inFlight = 2;

    engine.tick(10);

    expect(engine.state.nodes.s.cpu_utilization).toBeGreaterThan(0);
    expect(engine.state.nodes.s.mem_utilization).toBe(2);
    expect(engine.state.counters.failed).toBe(1);
    expect(engine.state.metrics.s.fails).toEqual([10]);
    expect(engine.state.particles).toHaveLength(1);
  });
});
