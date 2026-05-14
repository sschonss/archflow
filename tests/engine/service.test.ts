import { describe, it, expect } from "vitest";
import { tickService } from "@/engine/nodes/service";
import { mulberry32 } from "@/engine/rng";
import type { EngineState } from "@/engine/types";
import type { ServiceNode } from "@/schema";

function makeState(svc: ServiceNode): EngineState {
  return {
    diagram: { version: 1, nodes: [svc], edges: [] },
    seed: 1,
    rngState: 1,
    nowMs: 0,
    particles: [],
    nodes: {
      [svc.id]: { nodeId: svc.id, emitAccumulatorMs: 0, inFlight: [] },
    },
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
    state.particles.push({
      id: "p1",
      scenarioId: null,
      originNodeId: "x",
      originType: "http",
      location: { kind: "node", id: "s1" },
      birthTimeMs: 0,
      latencySoFarMs: 0,
      status: "in_flight",
    });
    state.nodes["s1"].inFlight.push(state.particles[0]);
    state.particles[0].status = "processing";

    state.nowMs = 30;
    tickService(state, svc, 30, rng);
    expect(state.particles[0].status).toBe("processing");

    state.nowMs = 60;
    tickService(state, svc, 30, rng);
    expect(state.counters.completed).toBe(1);
    expect(state.particles).toHaveLength(0);
    expect(state.nodes["s1"].inFlight).toHaveLength(0);
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
    state.particles.push({
      id: "p1",
      scenarioId: null,
      originNodeId: "x",
      originType: "http",
      location: { kind: "node", id: "s1" },
      birthTimeMs: 0,
      latencySoFarMs: 0,
      status: "processing",
    });
    state.nodes["s1"].inFlight.push(state.particles[0]);

    state.nowMs = 20;
    tickService(state, svc, 20, rng);
    expect(state.counters.failed).toBe(1);
    expect(state.counters.completed).toBe(0);
  });
});
