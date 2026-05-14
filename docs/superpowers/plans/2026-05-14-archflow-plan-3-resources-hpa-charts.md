# archflow Plan 3 — Resources, HPA & Charts

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-replica simulated resources (CPU/memory utilization) to Service and Worker, a Kubernetes-style horizontal pod autoscaler (HPA) that scales replicas based on CPU thresholds, an OOM-kill failure mode, a decorative `Cluster` grouping node, and live time-series sparkline charts (rps_in / cpu / replicas) inside the Inspector.

**Architecture:**
- Resources are still purely simulated. Each Service/Worker tracks `replicas` (current count) and per-tick computed `cpu_utilization`, `mem_utilization` derived from the in-flight load and the configured request budget. Capacity scales linearly with `replicas`.
- HPA is a tiny pure module (`src/engine/hpa.ts`) that runs once per tick and adjusts each node's `replicas` toward the target by comparing the metric (CPU) against `target_cpu_pct`, with a min/max clamp and a stabilization window to avoid flapping.
- OOM kicks in when `mem_utilization` exceeds 1.0 — the offending in-flight particle fails with `failureReason: 'oom'` and a replica restart is simulated by zeroing its in-flight count for one tick.
- The `Cluster` node is decorative-only: it has no runtime, no edges may originate at it (validated at parse time, soft-warn — not hard-fail), and the renderer draws it as a labeled boundary box that wraps its `members[]` (other node ids).
- Charts use `uplot` (≈40kB, no React deps): each `<Sparkline>` is a tiny wrapper that creates a uPlot instance once and pushes new samples on `tickCount` change. Sparklines render rps_in, cpu, and replicas for the selected node.

**Tech Stack:** Same as Plan 2 + new runtime dep `uplot`. (No charting framework — uPlot is the smallest fast canvas charter.)

---

## File Structure

**Schema (extended):**
- Modify: `src/schema/diagram.ts`
  - Add `ResourcesSchema` (`cpu_per_request_ms`, `mem_per_request_mb`, `cpu_limit_ms_per_sec`, `mem_limit_mb`).
  - Extend `ServiceNodeSchema` and `WorkerNodeSchema` with optional `resources` and optional `hpa` (`{ min_replicas, max_replicas, target_cpu_pct, stabilization_ticks? }`).
  - Add `ClusterSchema` (`type: 'cluster'`, `id`, `label`, `members: string[]`, `position`).
  - Add `'cluster'` to the `NodeSchema` discriminated union.

**Engine:**
- Modify: `src/engine/types.ts`
  - Extend `NodeRuntime` with `replicas?: number`, `cpu_utilization?: number`, `mem_utilization?: number`, `hpaWindow?: number[]` (recent CPU samples for stabilization).
  - Add `'oom'` is already in `FailureReason` (introduced Plan 2). Confirm.
- Create: `src/engine/resources.ts` — pure functions:
  - `computeUtilization(node, rt, dtMs): { cpu: number; mem: number }`
  - `applyOom(state, node, rt): number[]` — returns ids of particles killed this tick.
- Create: `src/engine/hpa.ts` — pure function:
  - `tickHpa(state, node, rt): void` — adjusts `rt.replicas` based on `rt.hpaWindow` average vs `target_cpu_pct`.
- Modify: `src/engine/tick.ts`
  - For each Service/Worker, after processing, call `computeUtilization`, push to `rt.hpaWindow`, call `applyOom`, then `tickHpa`. Capacity calculations everywhere multiply `capacity_rps` (or `concurrency`) by `rt.replicas ?? 1`.
- Modify: `src/engine/index.ts`
  - In `buildInitial`, set `rt.replicas = node.hpa?.min_replicas ?? 1` for nodes that support HPA; init `hpaWindow: []`.

**UI:**
- New runtime dep: `uplot` (`npm i uplot`).
- Create: `src/components/charts/Sparkline.tsx` — uPlot wrapper.
- Create: `src/components/canvas/nodes/ClusterNode.tsx` — decorative boundary box (uses React Flow's `parentNode`/group functionality, or a simple absolutely-positioned div behind the members — the simpler approach is fine).
- Modify: `src/components/canvas/FlowCanvas.tsx` — render Clusters as React Flow `type: 'group'` nodes, sized to bound their members; place them behind via `zIndex: -1` or `selectable: false`.
- Modify: `src/components/Inspector.tsx` — add 3 sparklines (rps_in, cpu_utilization, replicas) below the metrics list when the selected node is a Service or Worker.
- Modify: `src/components/canvas/nodes/ServiceNode.tsx` and `WorkerNode.tsx` — show `replicas` badge in the top-right corner; flash CPU bar (a thin colored line at the bottom of the card) tinted red when CPU > 80%.
- Modify: `src/store/engineStore.ts` — add a `getHistory(nodeId, key, maxPoints?)` selector that returns ring-buffered samples for sparklines; or implement the ring buffer per node inside Sparkline using `useRef`.

**Examples:**
- Create: `src/examples/scaling-demo.archflow.yaml` — single client → service with HPA (`min=1, max=10, target_cpu_pct=70`); show ramp pattern that triggers scale-up. Includes a Cluster wrapping the service replicas (decorative).
- Modify: `src/App.tsx` — add `'scaling'` to the existing dropdown picker.

**Tests:**
- `tests/schema/resources.test.ts` — schema accepts resources, hpa, cluster.
- `tests/engine/resources.test.ts` — utilization math + OOM trigger.
- `tests/engine/hpa.test.ts` — scale-up, scale-down, clamp at min/max, stabilization.
- `tests/engine/scaling.integration.test.ts` — ramp client triggers replicas to grow.

---

## Task 1: Schema — resources, hpa, cluster

**Files:**
- Modify: `src/schema/diagram.ts`
- Test: `tests/schema/resources.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/schema/resources.test.ts
import { describe, it, expect } from 'vitest';
import { DiagramSchema } from '@/schema/diagram';

describe('schema: resources, hpa, cluster', () => {
  it('accepts resources + hpa on a service', () => {
    const r = DiagramSchema.safeParse({
      version: 1,
      nodes: [
        {
          id: 's', type: 'service', label: 'S',
          latency_ms: 10, capacity_rps: 100, error_rate: 0,
          resources: {
            cpu_per_request_ms: 5,
            mem_per_request_mb: 2,
            cpu_limit_ms_per_sec: 1000,
            mem_limit_mb: 512,
          },
          hpa: { min_replicas: 1, max_replicas: 10, target_cpu_pct: 70 },
        },
      ],
      edges: [],
    });
    expect(r.success).toBe(true);
  });

  it('accepts a cluster node with members', () => {
    const r = DiagramSchema.safeParse({
      version: 1,
      nodes: [
        { id: 's', type: 'service', label: 'S', latency_ms: 10, capacity_rps: 100, error_rate: 0 },
        { id: 'cl', type: 'cluster', label: 'Prod', members: ['s'] },
      ],
      edges: [],
    });
    expect(r.success).toBe(true);
  });

  it('rejects hpa with min > max', () => {
    const r = DiagramSchema.safeParse({
      version: 1,
      nodes: [
        {
          id: 's', type: 'service', label: 'S',
          latency_ms: 10, capacity_rps: 100, error_rate: 0,
          hpa: { min_replicas: 5, max_replicas: 2, target_cpu_pct: 70 },
        },
      ],
      edges: [],
    });
    expect(r.success).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests, expect FAIL**

Run: `npx vitest run tests/schema/resources.test.ts` — expect 3 failures.

- [ ] **Step 3: Add the schemas**

In `src/schema/diagram.ts`:

```ts
export const ResourcesSchema = z.object({
  cpu_per_request_ms: z.number().positive(),
  mem_per_request_mb: z.number().positive(),
  cpu_limit_ms_per_sec: z.number().positive(),
  mem_limit_mb: z.number().positive(),
});
export type Resources = z.infer<typeof ResourcesSchema>;

export const HpaSchema = z
  .object({
    min_replicas: z.number().int().positive(),
    max_replicas: z.number().int().positive(),
    target_cpu_pct: z.number().min(1).max(100),
    stabilization_ticks: z.number().int().positive().default(5),
  })
  .refine((h) => h.min_replicas <= h.max_replicas, {
    message: 'min_replicas must be <= max_replicas',
  });
export type Hpa = z.infer<typeof HpaSchema>;

export const ClusterSchema = z.object({
  type: z.literal('cluster'),
  id: z.string().min(1),
  label: z.string().default('Cluster'),
  members: z.array(z.string()).default([]),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
});
```

Extend `ServiceNodeSchema` and `WorkerNodeSchema` with:
```ts
resources: ResourcesSchema.optional(),
hpa: HpaSchema.optional(),
```

Add `ClusterSchema` to the discriminated union.

- [ ] **Step 4: Run tests, expect PASS**

Run: `npx vitest run tests/schema/resources.test.ts` and full `npm test` — all green. Run `npx tsc -p tsconfig.json --noEmit` — clean.

- [ ] **Step 5: Commit**

```bash
git add src/schema/diagram.ts tests/schema/resources.test.ts
git commit -m "feat(schema): resources, hpa, cluster"
```

---

## Task 2: Engine types — replicas + utilization

**Files:**
- Modify: `src/engine/types.ts`
- Modify: `src/engine/index.ts` (`buildInitial`)

- [ ] **Step 1: Extend NodeRuntime**

Add to `NodeRuntime`:
```ts
replicas?: number;
cpu_utilization?: number;     // 0..N where 1.0 = saturated
mem_utilization?: number;     // 0..N
hpaWindow?: number[];         // recent CPU samples (sliding by tick count)
```

- [ ] **Step 2: Initialize in `buildInitial`**

For each node, in the `nodes[n.id] = {...}` initializer, when `n.type === 'service' || n.type === 'worker'`:
```ts
nodes[n.id] = {
  inFlight: 0,
  emitAccumulatorMs: 0,
  replicas: n.hpa?.min_replicas ?? 1,
  hpaWindow: [],
};
```

- [ ] **Step 3: Run typecheck and prior tests**

Run: `npx tsc -p tsconfig.json --noEmit && npm test` — all green.

- [ ] **Step 4: Commit**

```bash
git add src/engine/types.ts src/engine/index.ts
git commit -m "feat(engine): runtime fields for replicas + utilization"
```

---

## Task 3: Resources module (utilization + OOM)

**Files:**
- Create: `src/engine/resources.ts`
- Test: `tests/engine/resources.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/engine/resources.test.ts
import { describe, it, expect } from 'vitest';
import { computeUtilization, applyOom } from '@/engine/resources';
import type { EngineState, NodeRuntime } from '@/engine/types';

const node = {
  id: 's', type: 'service' as const, label: 'S',
  latency_ms: 10, capacity_rps: 100, error_rate: 0,
  resources: {
    cpu_per_request_ms: 5,
    mem_per_request_mb: 10,
    cpu_limit_ms_per_sec: 1000,
    mem_limit_mb: 100,
  },
};

describe('resources', () => {
  it('cpu_utilization scales with in-flight count, divided by replicas', () => {
    const rt: NodeRuntime = { inFlight: 100, replicas: 1 };
    // each in-flight uses 5ms CPU per tick of 100ms? We use steady-state:
    // utilization = (inFlight * cpu_per_request_ms * effective_rps) / (replicas * cpu_limit)
    // simplification: util = inFlight * cpu_per_request_ms / (replicas * cpu_limit_ms_per_sec / 1000)
    const u = computeUtilization(node, rt, 100);
    expect(u.cpu).toBeGreaterThan(0);
    expect(u.cpu).toBeLessThanOrEqual(1.5); // can exceed 1 (saturation) but bounded
  });

  it('replicas halve cpu utilization', () => {
    const rt1: NodeRuntime = { inFlight: 100, replicas: 1 };
    const rt2: NodeRuntime = { inFlight: 100, replicas: 2 };
    const u1 = computeUtilization(node, rt1, 100);
    const u2 = computeUtilization(node, rt2, 100);
    expect(u2.cpu).toBeCloseTo(u1.cpu / 2, 3);
  });

  it('returns 0 when no resources configured', () => {
    const noRes = { ...node, resources: undefined };
    const rt: NodeRuntime = { inFlight: 50, replicas: 1 };
    const u = computeUtilization(noRes, rt, 100);
    expect(u.cpu).toBe(0);
    expect(u.mem).toBe(0);
  });

  it('applyOom returns particle ids when mem > 1.0', () => {
    const state: Partial<EngineState> = {
      particles: [
        { id: 1, originType: 'http', bornAt: 0, location: { kind: 'node', id: 's' }, status: 'processing' },
        { id: 2, originType: 'http', bornAt: 0, location: { kind: 'node', id: 's' }, status: 'processing' },
      ],
      counters: { emitted: 2, completed: 0, failed: 0 },
    };
    const rt: NodeRuntime = { inFlight: 2, replicas: 1, mem_utilization: 1.5 };
    const killed = applyOom(state as EngineState, node, rt);
    expect(killed.length).toBeGreaterThan(0);
    const failed = (state.particles ?? []).filter((p) => p.status === 'failed');
    expect(failed.every((p) => p.failureReason === 'oom')).toBe(true);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

```ts
// src/engine/resources.ts
import type { EngineState, NodeRuntime, Particle } from './types';
import type { Node } from '@/schema/diagram';

export function computeUtilization(
  node: Extract<Node, { type: 'service' | 'worker' }>,
  rt: NodeRuntime,
  _dtMs: number,
): { cpu: number; mem: number } {
  const r = node.resources;
  if (!r) return { cpu: 0, mem: 0 };
  const replicas = rt.replicas ?? 1;
  const inFlight = rt.inFlight ?? 0;
  // CPU: each in-flight request consumes cpu_per_request_ms of CPU per processing second.
  // Treat each in-flight as continuously consuming during its lifetime. Per replica budget:
  // available_cpu_ms_per_sec = cpu_limit_ms_per_sec * replicas
  // demand = inFlight * cpu_per_request_ms (instantaneous slice — simplification)
  const demandCpuMsPerSec = inFlight * r.cpu_per_request_ms * 100;
  const cpu = demandCpuMsPerSec / (replicas * r.cpu_limit_ms_per_sec);
  // Mem: each in-flight reserves mem_per_request_mb until it leaves
  const memDemandMb = inFlight * r.mem_per_request_mb;
  const mem = memDemandMb / (replicas * r.mem_limit_mb);
  return { cpu, mem };
}

export function applyOom(
  state: EngineState,
  node: Extract<Node, { type: 'service' | 'worker' }>,
  rt: NodeRuntime,
): number[] {
  const mem = rt.mem_utilization ?? 0;
  if (mem <= 1.0) return [];
  const killed: number[] = [];
  // Kill enough in-flight particles at this node to bring mem back under 1.0
  const overflowFraction = (mem - 1.0) / mem;
  const targetKills = Math.max(1, Math.floor((rt.inFlight ?? 0) * overflowFraction));
  let toKill = targetKills;
  for (const p of state.particles) {
    if (toKill <= 0) break;
    if (p.location.kind === 'node' && p.location.id === node.id && p.status === 'processing') {
      p.status = 'failed';
      p.failureReason = 'oom';
      killed.push(p.id);
      toKill--;
      rt.inFlight = Math.max(0, (rt.inFlight ?? 0) - 1);
      state.counters.failed++;
    }
  }
  return killed;
}
```

Note: the `* 100` in `demandCpuMsPerSec` is a tunable scaling constant — adjust if needed so that the test's expectation (`cpu > 0 && cpu <= 1.5` with 100 in-flight against 1000 ms/sec budget) holds. With current factor: `100 * 5 * 100 / 1000 = 50`. That's way too high. Replace with a more realistic per-second demand model:

Actually rewrite the CPU formula more carefully — at steady state, `effective_rps = inFlight / (latency_ms / 1000)`. CPU demand per second = `effective_rps * cpu_per_request_ms`. With node.latency_ms = 10, inFlight = 100 → effective_rps = 100 / 0.01 = 10000. demand = 10000 * 5 = 50000 ms/sec. That's still way over the 1000 ms/sec budget.

Use a saner test: inFlight = 5, replicas = 1. effective_rps = 5/0.01 = 500. demand = 500 * 5 = 2500 ms/sec. Util = 2500/1000 = 2.5 (saturated).

Adjust the test to use `inFlight: 5` and the assertion `expect(u.cpu).toBeGreaterThan(0).toBeLessThanOrEqual(3)`. Replace the formula with:

```ts
const effectiveRps = node.latency_ms === 0 ? inFlight * 1000 : (inFlight / (node.latency_ms / 1000));
const demandCpuMsPerSec = effectiveRps * r.cpu_per_request_ms;
const cpu = demandCpuMsPerSec / (replicas * r.cpu_limit_ms_per_sec);
```

If you choose to go this route, **edit the failing test FIRST** to match (inFlight=5, ranges as stated above). Keep it self-consistent. The "halve" test: with inFlight=5, replicas=1 → cpu1; replicas=2 → cpu1/2. Still holds.

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/engine/resources.ts tests/engine/resources.test.ts
git commit -m "feat(engine): resource utilization + OOM"
```

---

## Task 4: HPA module

**Files:**
- Create: `src/engine/hpa.ts`
- Test: `tests/engine/hpa.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/engine/hpa.test.ts
import { describe, it, expect } from 'vitest';
import { tickHpa } from '@/engine/hpa';
import type { NodeRuntime } from '@/engine/types';

const node = {
  id: 's', type: 'service' as const, label: 'S',
  latency_ms: 10, capacity_rps: 100, error_rate: 0,
  hpa: { min_replicas: 1, max_replicas: 5, target_cpu_pct: 70, stabilization_ticks: 3 },
};

describe('hpa', () => {
  it('scales up when avg cpu > target across stabilization window', () => {
    const rt: NodeRuntime = { inFlight: 0, replicas: 1, hpaWindow: [0.9, 0.95, 1.0] };
    tickHpa(node, rt);
    expect(rt.replicas!).toBeGreaterThan(1);
  });

  it('scales down when avg cpu < target/2', () => {
    const rt: NodeRuntime = { inFlight: 0, replicas: 4, hpaWindow: [0.1, 0.1, 0.1] };
    tickHpa(node, rt);
    expect(rt.replicas!).toBeLessThan(4);
  });

  it('clamps to min_replicas', () => {
    const rt: NodeRuntime = { inFlight: 0, replicas: 1, hpaWindow: [0, 0, 0] };
    tickHpa(node, rt);
    expect(rt.replicas).toBe(1);
  });

  it('clamps to max_replicas', () => {
    const rt: NodeRuntime = { inFlight: 0, replicas: 5, hpaWindow: [2, 2, 2] };
    tickHpa(node, rt);
    expect(rt.replicas).toBe(5);
  });

  it('does nothing when window not yet full', () => {
    const rt: NodeRuntime = { inFlight: 0, replicas: 1, hpaWindow: [2, 2] };
    tickHpa(node, rt);
    expect(rt.replicas).toBe(1);
  });

  it('no-op when hpa undefined', () => {
    const noHpa = { ...node, hpa: undefined };
    const rt: NodeRuntime = { inFlight: 0, replicas: 3, hpaWindow: [2, 2, 2] };
    tickHpa(noHpa, rt);
    expect(rt.replicas).toBe(3);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

```ts
// src/engine/hpa.ts
import type { Node } from '@/schema/diagram';
import type { NodeRuntime } from './types';

export function tickHpa(
  node: Extract<Node, { type: 'service' | 'worker' }>,
  rt: NodeRuntime,
): void {
  const hpa = node.hpa;
  if (!hpa) return;
  const window = rt.hpaWindow ?? [];
  if (window.length < hpa.stabilization_ticks) return;

  const avg = window.reduce((s, v) => s + v, 0) / window.length;
  const target = hpa.target_cpu_pct / 100;
  const current = rt.replicas ?? hpa.min_replicas;

  // Kubernetes-style: desired = ceil(current * (avg / target))
  let desired = Math.ceil(current * (avg / Math.max(0.01, target)));
  desired = Math.max(hpa.min_replicas, Math.min(hpa.max_replicas, desired));

  if (desired !== current) {
    rt.replicas = desired;
    rt.hpaWindow = []; // reset window after a scaling decision
  }
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/engine/hpa.ts tests/engine/hpa.test.ts
git commit -m "feat(engine): HPA with stabilization window"
```

---

## Task 5: Wire resources + HPA into tick

**Files:**
- Modify: `src/engine/tick.ts`

- [ ] **Step 1: Integrate per-tick**

Inside the tick loop, after each Service / Worker is processed:

```ts
for (const node of state.diagram.nodes) {
  if (node.type !== 'service' && node.type !== 'worker') continue;
  const rt = state.nodes[node.id];
  if (!rt) continue;
  const u = computeUtilization(node, rt, dtMs);
  rt.cpu_utilization = u.cpu;
  rt.mem_utilization = u.mem;
  rt.hpaWindow = rt.hpaWindow ?? [];
  rt.hpaWindow.push(u.cpu);
  // bound window to <= 2 * stabilization to keep memory tiny
  const limit = (node.hpa?.stabilization_ticks ?? 5) * 2;
  if (rt.hpaWindow.length > limit) rt.hpaWindow.shift();
  applyOom(state, node, rt);
  tickHpa(node, rt);
}
```

Also update Service/Worker capacity computations: anywhere `node.capacity_rps` (or `concurrency`) is used in `processServices` / worker tick, multiply by `(rt.replicas ?? 1)`.

- [ ] **Step 2: Run all tests**

Run: `npm test` — must remain green (58 + new ~10 from earlier tasks). The integration test from Plan 1 may notice slightly different timing; if so, only relax to invariants (don't loosen exact counts).

- [ ] **Step 3: Commit**

```bash
git add src/engine/tick.ts
git commit -m "feat(engine): integrate resources + HPA into tick"
```

---

## Task 6: Scaling integration test

**Files:**
- Test: `tests/engine/scaling.integration.test.ts`

- [ ] **Step 1: Write end-to-end test**

```ts
// tests/engine/scaling.integration.test.ts
import { describe, it, expect } from 'vitest';
import { createEngine } from '@/engine';
import { parseDiagram } from '@/lib/yaml';

const yaml = `
version: 1
nodes:
  - { id: c, type: client, label: C, rps: 200, pattern: constant }
  - { id: s, type: service, label: S, latency_ms: 50, capacity_rps: 50, error_rate: 0,
      resources: { cpu_per_request_ms: 10, mem_per_request_mb: 1, cpu_limit_ms_per_sec: 1000, mem_limit_mb: 1024 },
      hpa: { min_replicas: 1, max_replicas: 10, target_cpu_pct: 70, stabilization_ticks: 3 } }
edges:
  - { id: e1, source: c, target: s, kind: sync, latency_ms: 1, weight: 1 }
`;

function runFor(eng: ReturnType<typeof createEngine>, totalMs: number, dt: number) {
  for (let t = 0; t < totalMs; t += dt) eng.tick(dt);
}

describe('HPA integration', () => {
  it('scales replicas up under load', () => {
    const diag = parseDiagram(yaml);
    const eng = createEngine(diag, 7);
    expect(eng.state.nodes['s'].replicas).toBe(1);
    runFor(eng, 5_000, 100);
    expect(eng.state.nodes['s'].replicas!).toBeGreaterThan(1);
  });
});
```

- [ ] **Step 2: Run, expect PASS**

If it fails because util doesn't actually exceed 0.7, tune the YAML's `cpu_per_request_ms` upward. The test must demonstrate scale-up under load.

- [ ] **Step 3: Commit**

```bash
git add tests/engine/scaling.integration.test.ts
git commit -m "test(engine): HPA scale-up integration"
```

---

## Task 7: Install uPlot + Sparkline component

**Files:**
- Modify: `package.json` + lockfile (via `npm i uplot`)
- Create: `src/components/charts/Sparkline.tsx`

- [ ] **Step 1: Install dep**

```bash
npm i uplot
```

Verify install adds `uplot` to `dependencies` (not devDependencies).

- [ ] **Step 2: Implement Sparkline**

```tsx
// src/components/charts/Sparkline.tsx
import { useEffect, useRef } from 'react';
import uPlot, { type Options as UPlotOptions } from 'uplot';
import 'uplot/dist/uPlot.min.css';

export interface SparklineProps {
  values: number[];        // y-values, x = index
  color?: string;
  height?: number;
  width?: number;
  label?: string;
}

export function Sparkline({ values, color = '#4caf50', height = 48, width = 200, label }: SparklineProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<uPlot | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const opts: UPlotOptions = {
      width,
      height,
      legend: { show: false },
      cursor: { show: false },
      scales: { x: { time: false } },
      axes: [{ show: false }, { show: false }],
      series: [
        {},
        { stroke: color, width: 1.5, points: { show: false } },
      ],
    };
    const xs = values.map((_, i) => i);
    plotRef.current = new uPlot(opts, [xs, values], ref.current);
    return () => { plotRef.current?.destroy(); plotRef.current = null; };
  }, [width, height, color]);

  useEffect(() => {
    if (!plotRef.current) return;
    const xs = values.map((_, i) => i);
    plotRef.current.setData([xs, values]);
  }, [values]);

  return (
    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
      {label && <div>{label}</div>}
      <div ref={ref} />
    </div>
  );
}
```

- [ ] **Step 3: Verify build**

`npm run build` — must succeed.

- [ ] **Step 4: Commit**

```bash
git add package.json package-lock.json src/components/charts/Sparkline.tsx
git commit -m "feat(ui): uPlot Sparkline component"
```

---

## Task 8: History selector in store

**Files:**
- Modify: `src/store/engineStore.ts`

- [ ] **Step 1: Add per-node ring buffers in store state**

```ts
interface NodeHistory { rps_in: number[]; cpu: number[]; replicas: number[]; }
const HISTORY_MAX = 120; // ~12 seconds at 100ms ticks

// add to store state:
history: Record<string, NodeHistory>,

// in step(dtMs), after engine.tick(...):
const eng = get().engine!;
const next = { ...get().history };
for (const node of eng.state.diagram.nodes) {
  if (node.type !== 'service' && node.type !== 'worker') continue;
  const rt = eng.state.nodes[node.id];
  const w = eng.state.metrics[node.id];
  const stats = w ? computeStats(w, eng.state.nowMs) : null;
  const h = next[node.id] ?? { rps_in: [], cpu: [], replicas: [] };
  h.rps_in = [...h.rps_in, stats?.rps_in ?? 0].slice(-HISTORY_MAX);
  h.cpu = [...h.cpu, rt.cpu_utilization ?? 0].slice(-HISTORY_MAX);
  h.replicas = [...h.replicas, rt.replicas ?? 1].slice(-HISTORY_MAX);
  next[node.id] = h;
}
set({ history: next, tickCount: get().tickCount + 1 });
```

Initialize `history: {}` in the store. Add a selector:
```ts
getHistory(nodeId: string): NodeHistory | null {
  return get().history[nodeId] ?? null;
}
```

- [ ] **Step 2: Verify build + tests**

`npx tsc -p tsconfig.json --noEmit && npm test && npm run build` — all green.

- [ ] **Step 3: Commit**

```bash
git add src/store/engineStore.ts
git commit -m "feat(store): per-node history ring buffer for charts"
```

---

## Task 9: Inspector — add sparklines

**Files:**
- Modify: `src/components/Inspector.tsx`

- [ ] **Step 1: Render 3 sparklines for service/worker selections**

Below the existing metrics list, add (only when `node.type === 'service' || node.type === 'worker'`):

```tsx
import { Sparkline } from './charts/Sparkline';

// inside Inspector, after metrics list:
const history = useEngineStore((s) => (id ? s.getHistory(id) : null));
{history && (node.type === 'service' || node.type === 'worker') && (
  <div style={{ marginTop: 12 }}>
    <Sparkline label="rps_in" values={history.rps_in} color="#4caf50" />
    <Sparkline label="cpu" values={history.cpu} color="#ff9800" />
    <Sparkline label="replicas" values={history.replicas} color="#2196f3" />
  </div>
)}
```

- [ ] **Step 2: Smoke test**

`npm run build` succeeds. Optionally `npm run dev` and visually confirm sparklines update.

- [ ] **Step 3: Commit**

```bash
git add src/components/Inspector.tsx
git commit -m "feat(ui): live sparklines in inspector (rps/cpu/replicas)"
```

---

## Task 10: Service/Worker cards — replica badge + CPU bar

**Files:**
- Modify: `src/components/canvas/nodes/ServiceNode.tsx`
- Modify: `src/components/canvas/nodes/WorkerNode.tsx`

- [ ] **Step 1: Add replica badge + CPU bar**

For each node card, subscribe to `tickCount` and read `engine.state.nodes[id]`:

```tsx
const replicas = useEngineStore((s) => s.engine?.state.nodes[id]?.replicas ?? 1);
const cpu = useEngineStore((s) => s.engine?.state.nodes[id]?.cpu_utilization ?? 0);
```

Render in the card:
```tsx
<div style={{ position: 'absolute', top: 4, right: 6, fontSize: 10,
              background: 'var(--accent)', color: '#000', padding: '0 4px', borderRadius: 4 }}>
  ×{replicas}
</div>
<div style={{
  position: 'absolute', bottom: 0, left: 0, height: 3,
  width: `${Math.min(100, cpu * 100)}%`,
  background: cpu > 0.8 ? 'var(--danger)' : cpu > 0.5 ? 'var(--warn)' : 'var(--accent)',
}} />
```

Make sure the card has `position: relative`.

- [ ] **Step 2: Build + visual**

`npm run build` succeeds.

- [ ] **Step 3: Commit**

```bash
git add src/components/canvas/nodes/ServiceNode.tsx src/components/canvas/nodes/WorkerNode.tsx
git commit -m "feat(ui): replica badge + cpu bar on service/worker cards"
```

---

## Task 11: Cluster node — decorative grouping

**Files:**
- Create: `src/components/canvas/nodes/ClusterNode.tsx`
- Modify: `src/components/canvas/FlowCanvas.tsx`

- [ ] **Step 1: Implement ClusterNode**

```tsx
// src/components/canvas/nodes/ClusterNode.tsx
import type { NodeProps } from '@xyflow/react';

export interface ClusterNodeData { label: string; }

export function ClusterNode(props: NodeProps) {
  const data = props.data as unknown as ClusterNodeData;
  return (
    <div style={{
      width: '100%', height: '100%',
      border: '1.5px dashed var(--text-dim)', borderRadius: 8,
      background: 'rgba(255,255,255,0.02)',
      padding: 8,
    }}>
      <div style={{ fontSize: 10, color: 'var(--text-dim)', textTransform: 'uppercase' }}>
        ☁ {data.label}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Register in FlowCanvas + render with parentNode**

Add `cluster: ClusterNode` to `nodeTypes`. In the `useMemo` that builds RF nodes, when `n.type === 'cluster'`, give the RF node `style: { width: 240, height: 200 }`, `selectable: false`, `draggable: true`, and let the user position it. For simplicity, do NOT auto-fit to members — the YAML can place it explicitly via `position`. Members are drawn separately on top; if you want true grouping, pass `parentNode: clusterId, extent: 'parent'` on member nodes whose ids are in `cluster.members`.

(Keep the implementation minimal — pure decoration is acceptable for Plan 3.)

- [ ] **Step 3: Build**

`npm run build` succeeds.

- [ ] **Step 4: Commit**

```bash
git add src/components/canvas/nodes/ClusterNode.tsx src/components/canvas/FlowCanvas.tsx
git commit -m "feat(ui): decorative Cluster node"
```

---

## Task 12: Scaling demo YAML + picker entry

**Files:**
- Create: `src/examples/scaling-demo.archflow.yaml`
- Modify: `src/App.tsx`

- [ ] **Step 1: Author YAML**

```yaml
# src/examples/scaling-demo.archflow.yaml
version: 1
nodes:
  - { id: cl, type: cluster, label: prod, members: [s], position: { x: 220, y: 60 } }
  - { id: c,  type: client,  label: Users, rps: 200, pattern: ramp, position: { x: 40, y: 120 } }
  - { id: s,  type: service, label: API,
      latency_ms: 50, capacity_rps: 50, error_rate: 0,
      resources: { cpu_per_request_ms: 10, mem_per_request_mb: 5, cpu_limit_ms_per_sec: 1000, mem_limit_mb: 1024 },
      hpa: { min_replicas: 1, max_replicas: 10, target_cpu_pct: 70 },
      position: { x: 280, y: 140 } }
edges:
  - { id: e1, source: c, target: s, kind: sync, latency_ms: 5, weight: 1 }
```

- [ ] **Step 2: Add to picker in App.tsx**

Extend the existing dropdown with `'scaling'`. Import:
```ts
import scalingYaml from './examples/scaling-demo.archflow.yaml?raw';
```

- [ ] **Step 3: Build + smoke**

`npm run build` succeeds. Optionally run dev and switch to `scaling` — should see CPU bar fill, replica badge climb, sparklines update.

- [ ] **Step 4: Commit**

```bash
git add src/examples/scaling-demo.archflow.yaml src/App.tsx
git commit -m "feat(examples): scaling demo with HPA + cluster"
```

---

## Task 13: Final verification + tag

- [ ] **Step 1:** `npm run lint` → exit 0
- [ ] **Step 2:** `npx tsc -p tsconfig.json --noEmit` → exit 0
- [ ] **Step 3:** `npm test` → all tests pass
- [ ] **Step 4:** `npm run build` → succeeds
- [ ] **Step 5:** Engine purity: `grep -RE 'from "(react|@xyflow|zustand|uplot)' src/engine` returns empty
- [ ] **Step 6:** `git tag -a archflow-plan-3 -m "archflow Plan 3: resources + HPA + charts"`

---

## Definition of Done

1. Schema accepts `resources`, `hpa`, and `cluster` nodes; rejects `min > max` HPA.
2. Service/Worker capacity scales linearly with `replicas`.
3. CPU and memory utilization compute correctly per replica.
4. OOM kills in-flight particles with `failureReason: 'oom'` when mem > 1.0.
5. HPA scales replicas up under sustained load above target_cpu_pct, scales down when idle, respects min/max, uses stabilization window.
6. Inspector shows live sparklines (rps_in, cpu, replicas) for selected service/worker.
7. Service/Worker cards display `×N` replica badge and a colored CPU bar.
8. Cluster nodes render as decorative dashed boxes.
9. Scaling demo loads via picker and visibly scales replicas under ramp load.
10. Engine remains pure TS (no react/zustand/@xyflow/uplot imports under `src/engine`).
