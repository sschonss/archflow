import { describe, expect, it } from "vitest";
import { computeDesiredReplicas, tickHpa } from "@/engine/hpa";
import type { NodeRuntime } from "@/engine/types";
import type { ServiceNode } from "@/schema";

const node: ServiceNode = {
  id: "s",
  type: "service",
  label: "S",
  latency_ms: 10,
  capacity_rps: 100,
  error_rate: 0,
  hpa: { min_replicas: 1, max_replicas: 5, target_cpu_pct: 70, stabilization_ticks: 3 },
};

describe("hpa", () => {
  it("computes desired replicas from rolling average cpu", () => {
    const rt: NodeRuntime = { inFlight: 0, replicas: 1, hpaWindow: [0.9, 0.95, 1] };

    expect(computeDesiredReplicas(rt, node.hpa!)).toBe(2);
  });

  it("scales down when average cpu is far below target", () => {
    const rt: NodeRuntime = { inFlight: 0, replicas: 4, hpaWindow: [0.1, 0.1, 0.1] };

    expect(computeDesiredReplicas(rt, node.hpa!)).toBe(1);
  });

  it("clamps desired replicas to min and max", () => {
    expect(
      computeDesiredReplicas({ inFlight: 0, replicas: 1, hpaWindow: [0, 0, 0] }, node.hpa!),
    ).toBe(1);
    expect(
      computeDesiredReplicas({ inFlight: 0, replicas: 5, hpaWindow: [2, 2, 2] }, node.hpa!),
    ).toBe(5);
  });

  it("averages only the most recent stabilization window", () => {
    const rt: NodeRuntime = { inFlight: 0, replicas: 2, hpaWindow: [0.1, 0.1, 0.1, 0.9, 0.9, 0.9] };

    expect(computeDesiredReplicas(rt, node.hpa!)).toBe(3);
  });

  it("keeps current replicas until the window is full", () => {
    const rt: NodeRuntime = { inFlight: 0, replicas: 1, hpaWindow: [2, 2] };

    expect(computeDesiredReplicas(rt, node.hpa!)).toBe(1);
  });

  it("tickHpa applies scaling and starts a cooldown", () => {
    const rt: NodeRuntime = { inFlight: 0, replicas: 1, hpaWindow: [0.9, 0.95, 1] };

    tickHpa(node, rt);

    expect(rt.replicas).toBe(2);
    expect(rt.hpaWindow).toEqual([]);
    expect(rt.hpaCooldownTicks).toBe(3);
  });

  it("tickHpa honors cooldown between scaling decisions", () => {
    const rt: NodeRuntime = {
      inFlight: 0,
      replicas: 1,
      hpaWindow: [0.9, 0.95, 1],
      hpaCooldownTicks: 2,
    };

    tickHpa(node, rt);

    expect(rt.replicas).toBe(1);
    expect(rt.hpaCooldownTicks).toBe(1);
  });

  it("does nothing when hpa is undefined", () => {
    const noHpa: ServiceNode = { ...node, hpa: undefined };
    const rt: NodeRuntime = { inFlight: 0, replicas: 3, hpaWindow: [2, 2, 2] };

    tickHpa(noHpa, rt);

    expect(rt.replicas).toBe(3);
  });
});
