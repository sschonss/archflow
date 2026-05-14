import { create } from "zustand";
import type { Diagram } from "@/schema";
import { createEngine, type EngineApi } from "@/engine";
import { parseDiagram } from "@/lib/yaml";
import { computeStats, type Stats } from "@/engine/metrics";

interface NodeHistory {
  rps_in: number[];
  cpu: number[];
  replicas: number[];
}

const HISTORY_MAX = 120; // ~12 seconds at 100ms ticks

interface EngineStore {
  engine: EngineApi | null;
  diagram: Diagram | null;
  seed: number;
  isRunning: boolean;
  /** Tick used to force React re-renders without copying particles. */
  tickCount: number;
  selectedNodeId: string | null;
  history: Record<string, NodeHistory>;

  loadDiagram(diagram: Diagram, seed?: number): void;
  setDiagramFromYaml(text: string): { ok: true } | { ok: false; error: string };
  updateNodePosition(id: string, position: { x: number; y: number }): void;
  chaosKillNode(id: string): void;
  chaosSlowNode(id: string, factor?: number): void;
  chaosDropRequests(id: string, fraction?: number): void;
  chaosClear(id?: string): void;
  setSeed(seed: number): void;
  play(): void;
  pause(): void;
  reset(): void;
  /** Called by the RAF loop. */
  step(dtMs: number): void;
  selectNode(id: string | null): void;
  getMetrics(nodeId: string): Stats | null;
  getHistory(nodeId: string): NodeHistory | null;
}

export const useEngineStore = create<EngineStore>((set, get) => ({
  engine: null,
  diagram: null,
  seed: 42,
  isRunning: false,
  tickCount: 0,
  selectedNodeId: null,
  history: {},

  loadDiagram(diagram, seed) {
    const s = seed ?? get().seed;
    set({ diagram, engine: createEngine(diagram, s), seed: s, tickCount: 0, history: {} });
  },

  setDiagramFromYaml(text) {
    try {
      const diagram = parseDiagram(text);
      get().loadDiagram(diagram);
      return { ok: true };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return { ok: false, error: message };
    }
  },

  updateNodePosition(id, position) {
    const { diagram, seed } = get();
    if (!diagram) return;

    let changed = false;
    const nextDiagram: Diagram = {
      ...diagram,
      nodes: diagram.nodes.map((node) => {
        if (node.id !== id) return node;
        changed = true;
        return { ...node, position };
      }),
    };
    if (!changed) return;

    set({ diagram: nextDiagram, engine: createEngine(nextDiagram, seed), tickCount: 0, history: {} });
  },

  chaosKillNode(id) {
    const { engine, tickCount } = get();
    const rt = engine?.state.nodes[id];
    if (!rt) return;
    rt.chaos = { ...rt.chaos, killed: true };
    set({ tickCount: tickCount + 1 });
  },

  chaosSlowNode(id, factor = 2) {
    const { engine, tickCount } = get();
    const rt = engine?.state.nodes[id];
    if (!rt) return;
    rt.chaos = { ...rt.chaos, slow_factor: factor };
    set({ tickCount: tickCount + 1 });
  },

  chaosDropRequests(id, fraction = 0.5) {
    const { engine, tickCount } = get();
    const rt = engine?.state.nodes[id];
    if (!rt) return;
    rt.chaos = { ...rt.chaos, drop_fraction: fraction };
    set({ tickCount: tickCount + 1 });
  },

  chaosClear(id) {
    const { engine, tickCount } = get();
    if (!engine) return;
    if (id !== undefined) {
      const rt = engine.state.nodes[id];
      if (!rt) return;
      delete rt.chaos;
    } else {
      for (const rt of Object.values(engine.state.nodes)) delete rt.chaos;
    }
    set({ tickCount: tickCount + 1 });
  },

  setSeed(seed) {
    const { diagram } = get();
    if (diagram) set({ engine: createEngine(diagram, seed), seed, tickCount: 0, history: {} });
    else set({ seed });
  },

  play() {
    if (!get().engine) return;
    set({ isRunning: true });
  },
  pause() {
    set({ isRunning: false });
  },
  reset() {
    const { engine } = get();
    if (engine) engine.reset();
    set({ tickCount: 0, isRunning: false, history: {} });
  },
  step(dtMs) {
    const { engine } = get();
    if (!engine) return;
    engine.tick(dtMs);
    
    // Collect history for each service/worker node
    const next = { ...get().history };
    for (const node of engine.state.diagram.nodes) {
      if (node.type !== 'service' && node.type !== 'worker') continue;
      const rt = engine.state.nodes[node.id];
      const w = engine.state.metrics[node.id];
      const stats = w ? computeStats(w, engine.state.nowMs) : null;
      const h = next[node.id] ?? { rps_in: [], cpu: [], replicas: [] };
      h.rps_in = [...h.rps_in, stats?.rps_in ?? 0].slice(-HISTORY_MAX);
      h.cpu = [...h.cpu, rt.cpu_utilization ?? 0].slice(-HISTORY_MAX);
      h.replicas = [...h.replicas, rt.replicas ?? 1].slice(-HISTORY_MAX);
      next[node.id] = h;
    }
    set({ history: next, tickCount: get().tickCount + 1 });
  },
  selectNode(id) {
    set({ selectedNodeId: id });
  },
  getMetrics(nodeId) {
    const { engine } = get();
    if (!engine) return null;
    const metrics = engine.state.metrics[nodeId];
    if (!metrics) return null;
    return computeStats(metrics, engine.state.nowMs);
  },
  getHistory(nodeId) {
    return get().history[nodeId] ?? null;
  },
}));
