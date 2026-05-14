import { create } from "zustand";
import type { Diagram } from "@/schema";
import { createEngine, type EngineApi } from "@/engine";

interface EngineStore {
  engine: EngineApi | null;
  diagram: Diagram | null;
  seed: number;
  isRunning: boolean;
  /** Tick used to force React re-renders without copying particles. */
  tickCount: number;

  loadDiagram(diagram: Diagram, seed?: number): void;
  setSeed(seed: number): void;
  play(): void;
  pause(): void;
  reset(): void;
  /** Called by the RAF loop. */
  step(dtMs: number): void;
}

export const useEngineStore = create<EngineStore>((set, get) => ({
  engine: null,
  diagram: null,
  seed: 42,
  isRunning: false,
  tickCount: 0,

  loadDiagram(diagram, seed) {
    const s = seed ?? get().seed;
    set({ diagram, engine: createEngine(diagram, s), seed: s, tickCount: 0 });
  },

  setSeed(seed) {
    const { diagram } = get();
    if (diagram) set({ engine: createEngine(diagram, seed), seed, tickCount: 0 });
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
    set({ tickCount: 0, isRunning: false });
  },
  step(dtMs) {
    const { engine } = get();
    if (!engine) return;
    engine.tick(dtMs);
    set({ tickCount: get().tickCount + 1 });
  },
}));
