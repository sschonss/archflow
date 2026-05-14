import type { Diagram, Node, Edge, Scenario } from "@/schema";

export type FailureReason =
  | "429"
  | "503"
  | "timeout"
  | "queue_overflow"
  | "oom"
  | "unavailable"
  | "dropped";

export type ParticleStatus =
  | "in_flight"
  | "processing"
  | "queued"
  | "completed"
  | "failed";

export interface Particle {
  id: number;
  originType: "http" | "webhook" | "cron";
  scenarioId?: string;
  bornAt: number;
  enqueuedAt?: number;
  location:
    | { kind: "node"; id: string }
    | { kind: "edge"; id: string; progress: number };
  status: ParticleStatus;
  failureReason?: FailureReason;
}

export interface NodeRuntime {
  // shared
  inFlight: number;
  chaos?: { killed?: boolean; slow_factor?: number; drop_fraction?: number };
  // client / webhook
  emitAccumulatorMs?: number;
  // service / worker
  busyUntilMs?: number;
  // service / worker (resources & HPA)
  replicas?: number;
  cpu_utilization?: number;
  mem_utilization?: number;
  hpaWindow?: number[];
  hpaCooldownTicks?: number;
  // worker
  workersBusy?: number;
  // gateway
  tokens?: number;
  lastRefillMs?: number;
  // queue
  queue?: number[];
  // load_balancer
  rrCursor?: number;
  // database
  poolUsed?: number;
  waiters?: { particleId: number; deadlineMs: number }[];
  // cron
  cronNextMs?: Record<string, number>;
}

export interface MetricsWindow {
  emits: number[];
  completes: number[];
  fails: number[];
  latencies: { t: number; ms: number }[];
  queueDepth: { t: number; n: number }[];
}

export interface EngineState {
  diagram: Diagram;
  seed: number;
  rngState: number;
  nowMs: number;
  particles: Particle[];
  nodes: Record<string, NodeRuntime>;
  metrics: Record<string, MetricsWindow>;
  scenarios: Scenario[];
  counters: { emitted: number; completed: number; failed: number };
  nextParticleId: number;
}

export interface EngineApi {
  state: EngineState;
  tick(dtMs: number): void;
  reset(): void;
}

/** Helper accessors. */
export function getNode(state: EngineState, id: string): Node | undefined {
  return state.diagram.nodes.find((n) => n.id === id);
}

export function getEdge(state: EngineState, id: string): Edge | undefined {
  return state.diagram.edges.find((e) => e.id === id);
}

export function outgoingEdges(state: EngineState, nodeId: string): Edge[] {
  return state.diagram.edges.filter((e) => e.source === nodeId);
}
