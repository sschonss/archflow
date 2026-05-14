import { describe, expect, it } from "vitest";
import { createEngine } from "@/engine";
import type { Diagram, ServiceNode } from "@/schema";
import type { EngineApi, Particle } from "@/engine";

const service: ServiceNode = {
  type: "service",
  id: "svc",
  label: "Service",
  latency_ms: 10,
  capacity_rps: 1000,
  error_rate: 0,
};

const serviceOnlyDiagram: Diagram = {
  version: 1,
  nodes: [service],
  edges: [],
};

const downstreamKilledDiagram: Diagram = {
  version: 1,
  nodes: [
    service,
    { ...service, id: "downstream", label: "Downstream" },
  ],
  edges: [{ id: "svc-downstream", source: "svc", target: "downstream", kind: "sync", latency_ms: 0, weight: 1 }],
};

const workerDiagram: Diagram = {
  version: 1,
  nodes: [
    { type: "worker", id: "worker", label: "Worker", concurrency: 1, latency_ms: 100, error_rate: 0 },
  ],
  edges: [],
};

function addParticle(engine: EngineApi, id: number, nodeId = "svc"): Particle {
  const particle: Particle = {
    id,
    originType: "http",
    bornAt: engine.state.nowMs,
    location: { kind: "node", id: nodeId },
    status: "in_flight",
  };
  engine.state.particles.push(particle);
  engine.state.nodes[nodeId].inFlight += 1;
  return particle;
}

function startOneServiceParticle(slowFactor?: number): EngineApi {
  const engine = createEngine(serviceOnlyDiagram, 1);
  if (slowFactor !== undefined) engine.state.nodes.svc.chaos = { slow_factor: slowFactor };
  addParticle(engine, 1);
  engine.tick(0);
  return engine;
}

describe("engine chaos semantics", () => {
  it("fails in-flight particles as unavailable when a service is killed mid-flow", () => {
    const engine = createEngine(serviceOnlyDiagram, 1);
    addParticle(engine, 1);
    addParticle(engine, 2);
    engine.tick(0);

    engine.state.nodes.svc.chaos = { killed: true };
    engine.tick(0);

    expect(engine.state.counters.failed).toBe(2);
    expect(engine.state.metrics.svc.fails).toHaveLength(2);
    expect(engine.state.particles).toEqual([]);
  });

  it("fails particles instead of completing them when every downstream route is killed", () => {
    const engine = createEngine(downstreamKilledDiagram, 1);
    engine.state.nodes.downstream.chaos = { killed: true };
    addParticle(engine, 1);

    engine.tick(0);
    engine.tick(10);

    expect(engine.state.counters.completed).toBe(0);
    expect(engine.state.counters.failed).toBe(1);
    expect(engine.state.metrics.svc.fails).toHaveLength(1);
    expect(engine.state.particles).toEqual([]);
  });

  it("releases worker capacity when a processing worker is killed", () => {
    const engine = createEngine(workerDiagram, 1);
    addParticle(engine, 1, "worker");
    engine.tick(0);
    expect(engine.state.nodes.worker.workersBusy).toBe(1);

    engine.state.nodes.worker.chaos = { killed: true };
    engine.tick(0);

    expect(engine.state.counters.failed).toBe(1);
    expect(engine.state.nodes.worker.workersBusy).toBe(0);
  });

  it("multiplies service latency by slow_factor", () => {
    const normal = startOneServiceParticle();
    normal.tick(10);

    const slow = startOneServiceParticle(3);
    slow.tick(10);
    expect(slow.state.counters.completed).toBe(0);
    slow.tick(20);

    expect(normal.state.metrics.svc.latencies[0]?.ms).toBe(10);
    expect(slow.state.metrics.svc.latencies[0]?.ms).toBe(30);
  });

  it("drops a seeded deterministic fraction of arrivals with reason dropped", () => {
    const run = (seed: number) => {
      const engine = createEngine(serviceOnlyDiagram, seed);
      engine.state.nodes.svc.chaos = { drop_fraction: 0.5 };
      for (let id = 1; id <= 100; id += 1) addParticle(engine, id);
      engine.tick(0);
      return engine.state.counters.failed;
    };

    const failed = run(123);

    expect(failed).toBeGreaterThanOrEqual(35);
    expect(failed).toBeLessThanOrEqual(65);
    expect(run(123)).toBe(failed);
    expect(run(124)).not.toBe(failed);
  });
});
