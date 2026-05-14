import { describe, it, expect } from "vitest";
import { tickService } from "@/engine/nodes/service";
import { mulberry32 } from "@/engine/rng";
import type { EngineState, Particle } from "@/engine/types";
import type { ServiceNode } from "@/schema";

function makeState(svc: ServiceNode): EngineState {
  return {
    diagram: { version: 1, nodes: [svc], edges: [] },
    seed: 1,
    rngState: 1,
    nowMs: 0,
    particles: [],
    nodes: {
      [svc.id]: { inFlight: 0, emitAccumulatorMs: 0 },
    },
    metrics: {},
    scenarios: [],
    counters: { emitted: 0, completed: 0, failed: 0 },
    nextParticleId: 1,
  };
}

describe("Service processing", () => {
  it("completes a particle after latency_ms with error_rate=0", () => {
    const svc: ServiceNode = {
      type: "service",
      id: "s1",
      label: "S",
      latency_ms: 50,
      capacity_rps: 100,
      error_rate: 0,
    };
    const state = makeState(svc);
    const rng = mulberry32(1);
    const p: Particle = {
      id: 1,
      originType: "http",
      bornAt: 0,
      location: { kind: "node", id: "s1" },
      status: "in_flight",
    };
    state.particles.push(p);
    state.nodes["s1"].inFlight = 1;
    p.status = "processing";

    state.nowMs = 30;
    tickService(state, svc, 30, rng);
    expect(state.particles[0].status).toBe("processing");

    state.nowMs = 60;
    tickService(state, svc, 30, rng);
    expect(state.counters.completed).toBe(1);
    expect(state.particles).toHaveLength(0);
  });

  it("fails a particle when error_rate=1", () => {
    const svc: ServiceNode = {
      type: "service",
      id: "s1",
      label: "S",
      latency_ms: 10,
      capacity_rps: 100,
      error_rate: 1,
    };
    const state = makeState(svc);
    const rng = mulberry32(1);
    const p: Particle = {
      id: 1,
      originType: "http",
      bornAt: 0,
      location: { kind: "node", id: "s1" },
      status: "processing",
    };
    state.particles.push(p);
    state.nodes["s1"].inFlight = 1;

    state.nowMs = 20;
    tickService(state, svc, 20, rng);
    expect(state.counters.failed).toBe(1);
    expect(state.counters.completed).toBe(0);
  });
});
