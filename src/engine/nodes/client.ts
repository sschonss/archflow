import type { ClientNode } from "@/schema";
import type { EngineState, Particle } from "@/engine/types";

/**
 * Emit particles from a Client node. Uses a time-domain accumulator so that
 * fractional particles per tick still produce the correct integer rate over
 * longer windows (deterministic, no RNG needed for `constant`).
 *
 * Patterns `burst` and `ramp` are implemented in Plan 2; for now they fall
 * back to constant.
 */
export function tickClient(
  state: EngineState,
  client: ClientNode,
  dtMs: number,
  _rng: () => number,
): void {
  const rt = state.nodes[client.id];
  if (!rt) return;

  const particlesPerMs = client.rps / 1000;
  rt.emitAccumulatorMs = (rt.emitAccumulatorMs ?? 0) + particlesPerMs * dtMs;

  const toEmit = Math.round(rt.emitAccumulatorMs ?? 0);
  for (let i = 0; i < toEmit; i++) {
    emitOne(state, client);
  }
  rt.emitAccumulatorMs = (rt.emitAccumulatorMs ?? 0) - toEmit;
}

function emitOne(state: EngineState, client: ClientNode): void {
  const id = state.nextParticleId++;
  const particle: Particle = {
    id,
    originType: "http",
    scenarioId: undefined,
    bornAt: state.nowMs,
    location: { kind: "node", id: client.id },
    status: "in_flight",
  };
  state.particles.push(particle);
  state.counters.emitted += 1;
}
