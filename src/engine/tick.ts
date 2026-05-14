import { mulberry32 } from "./rng";
import type { EngineState, Particle } from "./types";
import { getNode, getEdge, outgoingEdges } from "./types";
import { tickClient } from "./nodes/client";
import { tickService } from "./nodes/service";

/**
 * Advance the simulation by `dtMs`. Pure function over EngineState (mutates
 * in place; cloning is the caller's job if they want history).
 *
 * Order each tick:
 *   1. Advance time.
 *   2. Move in-flight particles along edges.
 *   3. Emit new particles from Clients.
 *   4. Process particles in Services.
 */
export function tick(state: EngineState, dtMs: number): void {
  const rng = mulberry32(state.rngState);
  state.rngState = Math.floor(rng() * 0xffffffff);
  const tickRng = mulberry32(state.rngState);

  state.nowMs += dtMs;

  advanceEdges(state, dtMs);
  emitFromClients(state, dtMs, tickRng);
  processServices(state, dtMs, tickRng);
}

function advanceEdges(state: EngineState, dtMs: number): void {
  for (const p of state.particles) {
    if (p.location.kind !== "edge") continue;
    const edge = getEdge(state, p.location.id);
    if (!edge) continue;
    const stepProgress = edge.latency_ms === 0 ? 1 : dtMs / edge.latency_ms;
    p.location.progress += stepProgress;
    p.latencySoFarMs += dtMs;
    if (p.location.progress >= 1) {
      const target = getNode(state, edge.target);
      if (!target) continue;
      p.location = { kind: "node", id: target.id };
      const rt = state.nodes[target.id];
      if (rt) rt.inFlight.push(p);
    }
  }
}

function emitFromClients(state: EngineState, dtMs: number, rng: () => number): void {
  for (const node of state.diagram.nodes) {
    if (node.type !== "client") continue;
    const before = state.particles.length;
    tickClient(state, node, dtMs, rng);
    const newParticles = state.particles.slice(before);
    const edges = outgoingEdges(state, node.id);
    if (edges.length === 0) continue;
    for (const p of newParticles) {
      const edge = edges[0];
      p.location = { kind: "edge", id: edge.id, progress: 0 };
    }
  }
}

function processServices(state: EngineState, dtMs: number, rng: () => number): void {
  for (const node of state.diagram.nodes) {
    if (node.type !== "service") continue;
    tickService(state, node, dtMs, rng);
  }
  state.particles = state.particles.filter(
    (p) => p.status !== "completed" && p.status !== "failed",
  );
  void rng;
  void dtMs;
}
