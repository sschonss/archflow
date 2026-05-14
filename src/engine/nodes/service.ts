import type { ServiceNode } from "@/schema";
import type { EngineState, Particle } from "@/engine/types";

interface ProcessingMeta {
  startedAtMs: number;
}

const meta = new WeakMap<Particle, ProcessingMeta>();

/**
 * Process particles inside a Service node. v1 Foundation: single-replica,
 * unbounded queue, fixed latency, stochastic error_rate. Capacity, replicas,
 * stddev latency, retries, etc. arrive in Plan 2 / Plan 3.
 */
export function tickService(
  state: EngineState,
  service: ServiceNode,
  dtMs: number,
  rng: () => number,
): void {
  const rt = state.nodes[service.id];
  if (!rt) return;

  const processing: Particle[] = [];
  for (const p of state.particles) {
    if (p.location.kind === "node" && p.location.id === service.id && (p.status === "in_flight" || p.status === "processing")) {
      const wasInFlight = p.status === "in_flight";
      if (wasInFlight) {
        p.status = "processing";
      }
      if (!meta.has(p)) {
        const enteredAt = wasInFlight ? state.nowMs : state.nowMs - dtMs;
        meta.set(p, { startedAtMs: enteredAt });
      }
      processing.push(p);
    }
  }

  for (const p of processing) {
    const m = meta.get(p)!;
    const elapsed = state.nowMs - m.startedAtMs;
    if (elapsed >= service.latency_ms) {
      const errored = rng() < service.error_rate;
      if (errored) {
        p.status = "failed";
        p.failureReason = "503";
        state.counters.failed += 1;
      } else {
        p.status = "completed";
        state.counters.completed += 1;
      }
      meta.delete(p);
      const idx = state.particles.indexOf(p);
      if (idx !== -1) state.particles.splice(idx, 1);
    }
  }
}
