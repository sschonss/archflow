import type { Hpa, Node } from "@/schema";
import type { NodeRuntime } from "./types";

type ScalableNode = Extract<Node, { type: "service" | "worker" }>;
type HpaLike = Hpa & { target_cpu?: number; cooldown_ticks?: number };

export function computeDesiredReplicas(rt: NodeRuntime, hpa: HpaLike): number {
  const current = rt.replicas ?? hpa.min_replicas;
  const window = rt.hpaWindow ?? [];
  const windowTicks = hpa.stabilization_ticks ?? hpa.cooldown_ticks ?? 1;
  if (window.length < windowTicks) return clampReplicas(current, hpa);

  const recentWindow = window.slice(-windowTicks);
  const avgCpu = recentWindow.reduce((sum, value) => sum + value, 0) / recentWindow.length;
  const targetCpuPct = hpa.target_cpu_pct ?? hpa.target_cpu ?? 100;
  const target = Math.max(0.01, targetCpuPct / 100);
  const desired = Math.ceil(current * (avgCpu / target));

  return clampReplicas(desired, hpa);
}

export function tickHpa(node: ScalableNode, rt: NodeRuntime): void {
  const hpa = node.hpa as HpaLike | undefined;
  if (!hpa) return;

  if ((rt.hpaCooldownTicks ?? 0) > 0) {
    rt.hpaCooldownTicks = Math.max(0, (rt.hpaCooldownTicks ?? 0) - 1);
    return;
  }

  const current = rt.replicas ?? hpa.min_replicas;
  const desired = computeDesiredReplicas(rt, hpa);
  if (desired === current) return;

  rt.replicas = desired;
  rt.hpaWindow = [];
  rt.hpaCooldownTicks = hpa.cooldown_ticks ?? hpa.stabilization_ticks ?? 1;
}

function clampReplicas(value: number, hpa: Pick<HpaLike, "min_replicas" | "max_replicas">): number {
  return Math.max(hpa.min_replicas, Math.min(hpa.max_replicas, value));
}
