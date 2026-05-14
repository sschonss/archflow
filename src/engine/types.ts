import type { Diagram, Node, Edge } from "@/schema";

export type ParticleStatus =
  | "in_flight"
  | "processing"
  | "completed"
  | "failed";

export interface Particle {
  id: string;
  scenarioId: string | null;
  originNodeId: string;
  originType: "http" | "webhook" | "cron";
  /** Either a node id (when processing) or an edge id (when in flight). */
  location:
    | { kind: "node"; id: string }
    | { kind: "edge"; id: string; progress: number /* 0..1 */ };
  birthTimeMs: number;
  latencySoFarMs: number;
  status: ParticleStatus;
  failureReason?: string;
}

export interface NodeRuntime {
  nodeId: string;
  /** Time-domain accumulator for emission scheduling (Client only in v1). */
  emitAccumulatorMs: number;
  /** In-flight particles being processed by this node. */
  inFlight: Particle[];
}

export interface EngineState {
  diagram: Diagram;
  seed: number;
  rngState: number;
  /** Simulation time in ms since start. */
  nowMs: number;
  /** All particles currently alive. */
  particles: Particle[];
  /** Per-node runtime state (keyed by node id). */
  nodes: Record<string, NodeRuntime>;
  /** Counters since `reset`. */
  counters: { emitted: number; completed: number; failed: number };
  /** Monotonic id generator for particles. */
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
