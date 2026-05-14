import { describe, it, expect } from "vitest";
import { tickClient } from "@/engine/nodes/client";
import { mulberry32 } from "@/engine/rng";
import type { EngineState, NodeRuntime } from "@/engine/types";
import type { ClientNode } from "@/schema";

function makeState(client: ClientNode): EngineState {
  const rt: NodeRuntime = { nodeId: client.id, emitAccumulatorMs: 0, inFlight: [] };
  return {
    diagram: { version: 1, nodes: [client], edges: [] },
    seed: 1,
    rngState: 1,
    nowMs: 0,
    particles: [],
    nodes: { [client.id]: rt },
    counters: { emitted: 0, completed: 0, failed: 0 },
    nextParticleId: 1,
  };
}

describe("Client emission", () => {
  it("emits ~rps particles per simulated second (constant pattern)", () => {
    const client: ClientNode = {
      type: "client",
      id: "c1",
      label: "C",
      rps: 10,
      pattern: "constant",
      payload_size: 0,
    };
    const state = makeState(client);
    const rng = mulberry32(state.seed);
    for (let i = 0; i < 50; i++) {
      state.nowMs += 20;
      tickClient(state, client, 20, rng);
    }
    expect(state.counters.emitted).toBe(10);
    expect(state.particles).toHaveLength(10);
    state.particles.forEach((p) => {
      expect(p.originNodeId).toBe("c1");
      expect(p.originType).toBe("http");
      expect(p.location).toEqual({ kind: "node", id: "c1" });
      expect(p.status).toBe("in_flight");
    });
  });

  it("does not emit when rps is below the per-tick threshold but accumulates over time", () => {
    const client: ClientNode = {
      type: "client",
      id: "c1",
      label: "C",
      rps: 1,
      pattern: "constant",
      payload_size: 0,
    };
    const state = makeState(client);
    const rng = mulberry32(state.seed);
    for (let i = 0; i < 10; i++) {
      state.nowMs += 100;
      tickClient(state, client, 100, rng);
    }
    expect(state.counters.emitted).toBe(1);
  });
});
