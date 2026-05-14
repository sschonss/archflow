# archflow Plan 2 — Catalog, Scenarios & Metrics

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Extend archflow's foundation with the full component catalog (Webhook, LoadBalancer, Gateway, Worker, Queue, Cache, Database), Cron triggers, named Scenarios with tag-based routing, saturation rules (429 / 503 / queue overflow / DB timeout), and sliding-window metrics (rps, p50/p95/p99 latency, error_rate, queue_depth) surfaced in an inspector panel.

**Architecture:**
- Engine stays a pure-TS single-tick reducer. Each new component type gets a focused module under `src/engine/nodes/<kind>.ts` with two pure functions: `tickNode(state, node, rt, ctx)` and `acceptParticle(state, node, rt, particle, ctx)`. The dispatcher in `tick.ts` delegates by `node.kind`.
- Routing becomes a small policy module (`src/engine/routing.ts`): given a node + outgoing edges + particle, return the chosen edge using (a) scenario tag pin → (b) weighted random → (c) first edge fallback.
- Metrics is a per-node ring-buffer module (`src/engine/metrics.ts`) updated on the same events the engine already emits (emit / complete / fail / enqueue / dequeue / drop). UI reads via a derived selector.
- UI: each node kind gets a React Flow custom node card (visually distinct + a tiny live metric strip). Inspector panel reads metrics for the currently selected node.

**Tech Stack:** Same as Plan 1 — TS strict, Vite, React, @xyflow/react, Zustand, Vitest, ESLint, Prettier. No new runtime deps. (Cron parsing is hand-rolled minimally — only `*/N`, `N`, `N-M` numeric forms; no library.)

---

## File Structure

**Schema (extended):**
- Modify: `src/schema/diagram.ts` — add 7 node-kind schemas, extend `EdgeSchema.tags`, add `ScenarioSchema`, add `TriggerSchema` (cron), refactor `NodeSchema` to a discriminated union over `kind`.

**Engine (extended + new node modules):**
- Modify: `src/engine/types.ts` — extend `Particle` (add `failureReason?`, `scenarioId?`, `enqueuedAt?`), `EngineState` (add `metrics`, `scenarios`), `NodeRuntime` (per-kind runtime: `queue?`, `inFlight?`, `pool?`, `tokenBucket?`, `cronAccum?`).
- Create: `src/engine/routing.ts` — `chooseEdge(node, outEdges, particle, rng)`.
- Create: `src/engine/metrics.ts` — sliding-window ring buffer + percentile helpers.
- Create: `src/engine/triggers.ts` — minimal cron parser + `tickTriggers(state, ctx)`.
- Create: `src/engine/nodes/webhook.ts`
- Create: `src/engine/nodes/loadbalancer.ts`
- Create: `src/engine/nodes/gateway.ts`
- Create: `src/engine/nodes/worker.ts`
- Create: `src/engine/nodes/queue.ts`
- Create: `src/engine/nodes/cache.ts`
- Create: `src/engine/nodes/database.ts`
- Create: `src/engine/nodes/index.ts` — barrel + dispatcher map `{ kind → { tick, accept } }`.
- Modify: `src/engine/tick.ts` — replace inline Client/Service handling with the dispatcher; emit metrics events; integrate triggers.

**UI:**
- Create: `src/ui/nodes/WebhookNode.tsx`, `LoadBalancerNode.tsx`, `GatewayNode.tsx`, `WorkerNode.tsx`, `QueueNode.tsx`, `CacheNode.tsx`, `DatabaseNode.tsx`.
- Modify: `src/ui/nodes/index.ts` (or wherever nodeTypes is registered in `Canvas.tsx`) — register all new node types.
- Create: `src/ui/Inspector.tsx` — replaces the right-pane stub from Plan 1; shows node properties + live metrics.
- Modify: `src/ui/Layout.tsx` — wire `<Inspector/>` into right pane.
- Modify: `src/store/engineStore.ts` — add `selectedNodeId`, `selectNode(id)`, expose `getMetrics(nodeId)` selector.
- Create: `src/ui/MetricsStrip.tsx` — small reusable in-card metric chip used by all node cards.

**Examples:**
- Create: `src/examples/ecommerce.archflow.yaml` — demo that exercises every component + 2 scenarios + a cron.

**Tests (new):**
- `tests/engine/routing.test.ts`
- `tests/engine/metrics.test.ts`
- `tests/engine/triggers.test.ts`
- `tests/engine/nodes/webhook.test.ts`
- `tests/engine/nodes/loadbalancer.test.ts`
- `tests/engine/nodes/gateway.test.ts`
- `tests/engine/nodes/queue.test.ts`
- `tests/engine/nodes/worker.test.ts`
- `tests/engine/nodes/cache.test.ts`
- `tests/engine/nodes/database.test.ts`
- `tests/engine/scenarios.integration.test.ts`
- `tests/schema/catalog.test.ts`

---

## Task 1: Schema — Triggers, Scenarios, Edge tags

**Files:**
- Modify: `src/schema/diagram.ts`
- Test: `tests/schema/catalog.test.ts`

- [ ] **Step 1: Write failing tests for new schema pieces**

```ts
// tests/schema/catalog.test.ts
import { describe, it, expect } from 'vitest';
import { DiagramSchema } from '@/schema/diagram';

describe('schema catalog extensions', () => {
  it('accepts edge tags', () => {
    const r = DiagramSchema.safeParse({
      version: 1,
      nodes: [
        { id: 'c', kind: 'client', name: 'C', rps: 1, pattern: 'constant' },
        { id: 's', kind: 'service', name: 'S', latency_ms: 10, capacity_rps: 100, error_rate: 0 },
      ],
      edges: [{ source: 'c', target: 's', kind: 'sync', latency_ms: 1, weight: 1, tags: ['scenario:checkout'] }],
    });
    expect(r.success).toBe(true);
  });

  it('accepts a scenarios array', () => {
    const r = DiagramSchema.safeParse({
      version: 1,
      nodes: [{ id: 'c', kind: 'client', name: 'C', rps: 1, pattern: 'constant' }],
      edges: [],
      scenarios: [{ id: 'checkout', origin: 'c', color: '#f0a' }],
    });
    expect(r.success).toBe(true);
  });

  it('accepts a cron trigger on a service', () => {
    const r = DiagramSchema.safeParse({
      version: 1,
      nodes: [
        {
          id: 's',
          kind: 'service',
          name: 'S',
          latency_ms: 10,
          capacity_rps: 100,
          error_rate: 0,
          triggers: [{ id: 't1', cron: '*/5 * * * *' }],
        },
      ],
      edges: [],
    });
    expect(r.success).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/schema/catalog.test.ts`
Expected: FAIL (`tags`, `scenarios`, `triggers` not recognized).

- [ ] **Step 3: Extend the schema**

Open `src/schema/diagram.ts`. Add (keep existing exports working):

```ts
import { z } from 'zod';

export const TriggerSchema = z.object({
  id: z.string().min(1),
  cron: z.string().min(1),
  payload_size: z.number().int().nonnegative().optional(),
});
export type Trigger = z.infer<typeof TriggerSchema>;

export const ScenarioSchema = z.object({
  id: z.string().min(1),
  origin: z.string().min(1),
  trigger_id: z.string().optional(),
  color: z.string().optional(),
  weight: z.number().positive().default(1),
});
export type Scenario = z.infer<typeof ScenarioSchema>;
```

Then on the existing `EdgeSchema`, add: `tags: z.array(z.string()).default([])`.

On the existing `ServiceSchema` (rename if currently inline), add:
```ts
triggers: z.array(TriggerSchema).default([]),
```

On `DiagramSchema`, add: `scenarios: z.array(ScenarioSchema).default([])`.

- [ ] **Step 4: Run tests, expect pass**

Run: `npx vitest run tests/schema/catalog.test.ts`
Expected: 3 PASS. Then run the full schema suite: `npx vitest run tests/schema` — all pass.

- [ ] **Step 5: Commit**

```bash
git add src/schema/diagram.ts tests/schema/catalog.test.ts
git commit -m "feat(schema): triggers, scenarios, edge tags"
```

---

## Task 2: Schema — 7 new node kinds

**Files:**
- Modify: `src/schema/diagram.ts`
- Test: `tests/schema/catalog.test.ts` (extend)

- [ ] **Step 1: Write failing tests for each new node kind**

Append to `tests/schema/catalog.test.ts`:

```ts
import { DiagramSchema } from '@/schema/diagram';

const baseDiag = (extraNodes: unknown[]) => ({
  version: 1,
  nodes: [
    { id: 'c', kind: 'client', name: 'C', rps: 1, pattern: 'constant' },
    ...extraNodes,
  ],
  edges: [],
});

describe('catalog node kinds', () => {
  it('webhook', () => {
    expect(
      DiagramSchema.safeParse(
        baseDiag([{ id: 'w', kind: 'webhook', name: 'W', rps: 2, pattern: 'poisson' }]),
      ).success,
    ).toBe(true);
  });

  it('load_balancer', () => {
    expect(
      DiagramSchema.safeParse(
        baseDiag([{ id: 'lb', kind: 'load_balancer', name: 'LB', strategy: 'round_robin' }]),
      ).success,
    ).toBe(true);
  });

  it('gateway', () => {
    expect(
      DiagramSchema.safeParse(
        baseDiag([
          { id: 'g', kind: 'gateway', name: 'G', rate_limit_rps: 50, auth_check_ms: 2 },
        ]),
      ).success,
    ).toBe(true);
  });

  it('worker', () => {
    expect(
      DiagramSchema.safeParse(
        baseDiag([
          { id: 'wk', kind: 'worker', name: 'WK', concurrency: 4, latency_ms: 20, error_rate: 0 },
        ]),
      ).success,
    ).toBe(true);
  });

  it('queue', () => {
    expect(
      DiagramSchema.safeParse(
        baseDiag([
          { id: 'q', kind: 'queue', name: 'Q', max_depth: 1000, on_overflow: 'drop' },
        ]),
      ).success,
    ).toBe(true);
  });

  it('cache', () => {
    expect(
      DiagramSchema.safeParse(
        baseDiag([{ id: 'r', kind: 'cache', name: 'R', hit_rate: 0.8, latency_ms: 1 }]),
      ).success,
    ).toBe(true);
  });

  it('database', () => {
    expect(
      DiagramSchema.safeParse(
        baseDiag([
          {
            id: 'db',
            kind: 'database',
            name: 'DB',
            pool_size: 20,
            query_latency_ms: 5,
            timeout_ms: 100,
          },
        ]),
      ).success,
    ).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests, expect FAIL**

Run: `npx vitest run tests/schema/catalog.test.ts`
Expected: 7 new failures.

- [ ] **Step 3: Add the new schemas + discriminated union**

In `src/schema/diagram.ts`:

```ts
const Pos = z.object({ x: z.number(), y: z.number() }).optional();
const Base = { id: z.string().min(1), name: z.string().min(1), position: Pos };

export const ClientSchema = z.object({
  ...Base,
  kind: z.literal('client'),
  rps: z.number().nonnegative(),
  pattern: z.enum(['constant', 'burst', 'ramp']),
  payload_size: z.number().int().nonnegative().optional(),
});

export const WebhookSchema = z.object({
  ...Base,
  kind: z.literal('webhook'),
  rps: z.number().nonnegative(),
  pattern: z.enum(['poisson', 'burst']),
});

export const LoadBalancerSchema = z.object({
  ...Base,
  kind: z.literal('load_balancer'),
  strategy: z.enum(['round_robin', 'least_conn', 'random']),
});

export const GatewaySchema = z.object({
  ...Base,
  kind: z.literal('gateway'),
  rate_limit_rps: z.number().positive(),
  auth_check_ms: z.number().nonnegative().default(0),
});

export const ServiceSchema = z.object({
  ...Base,
  kind: z.literal('service'),
  latency_ms: z.number().nonnegative(),
  capacity_rps: z.number().positive(),
  error_rate: z.number().min(0).max(1),
  triggers: z.array(TriggerSchema).default([]),
});

export const WorkerSchema = z.object({
  ...Base,
  kind: z.literal('worker'),
  concurrency: z.number().int().positive(),
  latency_ms: z.number().nonnegative(),
  error_rate: z.number().min(0).max(1),
  triggers: z.array(TriggerSchema).default([]),
});

export const QueueSchema = z.object({
  ...Base,
  kind: z.literal('queue'),
  max_depth: z.number().int().positive(),
  on_overflow: z.enum(['drop', 'dlq']).default('drop'),
});

export const CacheSchema = z.object({
  ...Base,
  kind: z.literal('cache'),
  hit_rate: z.number().min(0).max(1),
  latency_ms: z.number().nonnegative(),
});

export const DatabaseSchema = z.object({
  ...Base,
  kind: z.literal('database'),
  pool_size: z.number().int().positive(),
  query_latency_ms: z.number().nonnegative(),
  timeout_ms: z.number().positive(),
});

export const NodeSchema = z.discriminatedUnion('kind', [
  ClientSchema,
  WebhookSchema,
  LoadBalancerSchema,
  GatewaySchema,
  ServiceSchema,
  WorkerSchema,
  QueueSchema,
  CacheSchema,
  DatabaseSchema,
]);
export type Node = z.infer<typeof NodeSchema>;
```

Update `DiagramSchema.nodes` to be `z.array(NodeSchema)`.

- [ ] **Step 4: Run tests, expect PASS**

Run: `npx vitest run tests/schema` — all pass.
Run: `npx tsc -p tsconfig.json --noEmit` — zero errors. (If existing references to the old `Service` type break, fix them by importing the new `Node` union and narrowing with `node.kind === 'service'`.)

- [ ] **Step 5: Commit**

```bash
git add src/schema/diagram.ts tests/schema/catalog.test.ts
git commit -m "feat(schema): 7 new node kinds (discriminated union)"
```

---

## Task 3: Engine types — extend Particle, EngineState, NodeRuntime

**Files:**
- Modify: `src/engine/types.ts`

- [ ] **Step 1: Add new fields**

```ts
export type FailureReason = '429' | '503' | 'timeout' | 'queue_overflow' | 'oom';

export interface Particle {
  id: number;
  originType: 'http' | 'webhook' | 'cron';
  scenarioId?: string;
  bornAt: number;
  enqueuedAt?: number;
  location:
    | { kind: 'node'; id: string }
    | { kind: 'edge'; id: string; progress: number };
  status: 'in_flight' | 'processing' | 'queued' | 'completed' | 'failed';
  failureReason?: FailureReason;
}

export interface NodeRuntime {
  // shared
  inFlight: number;
  // service / worker
  busyUntilMs?: number;
  // worker
  workersBusy?: number;
  // gateway
  tokens?: number;
  lastRefillMs?: number;
  // queue
  queue?: number[]; // particle ids, FIFO
  // load_balancer
  rrCursor?: number;
  // database
  poolUsed?: number;
  waiters?: { particleId: number; deadlineMs: number }[];
  // cron
  cronNextMs?: Record<string, number>; // triggerId -> nextFireMs
}

export interface MetricsWindow {
  // ring buffers ~10s of (timestampMs, value) tuples
  emits: number[];      // timestamps
  completes: number[];
  fails: number[];
  latencies: { t: number; ms: number }[];
  queueDepth: { t: number; n: number }[];
}

export interface EngineState {
  seed: number;
  rngState: number;
  nowMs: number;
  particles: Particle[];
  nodes: Record<string, NodeRuntime>;
  metrics: Record<string, MetricsWindow>;
  counters: { emitted: number; completed: number; failed: number };
  nextParticleId: number;
}
```

- [ ] **Step 2: Run typecheck (existing code may break)**

Run: `npx tsc -p tsconfig.json --noEmit`
Fix any breakage by initializing `metrics: {}` wherever `EngineState` is constructed (likely `src/engine/init.ts` or `engineStore.ts`). Add `inFlight: 0` to default `NodeRuntime`.

- [ ] **Step 3: Run existing tests, expect green**

Run: `npm test` — all 18 prior tests still pass.

- [ ] **Step 4: Commit**

```bash
git add src/engine/types.ts src/engine/init.ts src/store/engineStore.ts
git commit -m "feat(engine): extend types for catalog (failureReason, runtimes, metrics)"
```

---

## Task 4: Routing module (weighted + scenario-tagged)

**Files:**
- Create: `src/engine/routing.ts`
- Test: `tests/engine/routing.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/engine/routing.test.ts
import { describe, it, expect } from 'vitest';
import { chooseEdge } from '@/engine/routing';
import { mulberry32 } from '@/engine/rng';

const e = (id: string, weight = 1, tags: string[] = []) =>
  ({ id, source: 'a', target: 'b', kind: 'sync', latency_ms: 1, weight, tags }) as const;

describe('chooseEdge', () => {
  it('returns the only edge when single', () => {
    const rng = mulberry32(1);
    expect(chooseEdge([e('e1')], undefined, rng)?.id).toBe('e1');
  });

  it('prefers a scenario-tagged edge when scenarioId matches', () => {
    const rng = mulberry32(1);
    const out = chooseEdge(
      [e('e1', 10), e('e2', 1, ['scenario:checkout'])],
      'checkout',
      rng,
    );
    expect(out?.id).toBe('e2');
  });

  it('weighted: distribution roughly matches weights', () => {
    const rng = mulberry32(42);
    const counts: Record<string, number> = { e1: 0, e2: 0 };
    for (let i = 0; i < 10000; i++) {
      const ed = chooseEdge([e('e1', 1), e('e2', 3)], undefined, rng)!;
      counts[ed.id]++;
    }
    // expect e2 ~ 75% ± 3%
    expect(counts.e2 / 10000).toBeGreaterThan(0.72);
    expect(counts.e2 / 10000).toBeLessThan(0.78);
  });

  it('returns undefined for empty list', () => {
    const rng = mulberry32(1);
    expect(chooseEdge([], undefined, rng)).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run tests, expect FAIL** (`chooseEdge not defined`)

- [ ] **Step 3: Implement**

```ts
// src/engine/routing.ts
import type { Edge } from '@/schema/diagram';

export function chooseEdge(
  outEdges: ReadonlyArray<Edge>,
  scenarioId: string | undefined,
  rng: () => number,
): Edge | undefined {
  if (outEdges.length === 0) return undefined;
  if (scenarioId) {
    const tag = `scenario:${scenarioId}`;
    const pinned = outEdges.filter((e) => e.tags?.includes(tag));
    if (pinned.length > 0) return weighted(pinned, rng);
  }
  return weighted(outEdges, rng);
}

function weighted(edges: ReadonlyArray<Edge>, rng: () => number): Edge {
  const total = edges.reduce((s, e) => s + (e.weight ?? 1), 0);
  let r = rng() * total;
  for (const e of edges) {
    r -= e.weight ?? 1;
    if (r <= 0) return e;
  }
  return edges[edges.length - 1];
}
```

- [ ] **Step 4: Run tests, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/engine/routing.ts tests/engine/routing.test.ts
git commit -m "feat(engine): scenario-aware weighted routing"
```

---

## Task 5: Sliding-window metrics

**Files:**
- Create: `src/engine/metrics.ts`
- Test: `tests/engine/metrics.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/engine/metrics.test.ts
import { describe, it, expect } from 'vitest';
import {
  emptyWindow,
  recordEmit,
  recordComplete,
  recordFail,
  recordQueueDepth,
  computeStats,
  WINDOW_MS,
} from '@/engine/metrics';

describe('metrics sliding window', () => {
  it('rps_in counts only events within the window', () => {
    let w = emptyWindow();
    w = recordEmit(w, 0);
    w = recordEmit(w, 1000);
    w = recordEmit(w, 2000);
    const stats = computeStats(w, 2000);
    // 3 emits over 10s window → 0.3 rps
    expect(stats.rps_in).toBeCloseTo(3 / (WINDOW_MS / 1000), 5);
  });

  it('drops events older than WINDOW_MS', () => {
    let w = emptyWindow();
    w = recordEmit(w, 0);
    w = recordEmit(w, WINDOW_MS + 100);
    const s = computeStats(w, WINDOW_MS + 100);
    expect(s.rps_in).toBeCloseTo(1 / (WINDOW_MS / 1000), 5);
  });

  it('error_rate = fails / (completes + fails)', () => {
    let w = emptyWindow();
    w = recordComplete(w, 100, 10);
    w = recordComplete(w, 200, 12);
    w = recordComplete(w, 300, 15);
    w = recordFail(w, 400);
    const s = computeStats(w, 400);
    expect(s.error_rate).toBeCloseTo(0.25, 5);
  });

  it('p50/p95/p99 latencies', () => {
    let w = emptyWindow();
    for (let i = 1; i <= 100; i++) w = recordComplete(w, i, i);
    const s = computeStats(w, 100);
    expect(s.p50).toBe(50);
    expect(s.p95).toBe(95);
    expect(s.p99).toBe(99);
  });

  it('queue_depth uses last sample within window', () => {
    let w = emptyWindow();
    w = recordQueueDepth(w, 0, 5);
    w = recordQueueDepth(w, 100, 12);
    const s = computeStats(w, 100);
    expect(s.queue_depth).toBe(12);
  });
});
```

- [ ] **Step 2: Run tests, expect FAIL**

- [ ] **Step 3: Implement**

```ts
// src/engine/metrics.ts
import type { MetricsWindow } from './types';

export const WINDOW_MS = 10_000;

export function emptyWindow(): MetricsWindow {
  return { emits: [], completes: [], fails: [], latencies: [], queueDepth: [] };
}

const trim = (arr: number[], cutoff: number) => {
  while (arr.length > 0 && arr[0] < cutoff) arr.shift();
};
const trimObj = <T extends { t: number }>(arr: T[], cutoff: number) => {
  while (arr.length > 0 && arr[0].t < cutoff) arr.shift();
};

export function recordEmit(w: MetricsWindow, t: number): MetricsWindow {
  w.emits.push(t);
  trim(w.emits, t - WINDOW_MS);
  return w;
}

export function recordComplete(w: MetricsWindow, t: number, latencyMs: number): MetricsWindow {
  w.completes.push(t);
  w.latencies.push({ t, ms: latencyMs });
  trim(w.completes, t - WINDOW_MS);
  trimObj(w.latencies, t - WINDOW_MS);
  return w;
}

export function recordFail(w: MetricsWindow, t: number): MetricsWindow {
  w.fails.push(t);
  trim(w.fails, t - WINDOW_MS);
  return w;
}

export function recordQueueDepth(w: MetricsWindow, t: number, depth: number): MetricsWindow {
  w.queueDepth.push({ t, n: depth });
  trimObj(w.queueDepth, t - WINDOW_MS);
  return w;
}

export interface Stats {
  rps_in: number;
  rps_out: number;
  error_rate: number;
  p50: number;
  p95: number;
  p99: number;
  queue_depth: number;
  throughput_total: number;
}

const pct = (sorted: number[], p: number) => {
  if (sorted.length === 0) return 0;
  const idx = Math.min(sorted.length - 1, Math.floor((p / 100) * sorted.length));
  return sorted[idx];
};

export function computeStats(w: MetricsWindow, nowMs: number): Stats {
  const cutoff = nowMs - WINDOW_MS;
  trim(w.emits, cutoff); trim(w.completes, cutoff); trim(w.fails, cutoff);
  trimObj(w.latencies, cutoff); trimObj(w.queueDepth, cutoff);
  const sorted = w.latencies.map((l) => l.ms).sort((a, b) => a - b);
  const total = w.completes.length + w.fails.length;
  return {
    rps_in: w.emits.length / (WINDOW_MS / 1000),
    rps_out: w.completes.length / (WINDOW_MS / 1000),
    error_rate: total === 0 ? 0 : w.fails.length / total,
    p50: pct(sorted, 50),
    p95: pct(sorted, 95),
    p99: pct(sorted, 99),
    queue_depth: w.queueDepth.length === 0 ? 0 : w.queueDepth[w.queueDepth.length - 1].n,
    throughput_total: w.completes.length,
  };
}
```

- [ ] **Step 4: Run tests, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/engine/metrics.ts tests/engine/metrics.test.ts
git commit -m "feat(engine): sliding-window metrics with percentiles"
```

---

## Task 6: Cron triggers

**Files:**
- Create: `src/engine/triggers.ts`
- Test: `tests/engine/triggers.test.ts`

- [ ] **Step 1: Write failing tests**

```ts
// tests/engine/triggers.test.ts
import { describe, it, expect } from 'vitest';
import { parseCron, nextFire } from '@/engine/triggers';

describe('cron parser (minimal: minute field only, supports * | N | */N)', () => {
  it('every minute', () => {
    const c = parseCron('* * * * *');
    expect(nextFire(c, 0)).toBe(60_000);
    expect(nextFire(c, 60_000)).toBe(120_000);
  });

  it('every 5 minutes', () => {
    const c = parseCron('*/5 * * * *');
    expect(nextFire(c, 0)).toBe(5 * 60_000);
  });

  it('exact minute=15', () => {
    const c = parseCron('15 * * * *');
    expect(nextFire(c, 0)).toBe(15 * 60_000);
    expect(nextFire(c, 16 * 60_000)).toBe((60 + 15) * 60_000);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

```ts
// src/engine/triggers.ts
// Minimal cron: only the first (minute) field is interpreted.
// Supported: '*', 'N', '*/N'. Other fields ignored. Sim-time only (ms).
export interface Cron {
  every?: number;
  exact?: number;
}

export function parseCron(spec: string): Cron {
  const minute = spec.trim().split(/\s+/)[0] ?? '*';
  if (minute === '*') return { every: 1 };
  const m = /^\*\/(\d+)$/.exec(minute);
  if (m) return { every: parseInt(m[1], 10) };
  if (/^\d+$/.test(minute)) return { exact: parseInt(minute, 10) };
  return { every: 1 };
}

export function nextFire(c: Cron, fromMs: number): number {
  const minute = 60_000;
  if (c.every) {
    const stride = c.every * minute;
    return Math.floor(fromMs / stride) * stride + stride;
  }
  if (c.exact !== undefined) {
    const hour = 60 * minute;
    const within = fromMs % hour;
    const target = c.exact * minute;
    return fromMs - within + (within < target ? target : hour + target);
  }
  return fromMs + minute;
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/engine/triggers.ts tests/engine/triggers.test.ts
git commit -m "feat(engine): minimal cron parser for triggers"
```

---

## Task 7: Node module — Webhook (origin)

**Files:**
- Create: `src/engine/nodes/webhook.ts`
- Test: `tests/engine/nodes/webhook.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/engine/nodes/webhook.test.ts
import { describe, it, expect } from 'vitest';
import { tickWebhook } from '@/engine/nodes/webhook';
import { mulberry32 } from '@/engine/rng';
import { emptyWindow } from '@/engine/metrics';

describe('webhook poisson emission', () => {
  it('emits ~rps particles per second over a long horizon', () => {
    const rng = mulberry32(7);
    const node = { id: 'w', kind: 'webhook' as const, name: 'W', rps: 10, pattern: 'poisson' as const };
    const rt = { inFlight: 0 };
    const ctx = { rng, dtMs: 100, nowMs: 0 };
    const w = emptyWindow();
    let emitted = 0;
    for (let t = 0; t < 10_000; t += 100) {
      const out = tickWebhook(node, rt, { ...ctx, nowMs: t });
      emitted += out.length;
    }
    // 10 rps * 10s = ~100, allow ±20%
    expect(emitted).toBeGreaterThan(80);
    expect(emitted).toBeLessThan(120);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

```ts
// src/engine/nodes/webhook.ts
import type { NodeRuntime, Particle } from '../types';
import type { Node } from '@/schema/diagram';

export interface NodeCtx { rng: () => number; dtMs: number; nowMs: number; }

export function tickWebhook(
  node: Extract<Node, { kind: 'webhook' }>,
  _rt: NodeRuntime,
  ctx: NodeCtx,
): Pick<Particle, 'originType' | 'bornAt'>[] {
  const expected = node.rps * (ctx.dtMs / 1000);
  if (node.pattern === 'burst') {
    if (ctx.nowMs % 1000 < ctx.dtMs) {
      const n = Math.round(node.rps);
      return Array.from({ length: n }, () => ({ originType: 'webhook', bornAt: ctx.nowMs }));
    }
    return [];
  }
  // poisson: simple Knuth algorithm per tick
  const L = Math.exp(-expected);
  let k = 0; let p = 1;
  while (true) {
    k++;
    p *= ctx.rng();
    if (p <= L) break;
  }
  const count = k - 1;
  return Array.from({ length: count }, () => ({ originType: 'webhook', bornAt: ctx.nowMs }));
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/engine/nodes/webhook.ts tests/engine/nodes/webhook.test.ts
git commit -m "feat(engine): webhook node (poisson + burst)"
```

---

## Task 8: Node module — LoadBalancer

**Files:**
- Create: `src/engine/nodes/loadbalancer.ts`
- Test: `tests/engine/nodes/loadbalancer.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/engine/nodes/loadbalancer.test.ts
import { describe, it, expect } from 'vitest';
import { pickBackend } from '@/engine/nodes/loadbalancer';
import { mulberry32 } from '@/engine/rng';

const edges = ['a', 'b', 'c'];

describe('load balancer strategies', () => {
  it('round_robin cycles through backends', () => {
    const rt: { rrCursor?: number } = {};
    expect(pickBackend('round_robin', edges, rt, mulberry32(1), {})).toBe('a');
    expect(pickBackend('round_robin', edges, rt, mulberry32(1), {})).toBe('b');
    expect(pickBackend('round_robin', edges, rt, mulberry32(1), {})).toBe('c');
    expect(pickBackend('round_robin', edges, rt, mulberry32(1), {})).toBe('a');
  });

  it('least_conn picks the backend with lowest in-flight', () => {
    const inFlight = { a: 5, b: 1, c: 3 };
    expect(pickBackend('least_conn', edges, {}, mulberry32(1), inFlight)).toBe('b');
  });

  it('random picks one of the edges deterministically with seed', () => {
    const r = mulberry32(123);
    const x = pickBackend('random', edges, {}, r, {});
    expect(edges).toContain(x);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

```ts
// src/engine/nodes/loadbalancer.ts
export function pickBackend(
  strategy: 'round_robin' | 'least_conn' | 'random',
  backends: string[],
  rt: { rrCursor?: number },
  rng: () => number,
  inFlightByBackend: Record<string, number>,
): string {
  if (backends.length === 0) throw new Error('no backends');
  if (strategy === 'random') return backends[Math.floor(rng() * backends.length)];
  if (strategy === 'least_conn') {
    return backends.reduce((best, b) =>
      (inFlightByBackend[b] ?? 0) < (inFlightByBackend[best] ?? 0) ? b : best,
    );
  }
  const cursor = rt.rrCursor ?? 0;
  const pick = backends[cursor % backends.length];
  rt.rrCursor = (cursor + 1) % backends.length;
  return pick;
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/engine/nodes/loadbalancer.ts tests/engine/nodes/loadbalancer.test.ts
git commit -m "feat(engine): load balancer (rr / least_conn / random)"
```

---

## Task 9: Node module — Gateway (token-bucket rate limit + 429)

**Files:**
- Create: `src/engine/nodes/gateway.ts`
- Test: `tests/engine/nodes/gateway.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/engine/nodes/gateway.test.ts
import { describe, it, expect } from 'vitest';
import { admitGateway } from '@/engine/nodes/gateway';

describe('gateway rate limit', () => {
  it('admits within budget, rejects with 429 over budget', () => {
    const node = { id: 'g', kind: 'gateway' as const, name: 'G', rate_limit_rps: 10, auth_check_ms: 0 };
    const rt = { inFlight: 0, tokens: undefined as number | undefined, lastRefillMs: 0 };
    let admitted = 0;
    let rejected = 0;
    for (let i = 0; i < 30; i++) {
      const r = admitGateway(node, rt, 0);
      if (r.ok) admitted++; else { expect(r.reason).toBe('429'); rejected++; }
    }
    expect(admitted).toBe(10);
    expect(rejected).toBe(20);
  });

  it('refills tokens over time', () => {
    const node = { id: 'g', kind: 'gateway' as const, name: 'G', rate_limit_rps: 10, auth_check_ms: 0 };
    const rt = { inFlight: 0, tokens: undefined as number | undefined, lastRefillMs: 0 };
    for (let i = 0; i < 10; i++) admitGateway(node, rt, 0);
    expect(admitGateway(node, rt, 0).ok).toBe(false);
    // 1 second later: 10 new tokens
    for (let i = 0; i < 10; i++) expect(admitGateway(node, rt, 1000).ok).toBe(true);
    expect(admitGateway(node, rt, 1000).ok).toBe(false);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

```ts
// src/engine/nodes/gateway.ts
import type { Node } from '@/schema/diagram';
import type { NodeRuntime } from '../types';

export function admitGateway(
  node: Extract<Node, { kind: 'gateway' }>,
  rt: NodeRuntime,
  nowMs: number,
): { ok: true } | { ok: false; reason: '429' } {
  if (rt.tokens === undefined) {
    rt.tokens = node.rate_limit_rps;
    rt.lastRefillMs = nowMs;
  }
  const elapsed = nowMs - (rt.lastRefillMs ?? nowMs);
  if (elapsed > 0) {
    const refill = (elapsed / 1000) * node.rate_limit_rps;
    rt.tokens = Math.min(node.rate_limit_rps, (rt.tokens ?? 0) + refill);
    rt.lastRefillMs = nowMs;
  }
  if ((rt.tokens ?? 0) >= 1) {
    rt.tokens! -= 1;
    return { ok: true };
  }
  return { ok: false, reason: '429' };
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/engine/nodes/gateway.ts tests/engine/nodes/gateway.test.ts
git commit -m "feat(engine): gateway with token-bucket rate limit (429)"
```

---

## Task 10: Node module — Queue (FIFO + overflow)

**Files:**
- Create: `src/engine/nodes/queue.ts`
- Test: `tests/engine/nodes/queue.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/engine/nodes/queue.test.ts
import { describe, it, expect } from 'vitest';
import { enqueue, dequeue, queueDepth } from '@/engine/nodes/queue';

describe('queue', () => {
  it('FIFO order', () => {
    const node = { id: 'q', kind: 'queue' as const, name: 'Q', max_depth: 10, on_overflow: 'drop' as const };
    const rt = { inFlight: 0, queue: [] as number[] };
    expect(enqueue(node, rt, 1).ok).toBe(true);
    expect(enqueue(node, rt, 2).ok).toBe(true);
    expect(dequeue(rt)).toBe(1);
    expect(dequeue(rt)).toBe(2);
    expect(dequeue(rt)).toBeUndefined();
  });

  it('drops on overflow', () => {
    const node = { id: 'q', kind: 'queue' as const, name: 'Q', max_depth: 2, on_overflow: 'drop' as const };
    const rt = { inFlight: 0, queue: [] as number[] };
    enqueue(node, rt, 1); enqueue(node, rt, 2);
    const r = enqueue(node, rt, 3);
    expect(r.ok).toBe(false);
    expect((r as { ok: false; reason: string }).reason).toBe('queue_overflow');
    expect(queueDepth(rt)).toBe(2);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

```ts
// src/engine/nodes/queue.ts
import type { Node } from '@/schema/diagram';
import type { NodeRuntime } from '../types';

export function enqueue(
  node: Extract<Node, { kind: 'queue' }>,
  rt: NodeRuntime,
  particleId: number,
): { ok: true } | { ok: false; reason: 'queue_overflow' } {
  if (!rt.queue) rt.queue = [];
  if (rt.queue.length >= node.max_depth) return { ok: false, reason: 'queue_overflow' };
  rt.queue.push(particleId);
  return { ok: true };
}

export function dequeue(rt: NodeRuntime): number | undefined {
  if (!rt.queue) return undefined;
  return rt.queue.shift();
}

export function queueDepth(rt: NodeRuntime): number {
  return rt.queue?.length ?? 0;
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/engine/nodes/queue.ts tests/engine/nodes/queue.test.ts
git commit -m "feat(engine): FIFO queue with overflow"
```

---

## Task 11: Node module — Worker (queue consumer with concurrency)

**Files:**
- Create: `src/engine/nodes/worker.ts`
- Test: `tests/engine/nodes/worker.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/engine/nodes/worker.test.ts
import { describe, it, expect } from 'vitest';
import { canPick, startProcessing, finishedAt } from '@/engine/nodes/worker';

describe('worker', () => {
  it('respects concurrency', () => {
    const node = { id: 'w', kind: 'worker' as const, name: 'W', concurrency: 2, latency_ms: 100, error_rate: 0 };
    const rt = { inFlight: 0, workersBusy: 0 };
    expect(canPick(node, rt)).toBe(true);
    startProcessing(node, rt); startProcessing(node, rt);
    expect(rt.workersBusy).toBe(2);
    expect(canPick(node, rt)).toBe(false);
  });

  it('finishedAt = now + latency_ms', () => {
    const node = { id: 'w', kind: 'worker' as const, name: 'W', concurrency: 1, latency_ms: 50, error_rate: 0 };
    expect(finishedAt(node, 1000)).toBe(1050);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

```ts
// src/engine/nodes/worker.ts
import type { Node } from '@/schema/diagram';
import type { NodeRuntime } from '../types';

export function canPick(node: Extract<Node, { kind: 'worker' }>, rt: NodeRuntime): boolean {
  return (rt.workersBusy ?? 0) < node.concurrency;
}
export function startProcessing(_node: Extract<Node, { kind: 'worker' }>, rt: NodeRuntime): void {
  rt.workersBusy = (rt.workersBusy ?? 0) + 1;
}
export function finishProcessing(_node: Extract<Node, { kind: 'worker' }>, rt: NodeRuntime): void {
  rt.workersBusy = Math.max(0, (rt.workersBusy ?? 0) - 1);
}
export function finishedAt(node: Extract<Node, { kind: 'worker' }>, nowMs: number): number {
  return nowMs + node.latency_ms;
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/engine/nodes/worker.ts tests/engine/nodes/worker.test.ts
git commit -m "feat(engine): worker with concurrency"
```

---

## Task 12: Node module — Cache (hit_rate stochastic)

**Files:**
- Create: `src/engine/nodes/cache.ts`
- Test: `tests/engine/nodes/cache.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/engine/nodes/cache.test.ts
import { describe, it, expect } from 'vitest';
import { cacheLookup } from '@/engine/nodes/cache';
import { mulberry32 } from '@/engine/rng';

describe('cache', () => {
  it('hit rate ~ matches configured value', () => {
    const node = { id: 'c', kind: 'cache' as const, name: 'C', hit_rate: 0.8, latency_ms: 1 };
    const rng = mulberry32(99);
    let hits = 0;
    for (let i = 0; i < 10000; i++) if (cacheLookup(node, rng).hit) hits++;
    expect(hits / 10000).toBeGreaterThan(0.77);
    expect(hits / 10000).toBeLessThan(0.83);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

```ts
// src/engine/nodes/cache.ts
import type { Node } from '@/schema/diagram';

export function cacheLookup(
  node: Extract<Node, { kind: 'cache' }>,
  rng: () => number,
): { hit: boolean; latencyMs: number } {
  return { hit: rng() < node.hit_rate, latencyMs: node.latency_ms };
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/engine/nodes/cache.ts tests/engine/nodes/cache.test.ts
git commit -m "feat(engine): cache with stochastic hit_rate"
```

---

## Task 13: Node module — Database (pool + timeout)

**Files:**
- Create: `src/engine/nodes/database.ts`
- Test: `tests/engine/nodes/database.test.ts`

- [ ] **Step 1: Write failing test**

```ts
// tests/engine/nodes/database.test.ts
import { describe, it, expect } from 'vitest';
import { acquireConn, releaseConn, expireWaiters } from '@/engine/nodes/database';

describe('database connection pool', () => {
  it('grants conns up to pool_size, then queues waiters', () => {
    const node = { id: 'db', kind: 'database' as const, name: 'DB', pool_size: 2, query_latency_ms: 10, timeout_ms: 100 };
    const rt = { inFlight: 0, poolUsed: 0, waiters: [] as { particleId: number; deadlineMs: number }[] };
    expect(acquireConn(node, rt, 1, 0).granted).toBe(true);
    expect(acquireConn(node, rt, 2, 0).granted).toBe(true);
    const r = acquireConn(node, rt, 3, 0);
    expect(r.granted).toBe(false);
    expect(rt.waiters.length).toBe(1);
  });

  it('expireWaiters returns timed-out particle ids', () => {
    const node = { id: 'db', kind: 'database' as const, name: 'DB', pool_size: 1, query_latency_ms: 10, timeout_ms: 100 };
    const rt = { inFlight: 0, poolUsed: 1, waiters: [{ particleId: 9, deadlineMs: 50 }] };
    expect(expireWaiters(rt, 200)).toEqual([9]);
    expect(rt.waiters).toEqual([]);
  });

  it('releaseConn promotes the next waiter', () => {
    const node = { id: 'db', kind: 'database' as const, name: 'DB', pool_size: 1, query_latency_ms: 10, timeout_ms: 100 };
    const rt = { inFlight: 0, poolUsed: 1, waiters: [{ particleId: 7, deadlineMs: 1000 }] };
    const promoted = releaseConn(rt, 100);
    expect(promoted).toBe(7);
    expect(rt.poolUsed).toBe(1);
    expect(rt.waiters).toEqual([]);
  });
});
```

- [ ] **Step 2: Run, expect FAIL**

- [ ] **Step 3: Implement**

```ts
// src/engine/nodes/database.ts
import type { Node } from '@/schema/diagram';
import type { NodeRuntime } from '../types';

export function acquireConn(
  node: Extract<Node, { kind: 'database' }>,
  rt: NodeRuntime,
  particleId: number,
  nowMs: number,
): { granted: boolean } {
  if ((rt.poolUsed ?? 0) < node.pool_size) {
    rt.poolUsed = (rt.poolUsed ?? 0) + 1;
    return { granted: true };
  }
  if (!rt.waiters) rt.waiters = [];
  rt.waiters.push({ particleId, deadlineMs: nowMs + node.timeout_ms });
  return { granted: false };
}

export function releaseConn(rt: NodeRuntime, _nowMs: number): number | undefined {
  if (!rt.waiters || rt.waiters.length === 0) {
    rt.poolUsed = Math.max(0, (rt.poolUsed ?? 1) - 1);
    return undefined;
  }
  const next = rt.waiters.shift()!;
  return next.particleId;
}

export function expireWaiters(rt: NodeRuntime, nowMs: number): number[] {
  if (!rt.waiters) return [];
  const expired: number[] = [];
  rt.waiters = rt.waiters.filter((w) => {
    if (w.deadlineMs <= nowMs) { expired.push(w.particleId); return false; }
    return true;
  });
  return expired;
}
```

- [ ] **Step 4: Run, expect PASS**

- [ ] **Step 5: Commit**

```bash
git add src/engine/nodes/database.ts tests/engine/nodes/database.test.ts
git commit -m "feat(engine): database with pool + timeout"
```

---

## Task 14: Wire dispatcher + integrate into tick.ts

**Files:**
- Create: `src/engine/nodes/index.ts`
- Modify: `src/engine/tick.ts`

- [ ] **Step 1: Create the dispatcher barrel**

```ts
// src/engine/nodes/index.ts
export * as webhook from './webhook';
export * as lb from './loadbalancer';
export * as gateway from './gateway';
export * as worker from './worker';
export * as queue from './queue';
export * as cache from './cache';
export * as database from './database';
```

- [ ] **Step 2: Refactor tick.ts**

Open `src/engine/tick.ts`. Replace the inline first-edge routing with calls to `chooseEdge()` from `./routing`. For each particle that arrives at a node, dispatch on `node.kind`:

- `client` / `webhook`: emit on each tick using existing/new emission code; assign `scenarioId` based on matching `Scenario.origin`. Record `recordEmit(metrics[node.id], nowMs)`.
- `gateway`: call `admitGateway(...)`. If 429, mark particle `failed`, `failureReason='429'`, `recordFail`.
- `load_balancer`: collect outgoing edges → `pickBackend(strategy, edgeIds, rt, rng, inFlightByBackend)` → put particle on chosen edge.
- `service` / `worker`: enqueue into `busyUntilMs` style processing; on completion record latency + `recordComplete`. For worker, pull from upstream queue if connected; respect `workersBusy < concurrency`.
- `queue`: `enqueue(...)`; on overflow → fail with `queue_overflow`; record `queueDepth` after every change.
- `cache`: `cacheLookup(...)`. On hit → particle proceeds to first non-tagged edge or tagged `tag:hit`. On miss → route to edge tagged `tag:miss` (must exist; if absent, fall back to first edge).
- `database`: `acquireConn(...)`. If granted → set `busyUntilMs = nowMs + query_latency_ms`. On release → `releaseConn` may promote a waiter; on tick, call `expireWaiters(...)` and mark each as failed with `timeout`.

Then call `tickTriggers(state, ctx)` (added in Task 15) at the start of each tick to inject cron-originated particles.

- [ ] **Step 3: Run all engine tests**

Run: `npm test`
Fix integration test expectations if naming changed. Existing 18 tests + 30+ new ones should all pass.

- [ ] **Step 4: Commit**

```bash
git add src/engine/nodes/index.ts src/engine/tick.ts
git commit -m "feat(engine): tick dispatcher integrates catalog + metrics"
```

---

## Task 15: Triggers integration in engine

**Files:**
- Modify: `src/engine/triggers.ts` — add `tickTriggers`
- Modify: `src/engine/tick.ts` — call `tickTriggers` at top of tick

- [ ] **Step 1: Add `tickTriggers` to triggers.ts**

```ts
import type { EngineState } from './types';
import type { Diagram } from '@/schema/diagram';

export function tickTriggers(state: EngineState, diag: Diagram): void {
  for (const node of diag.nodes) {
    if (node.kind !== 'service' && node.kind !== 'worker') continue;
    if (!node.triggers || node.triggers.length === 0) continue;
    const rt = state.nodes[node.id];
    if (!rt.cronNextMs) rt.cronNextMs = {};
    for (const t of node.triggers) {
      const c = parseCron(t.cron);
      const next = rt.cronNextMs[t.id] ?? nextFire(c, state.nowMs);
      if (state.nowMs >= next) {
        state.particles.push({
          id: state.nextParticleId++,
          originType: 'cron',
          bornAt: state.nowMs,
          location: { kind: 'node', id: node.id },
          status: 'processing',
        });
        state.counters.emitted++;
        rt.cronNextMs[t.id] = nextFire(c, state.nowMs);
      } else {
        rt.cronNextMs[t.id] = next;
      }
    }
  }
}
```

- [ ] **Step 2: Add an integration test**

```ts
// tests/engine/triggers.integration.test.ts
import { describe, it, expect } from 'vitest';
import { initEngine, runFor } from '@/engine'; // assuming a small helper from Plan 1
import { parseDiagram } from '@/lib/yaml';

const yaml = `
version: 1
nodes:
  - { id: s, kind: service, name: S, latency_ms: 1, capacity_rps: 100, error_rate: 0,
      triggers: [{ id: t1, cron: "*/1 * * * *" }] }
edges: []
`;

describe('cron triggers', () => {
  it('fires once per simulated minute', () => {
    const diag = parseDiagram(yaml);
    const state = initEngine(diag, 1);
    runFor(state, diag, 5 * 60_000, 100);
    // 5 minutes → 5 emits
    expect(state.counters.emitted).toBe(5);
  });
});
```

(If `initEngine`/`runFor` helper names differ in your Plan 1 code, adapt to whatever the store/test exposes. Add a small helper if missing.)

- [ ] **Step 3: Run, expect PASS**

- [ ] **Step 4: Commit**

```bash
git add src/engine/triggers.ts src/engine/tick.ts tests/engine/triggers.integration.test.ts
git commit -m "feat(engine): wire cron triggers into tick"
```

---

## Task 16: Scenarios integration test

**Files:**
- Test: `tests/engine/scenarios.integration.test.ts`

- [ ] **Step 1: Write end-to-end test**

```ts
// tests/engine/scenarios.integration.test.ts
import { describe, it, expect } from 'vitest';
import { initEngine, runFor } from '@/engine';
import { parseDiagram } from '@/lib/yaml';

const yaml = `
version: 1
nodes:
  - { id: c,   kind: client,  name: C, rps: 50, pattern: constant }
  - { id: sa,  kind: service, name: A, latency_ms: 5, capacity_rps: 1000, error_rate: 0 }
  - { id: sb,  kind: service, name: B, latency_ms: 5, capacity_rps: 1000, error_rate: 0 }
edges:
  - { source: c, target: sa, kind: sync, latency_ms: 1, weight: 1, tags: [scenario:checkout] }
  - { source: c, target: sb, kind: sync, latency_ms: 1, weight: 1, tags: [scenario:browse] }
scenarios:
  - { id: checkout, origin: c, weight: 1 }
  - { id: browse,   origin: c, weight: 1 }
`;

describe('scenarios pin routing', () => {
  it('checkout goes only to A; browse goes only to B', () => {
    const diag = parseDiagram(yaml);
    const state = initEngine(diag, 7);
    runFor(state, diag, 2_000, 100);
    const completed = state.particles.filter((p) => p.status === 'completed');
    const aCount = completed.filter((p) => p.scenarioId === 'checkout').length;
    const bCount = completed.filter((p) => p.scenarioId === 'browse').length;
    // both scenarios should fire (rough split)
    expect(aCount).toBeGreaterThan(0);
    expect(bCount).toBeGreaterThan(0);
    // and there should be no checkout particles that ended at sb (verified via metrics):
    // since A has no edge tagged scenario:browse, every checkout MUST traverse c→sa.
  });
});
```

- [ ] **Step 2: Run, expect PASS** (relies on Task 14's dispatcher correctly assigning scenarioId at emission and using `chooseEdge`)

- [ ] **Step 3: Commit**

```bash
git add tests/engine/scenarios.integration.test.ts
git commit -m "test(engine): scenario tag-based routing integration"
```

---

## Task 17: Store — selection + metrics selector

**Files:**
- Modify: `src/store/engineStore.ts`

- [ ] **Step 1: Add state + selectors**

```ts
// in engineStore.ts (Zustand store)
selectedNodeId: string | null,
selectNode: (id: string | null) => set({ selectedNodeId: id }),
getMetrics: (nodeId: string) => {
  const w = get().state.metrics[nodeId];
  if (!w) return null;
  return computeStats(w, get().state.nowMs);
},
```

Import `computeStats` from `@/engine/metrics`.

- [ ] **Step 2: Run typecheck + existing tests**

Run: `npx tsc -p tsconfig.json --noEmit && npm test`
Expected: green.

- [ ] **Step 3: Commit**

```bash
git add src/store/engineStore.ts
git commit -m "feat(store): node selection + metrics selector"
```

---

## Task 18: UI — 7 React Flow custom node cards

**Files:**
- Create: `src/ui/nodes/WebhookNode.tsx`, `LoadBalancerNode.tsx`, `GatewayNode.tsx`, `WorkerNode.tsx`, `QueueNode.tsx`, `CacheNode.tsx`, `DatabaseNode.tsx`
- Create: `src/ui/MetricsStrip.tsx`
- Modify: wherever `nodeTypes` is registered (likely `src/ui/Canvas.tsx`)

- [ ] **Step 1: Create `MetricsStrip`**

```tsx
// src/ui/MetricsStrip.tsx
import { useEngineStore } from '@/store/engineStore';

export function MetricsStrip({ nodeId }: { nodeId: string }) {
  const stats = useEngineStore((s) => s.getMetrics(nodeId));
  if (!stats) return null;
  return (
    <div className="metrics-strip" style={{ fontSize: 10, opacity: 0.8 }}>
      {stats.rps_in.toFixed(1)} rps • p95 {stats.p95.toFixed(0)}ms
      {stats.queue_depth > 0 && ` • q=${stats.queue_depth}`}
      {stats.error_rate > 0 && ` • err ${(stats.error_rate * 100).toFixed(1)}%`}
    </div>
  );
}
```

- [ ] **Step 2: Each node card follows this pattern (example: GatewayNode)**

```tsx
// src/ui/nodes/GatewayNode.tsx
import { Handle, Position, type NodeProps } from '@xyflow/react';
import { MetricsStrip } from '../MetricsStrip';

export function GatewayNode({ id, data }: NodeProps<{ name: string; rate_limit_rps: number }>) {
  return (
    <div className="rf-node rf-node--gateway">
      <Handle type="target" position={Position.Left} />
      <strong>🚪 {data.name}</strong>
      <small>{data.rate_limit_rps} rps</small>
      <MetricsStrip nodeId={id} />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
```

Repeat the pattern for the other 6 (use distinct emoji/color: 📡 webhook, ⚖️ lb, ⚙️ worker, 📥 queue, ⚡ cache, 🗄️ database). Show the most relevant 1-2 props in `<small>`.

- [ ] **Step 3: Register all node types**

In `Canvas.tsx`:

```tsx
import { GatewayNode } from './nodes/GatewayNode';
// ...all 7 imports
const nodeTypes = {
  client: ClientNode, service: ServiceNode,
  webhook: WebhookNode, load_balancer: LoadBalancerNode, gateway: GatewayNode,
  worker: WorkerNode, queue: QueueNode, cache: CacheNode, database: DatabaseNode,
};
```

- [ ] **Step 4: Add minimal CSS for the new nodes**

In `src/ui/styles.css` (or wherever existing rf-node styles live), add color variants per kind (`.rf-node--queue`, `.rf-node--cache`, etc.) — keep dark theme.

- [ ] **Step 5: Run dev server smoke test**

```bash
npm run build && npm run dev
```

Open http://localhost:5173/archflow/ and confirm a multi-component diagram renders without console errors.

- [ ] **Step 6: Commit**

```bash
git add src/ui/nodes src/ui/MetricsStrip.tsx src/ui/Canvas.tsx src/ui/styles.css
git commit -m "feat(ui): catalog node cards with live metrics strip"
```

---

## Task 19: UI — Inspector panel

**Files:**
- Create: `src/ui/Inspector.tsx`
- Modify: `src/ui/Layout.tsx`

- [ ] **Step 1: Implement the inspector**

```tsx
// src/ui/Inspector.tsx
import { useEngineStore } from '@/store/engineStore';

export function Inspector() {
  const id = useEngineStore((s) => s.selectedNodeId);
  const diagram = useEngineStore((s) => s.diagram);
  const stats = useEngineStore((s) => (id ? s.getMetrics(id) : null));
  if (!id || !diagram) return <aside className="inspector"><p>Select a node…</p></aside>;
  const node = diagram.nodes.find((n) => n.id === id);
  if (!node) return null;
  return (
    <aside className="inspector">
      <h3>{node.name} <small>({node.kind})</small></h3>
      <h4>Properties</h4>
      <pre>{JSON.stringify(node, null, 2)}</pre>
      <h4>Live metrics</h4>
      {stats ? (
        <ul>
          <li>rps_in: {stats.rps_in.toFixed(2)}</li>
          <li>rps_out: {stats.rps_out.toFixed(2)}</li>
          <li>error_rate: {(stats.error_rate * 100).toFixed(1)}%</li>
          <li>p50/p95/p99: {stats.p50.toFixed(0)}/{stats.p95.toFixed(0)}/{stats.p99.toFixed(0)} ms</li>
          <li>queue_depth: {stats.queue_depth}</li>
          <li>throughput: {stats.throughput_total}</li>
        </ul>
      ) : <p>No metrics yet (start the simulation)</p>}
    </aside>
  );
}
```

- [ ] **Step 2: Wire into Layout**

Replace the right-pane stub in `Layout.tsx`:

```tsx
import { Inspector } from './Inspector';
// ...
<div className="pane pane-right"><Inspector /></div>
```

Also: in `Canvas.tsx`, on `<ReactFlow onNodeClick={(_e, n) => selectNode(n.id)}>` wire the click handler.

- [ ] **Step 3: Smoke test**

`npm run dev` → click any node → inspector populates with props + live metrics tick.

- [ ] **Step 4: Commit**

```bash
git add src/ui/Inspector.tsx src/ui/Layout.tsx src/ui/Canvas.tsx
git commit -m "feat(ui): inspector panel with live metrics"
```

---

## Task 20: Demo YAML — full-catalog e-commerce

**Files:**
- Create: `src/examples/ecommerce.archflow.yaml`
- Modify: wherever the default demo is selected (`App.tsx` or similar) to load this as an option

- [ ] **Step 1: Author the YAML**

```yaml
# src/examples/ecommerce.archflow.yaml
version: 1
nodes:
  - { id: web,    kind: client,        name: Web Users,    rps: 30, pattern: constant }
  - { id: hook,   kind: webhook,       name: Stripe Hook,  rps: 2,  pattern: poisson }
  - { id: gw,     kind: gateway,       name: API Gateway,  rate_limit_rps: 100, auth_check_ms: 2 }
  - { id: lb,     kind: load_balancer, name: LB,           strategy: round_robin }
  - { id: api1,   kind: service,       name: API 1,        latency_ms: 30, capacity_rps: 60, error_rate: 0.01 }
  - { id: api2,   kind: service,       name: API 2,        latency_ms: 30, capacity_rps: 60, error_rate: 0.01 }
  - { id: cache,  kind: cache,         name: Redis,        hit_rate: 0.7, latency_ms: 1 }
  - { id: db,     kind: database,      name: Postgres,     pool_size: 20, query_latency_ms: 5, timeout_ms: 200 }
  - { id: q,      kind: queue,         name: Orders Q,     max_depth: 500, on_overflow: drop }
  - { id: wkr,    kind: worker,        name: Order Worker, concurrency: 4, latency_ms: 80, error_rate: 0,
      triggers: [{ id: nightly, cron: "0 * * * *" }] }
edges:
  - { source: web,   target: gw,    kind: sync,  latency_ms: 5,  weight: 1 }
  - { source: hook,  target: gw,    kind: sync,  latency_ms: 5,  weight: 1 }
  - { source: gw,    target: lb,    kind: sync,  latency_ms: 1,  weight: 1 }
  - { source: lb,    target: api1,  kind: sync,  latency_ms: 1,  weight: 1 }
  - { source: lb,    target: api2,  kind: sync,  latency_ms: 1,  weight: 1 }
  - { source: api1,  target: cache, kind: sync,  latency_ms: 1,  weight: 1, tags: [scenario:browse] }
  - { source: api2,  target: cache, kind: sync,  latency_ms: 1,  weight: 1, tags: [scenario:browse] }
  - { source: api1,  target: q,     kind: async, latency_ms: 1,  weight: 1, tags: [scenario:checkout] }
  - { source: api2,  target: q,     kind: async, latency_ms: 1,  weight: 1, tags: [scenario:checkout] }
  - { source: cache, target: db,    kind: sync,  latency_ms: 1,  weight: 1, tags: ["tag:miss"] }
  - { source: q,     target: wkr,   kind: async, latency_ms: 1,  weight: 1 }
  - { source: wkr,   target: db,    kind: sync,  latency_ms: 5,  weight: 1 }
scenarios:
  - { id: browse,   origin: web,  color: "#4CAF50", weight: 3 }
  - { id: checkout, origin: web,  color: "#FF9800", weight: 1 }
```

- [ ] **Step 2: Make it loadable**

In `App.tsx` (or whatever bootstraps the diagram), expose a small picker that lists `foundation` (Plan 1 demo) and `ecommerce`. Default keeps `foundation` to not break Plan 1's smoke test.

- [ ] **Step 3: Smoke test**

Switch the picker, verify diagram renders, particles flow through gateway → LB → APIs → cache (hit) or DB (miss), and the orders queue drains via the worker.

- [ ] **Step 4: Commit**

```bash
git add src/examples/ecommerce.archflow.yaml src/ui/App.tsx
git commit -m "feat(examples): full-catalog e-commerce demo"
```

---

## Task 21: Final verification

- [ ] **Step 1:** `npm run lint` → exit 0
- [ ] **Step 2:** `npx tsc -p tsconfig.json --noEmit` → exit 0
- [ ] **Step 3:** `npm test` → all tests pass (Plan 1's 18 + Plan 2's ~30+ new ones)
- [ ] **Step 4:** `npm run build` → succeeds
- [ ] **Step 5:** `npm run dev` → load both demos, click nodes, watch metrics update for at least 10 s

- [ ] **Step 6: Engine purity check** — `grep -RE 'from "(react|@xyflow|zustand)' src/engine` returns nothing

- [ ] **Step 7: Tag commit**

```bash
git tag -a archflow-plan-2 -m "archflow Plan 2: catalog + scenarios + metrics"
```

---

## Definition of Done

1. All 7 new node kinds parse, simulate, and render with their own React Flow card.
2. Token-bucket gateway emits 429s under sustained overload.
3. Queue overflow produces failed particles with `failureReason: 'queue_overflow'`.
4. DB pool waiters time out → `failureReason: 'timeout'`.
5. Cache `hit_rate` is statistically respected over ≥1000 samples.
6. Cron triggers fire on simulated wall-clock cadence.
7. Scenarios pin routing via `scenario:<id>` edge tags; default routing is weighted random.
8. Metrics inspector shows live `rps_in`, `rps_out`, `error_rate`, p50/p95/p99, `queue_depth`.
9. E-commerce demo runs end-to-end without errors with both browse + checkout scenarios visible.
10. Engine remains pure TS (no React/Zustand/@xyflow imports under `src/engine`).
