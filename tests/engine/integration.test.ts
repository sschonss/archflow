import { describe, it, expect } from "vitest";
import { createEngine } from "@/engine";

const DIAGRAM = {
  version: 1 as const,
  nodes: [
    { type: "client" as const, id: "c1", label: "C", rps: 10, pattern: "constant" as const, payload_size: 0 },
    { type: "service" as const, id: "s1", label: "S", latency_ms: 50, capacity_rps: 1000, error_rate: 0 },
  ],
  edges: [
    { id: "e1", source: "c1", target: "s1", kind: "sync" as const, latency_ms: 100, weight: 1 },
  ],
};

describe("engine integration", () => {
  it("client→edge→service end-to-end produces completed particles", () => {
    const engine = createEngine(DIAGRAM, 42);
    for (let i = 0; i < 100; i++) {
      engine.tick(20);
    }
    expect(engine.state.counters.emitted).toBe(20);
    expect(engine.state.counters.completed).toBe(20);
    expect(engine.state.counters.failed).toBe(0);
  });

  it("is deterministic across runs with the same seed", () => {
    const a = createEngine(DIAGRAM, 7);
    const b = createEngine(DIAGRAM, 7);
    for (let i = 0; i < 50; i++) {
      a.tick(20);
      b.tick(20);
    }
    expect(a.state.counters).toEqual(b.state.counters);
  });

  it("reset() clears particles and counters", () => {
    const engine = createEngine(DIAGRAM, 1);
    for (let i = 0; i < 10; i++) engine.tick(20);
    expect(engine.state.counters.emitted).toBeGreaterThan(0);
    engine.reset();
    expect(engine.state.counters).toEqual({ emitted: 0, completed: 0, failed: 0 });
    expect(engine.state.particles).toEqual([]);
    expect(engine.state.nowMs).toBe(0);
  });
});
