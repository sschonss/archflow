import { describe, expect, it } from "vitest";
import { applyOom, computeUtilization } from "@/engine/resources";
import type { EngineState, NodeRuntime, Particle } from "@/engine/types";
import type { ServiceNode } from "@/schema";

const node: ServiceNode = {
  id: "s",
  type: "service",
  label: "S",
  latency_ms: 10,
  capacity_rps: 100,
  error_rate: 0,
  resources: {
    cpu_per_request_ms: 5,
    mem_per_request_mb: 10,
    cpu_limit_ms_per_sec: 1000,
    mem_limit_mb: 100,
  },
};

function makeState(particles: Particle[], rt: NodeRuntime): EngineState {
  return {
    diagram: { version: 1, nodes: [node], edges: [] },
    seed: 1,
    rngState: 1,
    nowMs: 0,
    particles,
    nodes: { [node.id]: rt },
    metrics: {},
    scenarios: [],
    counters: { emitted: particles.length, completed: 0, failed: 0 },
    nextParticleId: particles.length + 1,
  };
}

describe("resources", () => {
  it("computes cpu from effective rps over latency and divides by replicas", () => {
    const rt: NodeRuntime = { inFlight: 5, replicas: 1 };

    const u = computeUtilization(rt, node, 100);

    expect(u.cpu).toBeCloseTo(2.5, 3);
    expect(u.mem).toBeCloseTo(0.5, 3);
  });

  it("replicas reduce cpu and memory utilization proportionally", () => {
    const single: NodeRuntime = { inFlight: 5, replicas: 1 };
    const doubled: NodeRuntime = { inFlight: 5, replicas: 2 };

    const u1 = computeUtilization(single, node, 100);
    const u2 = computeUtilization(doubled, node, 100);

    expect(u2.cpu).toBeCloseTo(u1.cpu / 2, 3);
    expect(u2.mem).toBeCloseTo(u1.mem / 2, 3);
  });

  it("returns zeros and no OOM info when resources are absent", () => {
    const noResources: ServiceNode = { ...node, resources: undefined };

    const u = computeUtilization({ inFlight: 5, replicas: 1 }, noResources, 100);

    expect(u).toEqual({ cpu: 0, mem: 0 });
  });

  it("reports OOM overflow when memory utilization exceeds 100%", () => {
    const u = computeUtilization({ inFlight: 15, replicas: 1 }, node, 100);

    expect(u.mem).toBe(1.5);
    expect(u.oom).toEqual({ fraction: expect.closeTo(1 / 3, 3) });
  });

  it("applyOom fails enough processing particles with reason oom", () => {
    const particles: Particle[] = [1, 2, 3].map((id) => ({
      id,
      originType: "http" as const,
      bornAt: 0,
      location: { kind: "node" as const, id: "s" },
      status: "processing" as const,
    }));
    const rt: NodeRuntime = { inFlight: 3, replicas: 1, mem_utilization: 1.5 };
    const state = makeState(particles, rt);

    const killed = applyOom(state, node, rt);

    expect(killed).toHaveLength(1);
    expect(state.counters.failed).toBe(1);
    expect(rt.inFlight).toBe(2);
    expect(state.particles.find((p) => p.id === killed[0])?.failureReason).toBe("oom");
  });
});
