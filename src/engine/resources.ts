import type { Node } from "@/schema";
import { emptyWindow, recordFail } from "./metrics";
import type { EngineState, NodeRuntime } from "./types";

export interface Utilization {
  cpu: number;
  mem: number;
  oom?: { fraction: number };
}

type ScalableNode = Extract<Node, { type: "service" | "worker" }>;

export function computeUtilization(
  rt: NodeRuntime,
  node: ScalableNode,
  _dtMs: number,
): Utilization {
  const resources = node.resources;
  if (!resources) return { cpu: 0, mem: 0 };

  const replicas = Math.max(1, rt.replicas ?? 1);
  const inFlight = Math.max(0, rt.inFlight ?? 0);
  const latencySeconds = node.latency_ms / 1000;
  const effectiveRps = latencySeconds === 0 ? inFlight * 1000 : inFlight / latencySeconds;
  const cpu =
    (effectiveRps * resources.cpu_per_request_ms) /
    (resources.cpu_limit_ms_per_sec * replicas);

  const mem =
    (inFlight * resources.mem_per_request_mb) /
    (resources.mem_limit_mb * replicas);

  return mem > 1 ? { cpu, mem, oom: { fraction: (mem - 1) / mem } } : { cpu, mem };
}

export function applyOom(state: EngineState, node: ScalableNode, rt: NodeRuntime): number[] {
  const mem = rt.mem_utilization ?? 0;
  if (mem <= 1) return [];

  const overflowFraction = (mem - 1) / mem;
  const targetKills = Math.max(1, Math.floor((rt.inFlight ?? 0) * overflowFraction));
  const killed: number[] = [];

  for (const particle of state.particles) {
    if (killed.length >= targetKills) break;
    if (
      particle.location.kind !== "node" ||
      particle.location.id !== node.id ||
      particle.status !== "processing"
    ) {
      continue;
    }

    particle.status = "failed";
    particle.failureReason = "oom";
    killed.push(particle.id);
    rt.inFlight = Math.max(0, (rt.inFlight ?? 0) - 1);
    state.counters.failed += 1;
    recordFail((state.metrics[node.id] ??= emptyWindow()), state.nowMs);
  }

  return killed;
}
