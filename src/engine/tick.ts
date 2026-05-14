import type { Edge, Node, Scenario } from "@/schema";
import { mulberry32 } from "./rng";
import type { EngineState, MetricsWindow, NodeRuntime, Particle } from "./types";
import { getEdge, getNode, outgoingEdges } from "./types";
import { tickClient } from "./nodes/client";
import { tickWebhook } from "./nodes/webhook";
import { pickBackend } from "./nodes/loadbalancer";
import { admitGateway } from "./nodes/gateway";
import { enqueue, dequeue, queueDepth } from "./nodes/queue";
import { canPick, startProcessing, finishProcessing, finishedAt } from "./nodes/worker";
import { cacheLookup } from "./nodes/cache";
import { acquireConn, expireWaiters, releaseConn } from "./nodes/database";
import { chooseEdge } from "./routing";
import { emptyWindow, recordComplete, recordEmit, recordFail, recordQueueDepth } from "./metrics";
import { tickTriggers } from "./triggers";

interface TimedJob {
  nodeId: string;
  startedAtMs: number;
  busyUntilMs: number;
}

interface CacheJob extends TimedJob {
  hit: boolean;
}

const serviceJobs = new WeakMap<EngineState, Map<number, TimedJob>>();
const workerJobs = new WeakMap<EngineState, Map<number, TimedJob>>();
const cacheJobs = new WeakMap<EngineState, Map<number, CacheJob>>();
const dbJobs = new WeakMap<EngineState, Map<number, TimedJob>>();

/**
 * Advance the simulation by `dtMs`. Pure function over EngineState (mutates
 * in place; cloning is the caller's job if they want history).
 */
export function tick(state: EngineState, dtMs: number): void {
  const rng = mulberry32(state.rngState);
  state.rngState = Math.floor(rng() * 0xffffffff);
  const tickRng = mulberry32(state.rngState);

  state.nowMs += dtMs;
  cleanupEphemeralState(state);
  tickTriggers(state, state.diagram);

  advanceEdges(state, dtMs);

  for (const node of state.diagram.nodes) {
    dispatchNode(state, node, dtMs, tickRng);
  }

  emitFromOrigins(state, dtMs, tickRng);

  state.particles = state.particles.filter(
    (p) => p.status !== "completed" && p.status !== "failed",
  );
  cleanupEphemeralState(state);
}

function advanceEdges(state: EngineState, dtMs: number): void {
  for (const p of state.particles) {
    if (p.location.kind !== "edge") continue;
    const edge = getEdge(state, p.location.id);
    if (!edge) continue;
    const stepProgress = edge.latency_ms === 0 ? 1 : dtMs / edge.latency_ms;
    p.location.progress += stepProgress;
    if (p.location.progress >= 1) {
      const target = getNode(state, edge.target);
      if (!target) continue;
      p.location = { kind: "node", id: target.id };
      p.status = "in_flight";
      const rt = state.nodes[target.id];
      if (rt) rt.inFlight += 1;
    }
  }
}

function dispatchNode(
  state: EngineState,
  node: Node,
  dtMs: number,
  rng: () => number,
): void {
  const rt = state.nodes[node.id];
  if (!rt) return;

  switch (node.type) {
    case "client":
    case "webhook":
      return;
    case "gateway":
      processGateway(state, node, rt, rng);
      return;
    case "load_balancer":
      processLoadBalancer(state, node, rt, rng);
      return;
    case "service":
      processService(state, node, rng);
      return;
    case "worker":
      processWorker(state, node, rt, rng);
      return;
    case "queue":
      processQueue(state, node, rt);
      return;
    case "cache":
      processCache(state, node, rng);
      return;
    case "database":
      processDatabase(state, node, rt, rng);
      return;
    default:
      void dtMs;
  }
}

function emitFromOrigins(state: EngineState, dtMs: number, rng: () => number): void {
  for (const node of state.diagram.nodes) {
    if (node.type !== "client" && node.type !== "webhook") continue;

    const before = state.particles.length;
    if (node.type === "client") {
      tickClient(state, node, dtMs, rng);
    } else {
      for (const emitted of tickWebhook(node, state.nodes[node.id], {
        rng,
        dtMs,
        nowMs: state.nowMs,
      })) {
        state.particles.push({
          id: state.nextParticleId++,
          originType: emitted.originType,
          bornAt: emitted.bornAt,
          location: { kind: "node", id: node.id },
          status: "in_flight",
        });
        state.counters.emitted += 1;
      }
    }

    const newParticles = state.particles.slice(before);
    for (const p of newParticles) {
      p.scenarioId = chooseScenario(state.scenarios, node.id, rng)?.id;
      recordEmit(metricsFor(state, node.id), state.nowMs);
      routeParticle(state, node.id, p, rng);
    }
  }
}

function processGateway(
  state: EngineState,
  node: Extract<Node, { type: "gateway" }>,
  rt: NodeRuntime,
  rng: () => number,
): void {
  for (const p of particlesAt(state, node.id)) {
    if (p.status !== "in_flight" && p.status !== "processing") continue;
    recordEmit(metricsFor(state, node.id), state.nowMs);
    const admitted = admitGateway(node, rt, state.nowMs);
    if (!admitted.ok) {
      failParticle(state, node.id, p, admitted.reason);
      continue;
    }
    routeParticle(state, node.id, p, rng);
  }
}

function processLoadBalancer(
  state: EngineState,
  node: Extract<Node, { type: "load_balancer" }>,
  rt: NodeRuntime,
  rng: () => number,
): void {
  const outEdges = outgoingEdges(state, node.id);
  const edgeIds = outEdges.map((e) => e.id);
  if (edgeIds.length === 0) return;

  const inFlightByBackend: Record<string, number> = {};
  for (const edge of outEdges) {
    inFlightByBackend[edge.id] = state.nodes[edge.target]?.inFlight ?? 0;
  }

  for (const p of particlesAt(state, node.id)) {
    const edgeId = pickBackend(node.strategy, edgeIds, rt, rng, inFlightByBackend);
    p.location = { kind: "edge", id: edgeId, progress: 0 };
    p.status = "in_flight";
    rt.inFlight = Math.max(0, rt.inFlight - 1);
    inFlightByBackend[edgeId] = (inFlightByBackend[edgeId] ?? 0) + 1;
  }
}

function processService(
  state: EngineState,
  node: Extract<Node, { type: "service" }>,
  rng: () => number,
): void {
  for (const p of particlesAt(state, node.id)) {
    if (p.status !== "in_flight" && p.status !== "processing") continue;
    const jobs = jobMap(serviceJobs, state);
    if (!jobs.has(p.id)) {
      jobs.set(p.id, {
        nodeId: node.id,
        startedAtMs: state.nowMs,
        busyUntilMs: state.nowMs + node.latency_ms,
      });
    }
    p.status = "processing";
  }

  const jobs = jobMap(serviceJobs, state);
  for (const [particleId, job] of Array.from(jobs.entries())) {
    if (job.nodeId !== node.id || state.nowMs < job.busyUntilMs) continue;
    const p = findParticle(state, particleId);
    jobs.delete(particleId);
    if (!p || p.location.kind !== "node" || p.location.id !== node.id) continue;

    if (rng() < node.error_rate) {
      failParticle(state, node.id, p, "503");
      continue;
    }

    recordComplete(metricsFor(state, node.id), state.nowMs, state.nowMs - p.bornAt);
    routeOrComplete(state, node.id, p, rng);
  }
}

function processWorker(
  state: EngineState,
  node: Extract<Node, { type: "worker" }>,
  rt: NodeRuntime,
  rng: () => number,
): void {
  const jobs = jobMap(workerJobs, state);
  for (const [particleId, job] of Array.from(jobs.entries())) {
    if (job.nodeId !== node.id || state.nowMs < job.busyUntilMs) continue;
    const p = findParticle(state, particleId);
    jobs.delete(particleId);
    finishProcessing(node, rt);
    if (!p || p.location.kind !== "node" || p.location.id !== node.id) continue;

    if (rng() < node.error_rate) {
      failParticle(state, node.id, p, "503");
      continue;
    }

    recordComplete(metricsFor(state, node.id), state.nowMs, state.nowMs - p.bornAt);
    routeOrComplete(state, node.id, p, rng);
  }

  startWorkerParticlesAtNode(state, node, rt);
  pullFromUpstreamQueues(state, node, rt);
}

function startWorkerParticlesAtNode(
  state: EngineState,
  node: Extract<Node, { type: "worker" }>,
  rt: NodeRuntime,
): void {
  const jobs = jobMap(workerJobs, state);
  for (const p of particlesAt(state, node.id)) {
    if (p.status !== "in_flight" && p.status !== "processing") continue;
    if (jobs.has(p.id)) continue;
    if (!canPick(node, rt)) break;
    startProcessing(node, rt);
    p.status = "processing";
    jobs.set(p.id, {
      nodeId: node.id,
      startedAtMs: state.nowMs,
      busyUntilMs: finishedAt(node, state.nowMs),
    });
  }
}

function pullFromUpstreamQueues(
  state: EngineState,
  node: Extract<Node, { type: "worker" }>,
  rt: NodeRuntime,
): void {
  const jobs = jobMap(workerJobs, state);
  for (const edge of state.diagram.edges) {
    if (edge.target !== node.id) continue;
    const source = getNode(state, edge.source);
    if (!source || source.type !== "queue") continue;
    const sourceRt = state.nodes[source.id];
    if (!sourceRt) continue;

    while (canPick(node, rt)) {
      const particleId = dequeue(sourceRt);
      if (particleId === undefined) break;
      decrementInFlight(state, source.id);
      recordQueueDepth(metricsFor(state, source.id), state.nowMs, queueDepth(sourceRt));
      const p = findParticle(state, particleId);
      if (!p || p.status === "failed" || p.status === "completed") continue;
      startProcessing(node, rt);
      rt.inFlight += 1;
      p.location = { kind: "node", id: node.id };
      p.status = "processing";
      jobs.set(p.id, {
        nodeId: node.id,
        startedAtMs: state.nowMs,
        busyUntilMs: finishedAt(node, state.nowMs),
      });
    }
  }
}

function processQueue(
  state: EngineState,
  node: Extract<Node, { type: "queue" }>,
  rt: NodeRuntime,
): void {
  for (const p of particlesAt(state, node.id)) {
    if (p.status === "queued") continue;
    const result = enqueue(node, rt, p.id);
    if (!result.ok) {
      failParticle(state, node.id, p, result.reason);
    } else {
      p.status = "queued";
      p.enqueuedAt = state.nowMs;
    }
    recordQueueDepth(metricsFor(state, node.id), state.nowMs, queueDepth(rt));
  }
}

function processCache(
  state: EngineState,
  node: Extract<Node, { type: "cache" }>,
  rng: () => number,
): void {
  for (const p of particlesAt(state, node.id)) {
    if (p.status !== "in_flight" && p.status !== "processing") continue;
    const jobs = jobMap(cacheJobs, state);
    if (!jobs.has(p.id)) {
      const lookup = cacheLookup(node, rng);
      jobs.set(p.id, {
        nodeId: node.id,
        startedAtMs: state.nowMs,
        busyUntilMs: state.nowMs + lookup.latencyMs,
        hit: lookup.hit,
      });
      p.status = "processing";
    }
  }

  const jobs = jobMap(cacheJobs, state);
  for (const [particleId, job] of Array.from(jobs.entries())) {
    if (job.nodeId !== node.id || state.nowMs < job.busyUntilMs) continue;
    const p = findParticle(state, particleId);
    jobs.delete(particleId);
    if (!p || p.location.kind !== "node" || p.location.id !== node.id) continue;

    const edge = pickCacheEdge(outgoingEdges(state, node.id), job.hit);
    if (edge) {
      p.location = { kind: "edge", id: edge.id, progress: 0 };
      p.status = "in_flight";
      decrementInFlight(state, node.id);
    } else {
      completeParticle(state, node.id, p);
    }
  }
}

function processDatabase(
  state: EngineState,
  node: Extract<Node, { type: "database" }>,
  rt: NodeRuntime,
  rng: () => number,
): void {
  for (const expiredId of expireWaiters(rt, state.nowMs)) {
    const p = findParticle(state, expiredId);
    if (p) failParticle(state, node.id, p, "timeout");
  }

  for (const p of particlesAt(state, node.id)) {
    if (p.status !== "in_flight" && p.status !== "processing") continue;
    const jobs = jobMap(dbJobs, state);
    if (jobs.has(p.id) || rt.waiters?.some((w) => w.particleId === p.id)) continue;
    const acquired = acquireConn(node, rt, p.id, state.nowMs);
    p.status = "processing";
    if (acquired.granted) {
      jobs.set(p.id, {
        nodeId: node.id,
        startedAtMs: state.nowMs,
        busyUntilMs: state.nowMs + node.query_latency_ms,
      });
    }
  }

  const jobs = jobMap(dbJobs, state);
  for (const [particleId, job] of Array.from(jobs.entries())) {
    if (job.nodeId !== node.id || state.nowMs < job.busyUntilMs) continue;
    const p = findParticle(state, particleId);
    jobs.delete(particleId);
    if (p && p.location.kind === "node" && p.location.id === node.id) {
      recordComplete(metricsFor(state, node.id), state.nowMs, state.nowMs - p.bornAt);
      routeOrComplete(state, node.id, p, rng);
    }

    const promotedId = releaseConn(rt, state.nowMs);
    if (promotedId !== undefined) {
      const promoted = findParticle(state, promotedId);
      if (promoted && promoted.status !== "failed" && promoted.status !== "completed") {
        promoted.status = "processing";
        jobs.set(promotedId, {
          nodeId: node.id,
          startedAtMs: state.nowMs,
          busyUntilMs: state.nowMs + node.query_latency_ms,
        });
      }
    }
  }
}

function routeOrComplete(
  state: EngineState,
  nodeId: string,
  p: Particle,
  rng: () => number,
): void {
  const edge = chooseEdge(outgoingEdges(state, nodeId), p.scenarioId, rng);
  if (!edge) {
    completeParticle(state, nodeId, p);
    return;
  }
  p.location = { kind: "edge", id: edge.id, progress: 0 };
  p.status = "in_flight";
  decrementInFlight(state, nodeId);
}

function routeParticle(
  state: EngineState,
  nodeId: string,
  p: Particle,
  rng: () => number,
): void {
  const edge = chooseEdge(outgoingEdges(state, nodeId), p.scenarioId, rng);
  if (!edge) return;
  p.location = { kind: "edge", id: edge.id, progress: 0 };
  p.status = "in_flight";
  decrementInFlight(state, nodeId);
}

function completeParticle(state: EngineState, nodeId: string, p: Particle): void {
  p.status = "completed";
  state.counters.completed += 1;
  decrementInFlight(state, nodeId);
}

function failParticle(
  state: EngineState,
  nodeId: string,
  p: Particle,
  reason: Particle["failureReason"],
): void {
  p.status = "failed";
  p.failureReason = reason;
  state.counters.failed += 1;
  recordFail(metricsFor(state, nodeId), state.nowMs);
  decrementInFlight(state, nodeId);
}

function chooseScenario(
  scenarios: readonly Scenario[],
  originId: string,
  rng: () => number,
): Scenario | undefined {
  const candidates = scenarios.filter((s) => s.origin === originId);
  if (candidates.length === 0) return undefined;
  const total = candidates.reduce((sum, s) => sum + (s.weight ?? 1), 0);
  let pick = rng() * total;
  for (const scenario of candidates) {
    pick -= scenario.weight ?? 1;
    if (pick <= 0) return scenario;
  }
  return candidates[candidates.length - 1];
}

function pickCacheEdge(edges: Edge[], hit: boolean): Edge | undefined {
  if (edges.length === 0) return undefined;
  if (!hit) return edges.find((e) => e.tags?.includes("tag:miss")) ?? edges[0];
  return (
    edges.find((e) => e.tags?.includes("tag:hit")) ??
    edges.find((e) => !e.tags?.includes("tag:miss")) ??
    edges[0]
  );
}

function particlesAt(state: EngineState, nodeId: string): Particle[] {
  return state.particles.filter(
    (p) => p.location.kind === "node" && p.location.id === nodeId,
  );
}

function findParticle(state: EngineState, id: number): Particle | undefined {
  return state.particles.find((p) => p.id === id);
}

function metricsFor(state: EngineState, nodeId: string): MetricsWindow {
  return (state.metrics[nodeId] ??= emptyWindow());
}

function decrementInFlight(state: EngineState, nodeId: string): void {
  const rt = state.nodes[nodeId];
  if (rt) rt.inFlight = Math.max(0, rt.inFlight - 1);
}

function cleanupEphemeralState(state: EngineState): void {
  const liveIds = new Set(state.particles.map((p) => p.id));
  for (const map of [
    jobMap(serviceJobs, state),
    jobMap(workerJobs, state),
    jobMap(cacheJobs, state),
    jobMap(dbJobs, state),
  ]) {
    for (const id of map.keys()) {
      if (!liveIds.has(id)) map.delete(id);
    }
  }
}

function jobMap<T>(
  store: WeakMap<EngineState, Map<number, T>>,
  state: EngineState,
): Map<number, T> {
  let map = store.get(state);
  if (!map) {
    map = new Map<number, T>();
    store.set(state, map);
  }
  return map;
}
