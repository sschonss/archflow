import type { Diagram } from "@/schema";
import type { EngineApi, EngineState, NodeRuntime } from "./types";
import { tick as tickFn } from "./tick";

export * from "./types";
export { tick as tick } from "./tick";
export { mulberry32 } from "./rng";

export function createEngine(diagram: Diagram, seed: number): EngineApi {
  const state: EngineState = buildInitial(diagram, seed);
  return {
    state,
    tick(dtMs: number) {
      tickFn(state, dtMs);
    },
    reset() {
      const fresh = buildInitial(diagram, seed);
      Object.assign(state, fresh);
    },
  };
}

function buildInitial(diagram: Diagram, seed: number): EngineState {
  const nodes: Record<string, NodeRuntime> = {};
  for (const n of diagram.nodes) {
    const base: NodeRuntime = { inFlight: 0, emitAccumulatorMs: 0 };
    if (n.type === 'service' || n.type === 'worker') {
      base.replicas = n.hpa?.min_replicas ?? 1;
      base.hpaWindow = [];
    }
    nodes[n.id] = base;
  }
  return {
    diagram,
    seed,
    rngState: seed >>> 0,
    nowMs: 0,
    particles: [],
    nodes,
    metrics: {},
    scenarios: diagram.scenarios ?? [],
    counters: { emitted: 0, completed: 0, failed: 0 },
    nextParticleId: 1,
  };
}
