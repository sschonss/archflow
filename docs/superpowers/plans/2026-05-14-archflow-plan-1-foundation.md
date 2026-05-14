# archflow Plan 1 — Foundation Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Bootstrap the archflow project with a working end-to-end vertical slice: a tiny Client → Service diagram where bolinhas (particles) are emitted, travel along an edge, and complete at the Service — all rendered in the browser with play/pause controls.

**Architecture:** A pure-TypeScript simulation engine (deterministic, seeded, tick-based) lives under `src/engine/` with zero React dependencies. The diagram is described by Zod schemas (single source of truth) that round-trip to YAML. A minimal React UI (3-pane layout) renders nodes with React Flow and particles with a Canvas 2D overlay synced to the React Flow viewport.

**Tech Stack:** React 18 + TypeScript + Vite, React Flow (xyflow), Zod, eemeli/yaml, Zustand, Vitest, ESLint + Prettier, GitHub Actions.

---

## File Structure (Foundation)

This plan creates the following files. Subsequent plans will add more.

**Tooling / config**
- `package.json` — npm metadata, scripts, deps
- `tsconfig.json`, `tsconfig.node.json` — TypeScript config
- `vite.config.ts` — Vite + base path for GH Pages
- `vitest.config.ts` — Vitest config (jsdom env)
- `.eslintrc.cjs`, `.prettierrc.json`, `.editorconfig`
- `.gitignore`
- `index.html`
- `.github/workflows/ci.yml`

**Source — engine (pure TS, no React)**
- `src/engine/rng.ts` — mulberry32 seeded RNG
- `src/engine/types.ts` — `Particle`, `EngineState`, `NodeRuntime`
- `src/engine/tick.ts` — pure `tick(state, dtMs) → state` function
- `src/engine/nodes/client.ts` — Client emit logic
- `src/engine/nodes/service.ts` — Service process logic
- `src/engine/index.ts` — public API: `createEngine(diagram, seed)`, `tick`, `reset`

**Source — schema**
- `src/schema/diagram.ts` — Zod schemas for the minimal v1 diagram (Client, Service, Edge)
- `src/schema/index.ts` — re-exports

**Source — lib**
- `src/lib/yaml.ts` — `parseDiagram(text)`, `stringifyDiagram(diagram)`

**Source — store**
- `src/store/engineStore.ts` — Zustand slice for the running engine + RAF loop control

**Source — UI**
- `src/main.tsx` — React entry
- `src/App.tsx` — top-level layout
- `src/styles/globals.css` — dark theme variables, base resets
- `src/components/Layout.tsx` — 3-pane shell (palette stub / canvas / inspector stub)
- `src/components/canvas/FlowCanvas.tsx` — React Flow integration
- `src/components/canvas/ParticleLayer.tsx` — Canvas 2D overlay synced to viewport
- `src/components/canvas/nodes/ClientNode.tsx` — custom React Flow node
- `src/components/canvas/nodes/ServiceNode.tsx` — custom React Flow node
- `src/components/toolbar/Toolbar.tsx` — play / pause / reset, seed input

**Examples**
- `src/examples/foundation-demo.archflow.yaml` — sample diagram loaded at startup

**Tests**
- `tests/engine/rng.test.ts`
- `tests/engine/client.test.ts`
- `tests/engine/service.test.ts`
- `tests/engine/integration.test.ts`
- `tests/schema/diagram.test.ts`
- `tests/lib/yaml.test.ts`

**Misc**
- `README.md` (minimal placeholder; full README is in Plan 5)
- `LICENSE` (MIT — full text in Plan 5; placeholder here)

---

## Task 1: Initialize the Vite + React + TypeScript project

**Files:**
- Create: `package.json`
- Create: `tsconfig.json`
- Create: `tsconfig.node.json`
- Create: `vite.config.ts`
- Create: `index.html`
- Create: `.gitignore`
- Create: `.editorconfig`

- [ ] **Step 1.1: Create the project directory and `cd` in**

```bash
mkdir -p ~/Documents/codes/arch-sim
cd ~/Documents/codes/arch-sim
```

- [ ] **Step 1.2: Create `package.json`**

Write to `package.json`:

```json
{
  "name": "archflow",
  "version": "0.0.1",
  "private": true,
  "type": "module",
  "description": "Open-source interactive architecture diagrams with simulated request flows.",
  "license": "MIT",
  "scripts": {
    "dev": "vite",
    "build": "tsc -b && vite build",
    "preview": "vite preview",
    "test": "vitest run",
    "test:watch": "vitest",
    "lint": "eslint . --ext .ts,.tsx",
    "format": "prettier --write \"src/**/*.{ts,tsx,css,md}\" \"tests/**/*.ts\""
  },
  "dependencies": {
    "@xyflow/react": "^12.3.5",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "yaml": "^2.6.0",
    "zod": "^3.23.8",
    "zustand": "^5.0.1"
  },
  "devDependencies": {
    "@testing-library/jest-dom": "^6.5.0",
    "@testing-library/react": "^16.0.1",
    "@types/react": "^18.3.12",
    "@types/react-dom": "^18.3.1",
    "@typescript-eslint/eslint-plugin": "^8.12.2",
    "@typescript-eslint/parser": "^8.12.2",
    "@vitejs/plugin-react": "^4.3.3",
    "eslint": "^8.57.1",
    "eslint-plugin-react": "^7.37.2",
    "eslint-plugin-react-hooks": "^4.6.2",
    "jsdom": "^25.0.1",
    "prettier": "^3.3.3",
    "typescript": "^5.6.3",
    "vite": "^5.4.10",
    "vitest": "^2.1.4"
  }
}
```

- [ ] **Step 1.3: Create `tsconfig.json`**

Write to `tsconfig.json`:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "useDefineForClassFields": true,
    "lib": ["ES2022", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": false,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true,
    "esModuleInterop": true,
    "baseUrl": ".",
    "paths": {
      "@/*": ["src/*"]
    }
  },
  "include": ["src", "tests"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
```

- [ ] **Step 1.4: Create `tsconfig.node.json`**

Write to `tsconfig.node.json`:

```json
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts", "vitest.config.ts"]
}
```

- [ ] **Step 1.5: Create `vite.config.ts`**

Write to `vite.config.ts`:

```ts
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  // GH Pages will serve from /archflow/. Override via VITE_BASE if needed.
  base: process.env.VITE_BASE ?? "/archflow/",
  plugins: [react()],
  resolve: {
    alias: { "@": path.resolve(__dirname, "src") },
  },
});
```

- [ ] **Step 1.6: Create `index.html`**

Write to `index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>archflow</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.tsx"></script>
  </body>
</html>
```

- [ ] **Step 1.7: Create `.gitignore`**

Write to `.gitignore`:

```
node_modules/
dist/
.vite/
.DS_Store
*.log
.superpowers/
graphify-out/
coverage/
```

- [ ] **Step 1.8: Create `.editorconfig`**

Write to `.editorconfig`:

```
root = true

[*]
indent_style = space
indent_size = 2
end_of_line = lf
charset = utf-8
trim_trailing_whitespace = true
insert_final_newline = true
```

- [ ] **Step 1.9: Install dependencies**

Run:
```bash
npm install
```
Expected: completes without errors. `node_modules/` is created.

- [ ] **Step 1.10: Commit**

```bash
git add -A
git commit -m "chore: scaffold Vite + React + TS project"
```

---

## Task 2: Add ESLint, Prettier, Vitest configs

**Files:**
- Create: `.eslintrc.cjs`
- Create: `.prettierrc.json`
- Create: `vitest.config.ts`
- Create: `src/test-setup.ts`

- [ ] **Step 2.1: Create `.eslintrc.cjs`**

Write to `.eslintrc.cjs`:

```js
module.exports = {
  root: true,
  env: { browser: true, es2022: true, node: true },
  parser: "@typescript-eslint/parser",
  parserOptions: { ecmaVersion: "latest", sourceType: "module" },
  plugins: ["@typescript-eslint", "react", "react-hooks"],
  extends: [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:react/recommended",
    "plugin:react-hooks/recommended",
  ],
  settings: { react: { version: "detect" } },
  rules: {
    "react/react-in-jsx-scope": "off",
    "@typescript-eslint/no-unused-vars": [
      "error",
      { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
    ],
  },
  ignorePatterns: ["dist", "node_modules", "coverage"],
};
```

- [ ] **Step 2.2: Create `.prettierrc.json`**

Write to `.prettierrc.json`:

```json
{
  "semi": true,
  "singleQuote": false,
  "trailingComma": "all",
  "printWidth": 100,
  "tabWidth": 2
}
```

- [ ] **Step 2.3: Create `vitest.config.ts`**

Write to `vitest.config.ts`:

```ts
import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";
import path from "node:path";

export default defineConfig({
  plugins: [react()],
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    environment: "jsdom",
    globals: true,
    setupFiles: ["./src/test-setup.ts"],
    coverage: { provider: "v8", reporter: ["text", "html"] },
  },
});
```

- [ ] **Step 2.4: Create `src/test-setup.ts`**

```bash
mkdir -p src
```

Write to `src/test-setup.ts`:

```ts
import "@testing-library/jest-dom/vitest";
```

- [ ] **Step 2.5: Run lint to verify config works**

Run: `npm run lint`
Expected: exits 0 (no source files yet, so nothing to lint).

- [ ] **Step 2.6: Run tests to verify Vitest works**

Run: `npm test`
Expected: "No test files found" (exits 0 or with the no-tests warning — both acceptable).

- [ ] **Step 2.7: Commit**

```bash
git add -A
git commit -m "chore: add eslint, prettier, vitest configs"
```

---

## Task 3: Implement seeded RNG (TDD)

**Files:**
- Test: `tests/engine/rng.test.ts`
- Create: `src/engine/rng.ts`

- [ ] **Step 3.1: Write the failing test**

```bash
mkdir -p tests/engine src/engine
```

Write to `tests/engine/rng.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mulberry32 } from "@/engine/rng";

describe("mulberry32", () => {
  it("returns deterministic floats in [0, 1)", () => {
    const rng = mulberry32(42);
    const samples = [rng(), rng(), rng(), rng()];
    samples.forEach((n) => {
      expect(n).toBeGreaterThanOrEqual(0);
      expect(n).toBeLessThan(1);
    });
  });

  it("produces the same sequence for the same seed", () => {
    const a = mulberry32(123);
    const b = mulberry32(123);
    for (let i = 0; i < 10; i++) {
      expect(a()).toBe(b());
    }
  });

  it("produces different sequences for different seeds", () => {
    const a = mulberry32(1);
    const b = mulberry32(2);
    expect(a()).not.toBe(b());
  });
});
```

- [ ] **Step 3.2: Run test to verify it fails**

Run: `npm test -- tests/engine/rng.test.ts`
Expected: FAIL — module `@/engine/rng` does not exist.

- [ ] **Step 3.3: Implement `mulberry32`**

Write to `src/engine/rng.ts`:

```ts
/**
 * Seeded pseudo-random number generator (mulberry32).
 * Returns a function that yields floats in [0, 1).
 * Same seed always produces the same sequence — cornerstone of determinism.
 */
export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return function next() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
```

- [ ] **Step 3.4: Run test to verify it passes**

Run: `npm test -- tests/engine/rng.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 3.5: Commit**

```bash
git add tests/engine/rng.test.ts src/engine/rng.ts
git commit -m "feat(engine): seeded mulberry32 RNG"
```

---

## Task 4: Define schema for the minimal diagram (TDD)

The Foundation slice supports just two node kinds — `client` and `service` — and one edge kind (`sync`). Subsequent plans extend the schema.

**Files:**
- Test: `tests/schema/diagram.test.ts`
- Create: `src/schema/diagram.ts`
- Create: `src/schema/index.ts`

- [ ] **Step 4.1: Write the failing test**

```bash
mkdir -p tests/schema src/schema
```

Write to `tests/schema/diagram.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { DiagramSchema } from "@/schema/diagram";

describe("DiagramSchema", () => {
  it("accepts a minimal valid diagram with a Client and a Service", () => {
    const input = {
      version: 1,
      nodes: [
        { type: "client", id: "c1", label: "Client", rps: 10 },
        { type: "service", id: "s1", label: "Service", latency_ms: 20 },
      ],
      edges: [{ id: "e1", source: "c1", target: "s1", kind: "sync" }],
    };
    const result = DiagramSchema.safeParse(input);
    expect(result.success).toBe(true);
  });

  it("rejects an unknown node type", () => {
    const input = {
      version: 1,
      nodes: [{ type: "alien", id: "a1" }],
      edges: [],
    };
    expect(DiagramSchema.safeParse(input).success).toBe(false);
  });

  it("rejects an edge whose source or target is missing", () => {
    const input = {
      version: 1,
      nodes: [{ type: "client", id: "c1", label: "Client", rps: 10 }],
      edges: [{ id: "e1", source: "c1", target: "ghost", kind: "sync" }],
    };
    const parsed = DiagramSchema.safeParse(input);
    // structural shape is fine; dangling-target is enforced by a refine
    expect(parsed.success).toBe(false);
  });

  it("applies defaults: Client.pattern defaults to 'constant'", () => {
    const input = {
      version: 1,
      nodes: [{ type: "client", id: "c1", label: "C", rps: 5 }],
      edges: [],
    };
    const out = DiagramSchema.parse(input);
    const client = out.nodes[0];
    if (client.type !== "client") throw new Error("expected client");
    expect(client.pattern).toBe("constant");
  });
});
```

- [ ] **Step 4.2: Run test to verify it fails**

Run: `npm test -- tests/schema/diagram.test.ts`
Expected: FAIL — module `@/schema/diagram` does not exist.

- [ ] **Step 4.3: Implement the schema**

Write to `src/schema/diagram.ts`:

```ts
import { z } from "zod";

export const ClientNodeSchema = z.object({
  type: z.literal("client"),
  id: z.string().min(1),
  label: z.string().default("Client"),
  rps: z.number().positive(),
  pattern: z.enum(["constant", "burst", "ramp"]).default("constant"),
  payload_size: z.number().int().nonnegative().default(0),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
});

export const ServiceNodeSchema = z.object({
  type: z.literal("service"),
  id: z.string().min(1),
  label: z.string().default("Service"),
  latency_ms: z.number().nonnegative().default(20),
  capacity_rps: z.number().positive().default(1000),
  error_rate: z.number().min(0).max(1).default(0),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
});

export const NodeSchema = z.discriminatedUnion("type", [
  ClientNodeSchema,
  ServiceNodeSchema,
]);

export const EdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  kind: z.enum(["sync", "async"]).default("sync"),
  latency_ms: z.number().nonnegative().default(5),
  label: z.string().optional(),
  weight: z.number().positive().default(1),
});

export const DiagramSchema = z
  .object({
    version: z.literal(1),
    nodes: z.array(NodeSchema),
    edges: z.array(EdgeSchema),
  })
  .superRefine((diagram, ctx) => {
    const ids = new Set(diagram.nodes.map((n) => n.id));
    diagram.edges.forEach((edge, idx) => {
      if (!ids.has(edge.source)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["edges", idx, "source"],
          message: `edge ${edge.id} references unknown source ${edge.source}`,
        });
      }
      if (!ids.has(edge.target)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["edges", idx, "target"],
          message: `edge ${edge.id} references unknown target ${edge.target}`,
        });
      }
    });
  });

export type ClientNode = z.infer<typeof ClientNodeSchema>;
export type ServiceNode = z.infer<typeof ServiceNodeSchema>;
export type Node = z.infer<typeof NodeSchema>;
export type Edge = z.infer<typeof EdgeSchema>;
export type Diagram = z.infer<typeof DiagramSchema>;
```

- [ ] **Step 4.4: Implement re-exports**

Write to `src/schema/index.ts`:

```ts
export * from "./diagram";
```

- [ ] **Step 4.5: Run tests to verify they pass**

Run: `npm test -- tests/schema/diagram.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 4.6: Commit**

```bash
git add tests/schema src/schema
git commit -m "feat(schema): minimal Diagram schema (Client, Service, Edge)"
```

---

## Task 5: YAML round-trip helpers (TDD)

**Files:**
- Test: `tests/lib/yaml.test.ts`
- Create: `src/lib/yaml.ts`

- [ ] **Step 5.1: Write the failing test**

```bash
mkdir -p tests/lib src/lib
```

Write to `tests/lib/yaml.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { parseDiagram, stringifyDiagram } from "@/lib/yaml";

const SAMPLE = `version: 1
nodes:
  - type: client
    id: c1
    label: Client
    rps: 10
  - type: service
    id: s1
    label: Service
    latency_ms: 20
edges:
  - id: e1
    source: c1
    target: s1
    kind: sync
`;

describe("yaml helpers", () => {
  it("parses a valid YAML diagram", () => {
    const d = parseDiagram(SAMPLE);
    expect(d.nodes).toHaveLength(2);
    expect(d.edges).toHaveLength(1);
  });

  it("throws a readable error on invalid YAML", () => {
    expect(() => parseDiagram("nodes: [")).toThrow();
  });

  it("throws on schema-invalid input", () => {
    expect(() => parseDiagram("version: 1\nnodes: []\nedges: [{id: x, source: a, target: b, kind: sync}]")).toThrow();
  });

  it("round-trips parse -> stringify -> parse", () => {
    const d1 = parseDiagram(SAMPLE);
    const text = stringifyDiagram(d1);
    const d2 = parseDiagram(text);
    expect(d2).toEqual(d1);
  });
});
```

- [ ] **Step 5.2: Run test to verify it fails**

Run: `npm test -- tests/lib/yaml.test.ts`
Expected: FAIL — module `@/lib/yaml` does not exist.

- [ ] **Step 5.3: Implement YAML helpers**

Write to `src/lib/yaml.ts`:

```ts
import { parse, stringify } from "yaml";
import { DiagramSchema, type Diagram } from "@/schema";

export function parseDiagram(text: string): Diagram {
  const raw = parse(text);
  return DiagramSchema.parse(raw);
}

export function stringifyDiagram(diagram: Diagram): string {
  // Validate before serialization to refuse to emit a broken file.
  const validated = DiagramSchema.parse(diagram);
  return stringify(validated, { lineWidth: 0 });
}
```

- [ ] **Step 5.4: Run tests to verify they pass**

Run: `npm test -- tests/lib/yaml.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 5.5: Commit**

```bash
git add tests/lib src/lib
git commit -m "feat(lib): YAML parse/stringify with schema validation"
```

---

## Task 6: Engine types

**Files:**
- Create: `src/engine/types.ts`

- [ ] **Step 6.1: Define the engine types**

Write to `src/engine/types.ts`:

```ts
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
```

- [ ] **Step 6.2: Verify type-check succeeds**

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: exits 0.

- [ ] **Step 6.3: Commit**

```bash
git add src/engine/types.ts
git commit -m "feat(engine): core types (Particle, EngineState, NodeRuntime)"
```

---

## Task 7: Implement Client emission (TDD)

**Files:**
- Test: `tests/engine/client.test.ts`
- Create: `src/engine/nodes/client.ts`

- [ ] **Step 7.1: Write the failing test**

```bash
mkdir -p src/engine/nodes
```

Write to `tests/engine/client.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { tickClient } from "@/engine/nodes/client";
import { mulberry32 } from "@/engine/rng";
import type { EngineState, NodeRuntime } from "@/engine/types";
import type { ClientNode } from "@/schema";

function makeState(client: ClientNode): EngineState {
  const rt: NodeRuntime = { nodeId: client.id, emitAccumulatorMs: 0, inFlight: [] };
  return {
    diagram: { version: 1, nodes: [client], edges: [] },
    seed: 1,
    rngState: 1,
    nowMs: 0,
    particles: [],
    nodes: { [client.id]: rt },
    counters: { emitted: 0, completed: 0, failed: 0 },
    nextParticleId: 1,
  };
}

describe("Client emission", () => {
  it("emits ~rps particles per simulated second (constant pattern)", () => {
    const client: ClientNode = {
      type: "client",
      id: "c1",
      label: "C",
      rps: 10,
      pattern: "constant",
      payload_size: 0,
    };
    const state = makeState(client);
    const rng = mulberry32(state.seed);
    // Advance 1000 ms in 50 ticks of 20 ms each.
    for (let i = 0; i < 50; i++) {
      state.nowMs += 20;
      tickClient(state, client, 20, rng);
    }
    expect(state.counters.emitted).toBe(10);
    expect(state.particles).toHaveLength(10);
    state.particles.forEach((p) => {
      expect(p.originNodeId).toBe("c1");
      expect(p.originType).toBe("http");
      expect(p.location).toEqual({ kind: "node", id: "c1" });
      expect(p.status).toBe("in_flight");
    });
  });

  it("does not emit when rps is below the per-tick threshold but accumulates over time", () => {
    const client: ClientNode = {
      type: "client",
      id: "c1",
      label: "C",
      rps: 1,
      pattern: "constant",
      payload_size: 0,
    };
    const state = makeState(client);
    const rng = mulberry32(state.seed);
    // 100 ms tick at 1 rps → 0.1 particles per tick. Should still emit 1 over 1 s.
    for (let i = 0; i < 10; i++) {
      state.nowMs += 100;
      tickClient(state, client, 100, rng);
    }
    expect(state.counters.emitted).toBe(1);
  });
});
```

- [ ] **Step 7.2: Run test to verify it fails**

Run: `npm test -- tests/engine/client.test.ts`
Expected: FAIL — module `@/engine/nodes/client` does not exist.

- [ ] **Step 7.3: Implement Client emission**

Write to `src/engine/nodes/client.ts`:

```ts
import type { ClientNode } from "@/schema";
import type { EngineState, NodeRuntime, Particle } from "@/engine/types";

/**
 * Emit particles from a Client node. Uses a time-domain accumulator so that
 * fractional particles per tick still produce the correct integer rate over
 * longer windows (deterministic, no RNG needed for `constant`).
 *
 * Patterns `burst` and `ramp` are implemented in Plan 2; for now they fall
 * back to constant.
 */
export function tickClient(
  state: EngineState,
  client: ClientNode,
  dtMs: number,
  _rng: () => number,
): void {
  const rt = state.nodes[client.id];
  if (!rt) return;

  const particlesPerMs = client.rps / 1000;
  rt.emitAccumulatorMs += particlesPerMs * dtMs;

  while (rt.emitAccumulatorMs >= 1) {
    rt.emitAccumulatorMs -= 1;
    emitOne(state, client, rt);
  }
}

function emitOne(state: EngineState, client: ClientNode, _rt: NodeRuntime): void {
  const id = `p${state.nextParticleId++}`;
  const particle: Particle = {
    id,
    scenarioId: null,
    originNodeId: client.id,
    originType: "http",
    location: { kind: "node", id: client.id },
    birthTimeMs: state.nowMs,
    latencySoFarMs: 0,
    status: "in_flight",
  };
  state.particles.push(particle);
  state.counters.emitted += 1;
}
```

- [ ] **Step 7.4: Run tests to verify they pass**

Run: `npm test -- tests/engine/client.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 7.5: Commit**

```bash
git add tests/engine/client.test.ts src/engine/nodes/client.ts
git commit -m "feat(engine): Client emission with time-domain accumulator"
```

---

## Task 8: Implement Service processing (TDD)

**Files:**
- Test: `tests/engine/service.test.ts`
- Create: `src/engine/nodes/service.ts`

- [ ] **Step 8.1: Write the failing test**

Write to `tests/engine/service.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { tickService } from "@/engine/nodes/service";
import { mulberry32 } from "@/engine/rng";
import type { EngineState } from "@/engine/types";
import type { ServiceNode } from "@/schema";

function makeState(svc: ServiceNode): EngineState {
  return {
    diagram: { version: 1, nodes: [svc], edges: [] },
    seed: 1,
    rngState: 1,
    nowMs: 0,
    particles: [],
    nodes: {
      [svc.id]: { nodeId: svc.id, emitAccumulatorMs: 0, inFlight: [] },
    },
    counters: { emitted: 0, completed: 0, failed: 0 },
    nextParticleId: 1,
  };
}

describe("Service processing", () => {
  it("completes a particle after latency_ms with error_rate=0", () => {
    const svc: ServiceNode = {
      type: "service",
      id: "s1",
      label: "S",
      latency_ms: 50,
      capacity_rps: 100,
      error_rate: 0,
    };
    const state = makeState(svc);
    const rng = mulberry32(1);
    // Inject a particle that just arrived at the service.
    state.particles.push({
      id: "p1",
      scenarioId: null,
      originNodeId: "x",
      originType: "http",
      location: { kind: "node", id: "s1" },
      birthTimeMs: 0,
      latencySoFarMs: 0,
      status: "in_flight",
    });
    state.nodes["s1"].inFlight.push(state.particles[0]);
    state.particles[0].status = "processing";

    // Advance time below latency: still processing.
    state.nowMs = 30;
    tickService(state, svc, 30, rng);
    expect(state.particles[0].status).toBe("processing");

    // Advance past latency: completes and is removed from particles.
    state.nowMs = 60;
    tickService(state, svc, 30, rng);
    expect(state.counters.completed).toBe(1);
    expect(state.particles).toHaveLength(0);
    expect(state.nodes["s1"].inFlight).toHaveLength(0);
  });

  it("fails a particle when error_rate=1", () => {
    const svc: ServiceNode = {
      type: "service",
      id: "s1",
      label: "S",
      latency_ms: 10,
      capacity_rps: 100,
      error_rate: 1,
    };
    const state = makeState(svc);
    const rng = mulberry32(1);
    state.particles.push({
      id: "p1",
      scenarioId: null,
      originNodeId: "x",
      originType: "http",
      location: { kind: "node", id: "s1" },
      birthTimeMs: 0,
      latencySoFarMs: 0,
      status: "processing",
    });
    state.nodes["s1"].inFlight.push(state.particles[0]);

    state.nowMs = 20;
    tickService(state, svc, 20, rng);
    expect(state.counters.failed).toBe(1);
    expect(state.counters.completed).toBe(0);
  });
});
```

- [ ] **Step 8.2: Run test to verify it fails**

Run: `npm test -- tests/engine/service.test.ts`
Expected: FAIL — module `@/engine/nodes/service` does not exist.

- [ ] **Step 8.3: Implement Service processing**

Write to `src/engine/nodes/service.ts`:

```ts
import type { ServiceNode } from "@/schema";
import type { EngineState, Particle } from "@/engine/types";

interface ProcessingMeta {
  startedAtMs: number;
}

const meta = new WeakMap<Particle, ProcessingMeta>();

/**
 * Process particles inside a Service node. v1 Foundation: single-replica,
 * unbounded queue, fixed latency, stochastic error_rate. Capacity, replicas,
 * stddev latency, retries, etc. arrive in Plan 2 / Plan 3.
 */
export function tickService(
  state: EngineState,
  service: ServiceNode,
  _dtMs: number,
  rng: () => number,
): void {
  const rt = state.nodes[service.id];
  if (!rt) return;

  // Mark newly-arrived particles as processing and record start time.
  for (const p of rt.inFlight) {
    if (p.status === "in_flight") {
      p.status = "processing";
    }
    if (!meta.has(p)) {
      meta.set(p, { startedAtMs: state.nowMs });
    }
  }

  // Complete or fail particles whose processing window has elapsed.
  const stillInFlight: Particle[] = [];
  for (const p of rt.inFlight) {
    const m = meta.get(p)!;
    const elapsed = state.nowMs - m.startedAtMs;
    if (elapsed >= service.latency_ms) {
      const errored = rng() < service.error_rate;
      if (errored) {
        p.status = "failed";
        p.failureReason = "service_error";
        state.counters.failed += 1;
      } else {
        p.status = "completed";
        state.counters.completed += 1;
      }
      p.latencySoFarMs += service.latency_ms;
      meta.delete(p);
      // Remove from global particle list.
      const idx = state.particles.indexOf(p);
      if (idx !== -1) state.particles.splice(idx, 1);
    } else {
      stillInFlight.push(p);
    }
  }
  rt.inFlight = stillInFlight;
}
```

- [ ] **Step 8.4: Run tests to verify they pass**

Run: `npm test -- tests/engine/service.test.ts`
Expected: PASS, 2 tests.

- [ ] **Step 8.5: Commit**

```bash
git add tests/engine/service.test.ts src/engine/nodes/service.ts
git commit -m "feat(engine): Service processing with latency and error_rate"
```

---

## Task 9: Implement edge traversal in `tick()` (TDD integration)

**Files:**
- Test: `tests/engine/integration.test.ts`
- Create: `src/engine/tick.ts`
- Create: `src/engine/index.ts`

- [ ] **Step 9.1: Write the failing test**

Write to `tests/engine/integration.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { createEngine } from "@/engine";

const DIAGRAM = {
  version: 1 as const,
  nodes: [
    { type: "client" as const, id: "c1", label: "C", rps: 10, pattern: "constant" as const, payload_size: 0 },
    { type: "service" as const, id: "s1", label: "S", latency_ms: 50, capacity_rps: 1000, error_rate: 0 },
  ],
  edges: [
    { id: "e1", source: "c1", target: "s1", kind: "sync" as const, latency_ms: 100, weight: 1 },
  ],
};

describe("engine integration", () => {
  it("client→edge→service end-to-end produces completed particles", () => {
    const engine = createEngine(DIAGRAM, 42);
    // Run 2 simulated seconds in 20-ms ticks.
    for (let i = 0; i < 100; i++) {
      engine.tick(20);
    }
    // 10 rps × 2 s = 20 emitted; first reaches service after 100ms (edge),
    // completes 50ms later → 150ms. By 2000ms, all are completed.
    expect(engine.state.counters.emitted).toBe(20);
    expect(engine.state.counters.completed).toBe(20);
    expect(engine.state.counters.failed).toBe(0);
  });

  it("is deterministic across runs with the same seed", () => {
    const a = createEngine(DIAGRAM, 7);
    const b = createEngine(DIAGRAM, 7);
    for (let i = 0; i < 50; i++) {
      a.tick(20);
      b.tick(20);
    }
    expect(a.state.counters).toEqual(b.state.counters);
  });

  it("reset() clears particles and counters", () => {
    const engine = createEngine(DIAGRAM, 1);
    for (let i = 0; i < 10; i++) engine.tick(20);
    expect(engine.state.counters.emitted).toBeGreaterThan(0);
    engine.reset();
    expect(engine.state.counters).toEqual({ emitted: 0, completed: 0, failed: 0 });
    expect(engine.state.particles).toEqual([]);
    expect(engine.state.nowMs).toBe(0);
  });
});
```

- [ ] **Step 9.2: Run test to verify it fails**

Run: `npm test -- tests/engine/integration.test.ts`
Expected: FAIL — module `@/engine` does not exist.

- [ ] **Step 9.3: Implement `tick()`**

Write to `src/engine/tick.ts`:

```ts
import { mulberry32 } from "./rng";
import type { EngineState, Particle } from "./types";
import { getNode, getEdge, outgoingEdges } from "./types";
import { tickClient } from "./nodes/client";
import { tickService } from "./nodes/service";

/**
 * Advance the simulation by `dtMs`. Pure function over EngineState (mutates
 * in place; cloning is the caller's job if they want history).
 *
 * Order each tick:
 *   1. Advance time.
 *   2. Move in-flight particles along edges.
 *   3. Emit new particles from Clients.
 *   4. Process particles in Services.
 */
export function tick(state: EngineState, dtMs: number): void {
  const rng = mulberry32(state.rngState);
  // Burn one to advance the rngState deterministically per tick.
  state.rngState = Math.floor(rng() * 0xffffffff);
  const tickRng = mulberry32(state.rngState);

  state.nowMs += dtMs;

  advanceEdges(state, dtMs);
  emitFromClients(state, dtMs, tickRng);
  processServices(state, dtMs, tickRng);
}

function advanceEdges(state: EngineState, dtMs: number): void {
  for (const p of state.particles) {
    if (p.location.kind !== "edge") continue;
    const edge = getEdge(state, p.location.id);
    if (!edge) continue;
    const stepProgress = edge.latency_ms === 0 ? 1 : dtMs / edge.latency_ms;
    p.location.progress += stepProgress;
    p.latencySoFarMs += dtMs;
    if (p.location.progress >= 1) {
      // Arrival at target node.
      const target = getNode(state, edge.target);
      if (!target) continue;
      p.location = { kind: "node", id: target.id };
      const rt = state.nodes[target.id];
      if (rt) rt.inFlight.push(p);
    }
  }
}

function emitFromClients(state: EngineState, dtMs: number, rng: () => number): void {
  for (const node of state.diagram.nodes) {
    if (node.type !== "client") continue;
    const before = state.particles.length;
    tickClient(state, node, dtMs, rng);
    // Newly-emitted particles must be moved onto the first outgoing edge
    // (foundation: pick the first; weighted/scenario routing in Plan 2).
    const newParticles = state.particles.slice(before);
    const edges = outgoingEdges(state, node.id);
    if (edges.length === 0) continue;
    for (const p of newParticles) {
      const edge = edges[0];
      p.location = { kind: "edge", id: edge.id, progress: 0 };
    }
  }
}

function processServices(state: EngineState, dtMs: number, rng: () => number): void {
  for (const node of state.diagram.nodes) {
    if (node.type !== "service") continue;
    tickService(state, node, dtMs, rng);
  }
  // Drop particles that completed/failed but somehow remain.
  state.particles = state.particles.filter(
    (p) => p.status !== "completed" && p.status !== "failed",
  );
  // No-op alias to suppress unused-var lint.
  void rng;
  void dtMs;
}
```

- [ ] **Step 9.4: Implement the engine factory**

Write to `src/engine/index.ts`:

```ts
import type { Diagram } from "@/schema";
import type { EngineApi, EngineState, NodeRuntime } from "./types";
import { tick as tickFn } from "./tick";

export * from "./types";
export { tick as tick } from "./tick";
export { mulberry32 } from "./rng";

export function createEngine(diagram: Diagram, seed: number): EngineApi {
  const state: EngineState = buildInitial(diagram, seed);
  return {
    state,
    tick(dtMs: number) {
      tickFn(state, dtMs);
    },
    reset() {
      const fresh = buildInitial(diagram, seed);
      Object.assign(state, fresh);
    },
  };
}

function buildInitial(diagram: Diagram, seed: number): EngineState {
  const nodes: Record<string, NodeRuntime> = {};
  for (const n of diagram.nodes) {
    nodes[n.id] = { nodeId: n.id, emitAccumulatorMs: 0, inFlight: [] };
  }
  return {
    diagram,
    seed,
    rngState: seed >>> 0,
    nowMs: 0,
    particles: [],
    nodes,
    counters: { emitted: 0, completed: 0, failed: 0 },
    nextParticleId: 1,
  };
}
```

- [ ] **Step 9.5: Run tests to verify they pass**

Run: `npm test -- tests/engine/integration.test.ts`
Expected: PASS, 3 tests.

- [ ] **Step 9.6: Run all tests**

Run: `npm test`
Expected: all tests PASS (rng + client + service + integration + schema + yaml).

- [ ] **Step 9.7: Commit**

```bash
git add tests/engine/integration.test.ts src/engine/tick.ts src/engine/index.ts
git commit -m "feat(engine): tick() with edge traversal and end-to-end flow"
```

---

## Task 10: Sample diagram YAML

**Files:**
- Create: `src/examples/foundation-demo.archflow.yaml`

- [ ] **Step 10.1: Create the example diagram**

```bash
mkdir -p src/examples
```

Write to `src/examples/foundation-demo.archflow.yaml`:

```yaml
# archflow Foundation demo — single Client emitting 5 rps to a single Service.
# Edge has 100 ms simulated network latency; Service processes in 50 ms.
version: 1
nodes:
  - type: client
    id: client-mobile
    label: Mobile App
    rps: 5
    pattern: constant
    position: { x: 80, y: 200 }
  - type: service
    id: orders-svc
    label: orders-svc
    latency_ms: 50
    capacity_rps: 200
    error_rate: 0
    position: { x: 420, y: 200 }
edges:
  - id: e-client-orders
    source: client-mobile
    target: orders-svc
    kind: sync
    latency_ms: 100
```

- [ ] **Step 10.2: Commit**

```bash
git add src/examples/foundation-demo.archflow.yaml
git commit -m "feat(examples): foundation demo diagram"
```

---

## Task 11: Global styles and theme

**Files:**
- Create: `src/styles/globals.css`

- [ ] **Step 11.1: Create the global stylesheet**

```bash
mkdir -p src/styles
```

Write to `src/styles/globals.css`:

```css
:root {
  --bg: #0f1117;
  --bg-elev: #161922;
  --panel: #1f2330;
  --border: #2a2f3a;
  --text: #f5f6fa;
  --text-dim: #8a8f9c;
  --accent: #4ade80;
  --info: #60a5fa;
  --warn: #fbbf24;
  --danger: #f87171;
  --client: #4ade80;
  --service: #fbbf24;
  font-family:
    ui-sans-serif,
    system-ui,
    -apple-system,
    "Segoe UI",
    Roboto,
    sans-serif;
  color-scheme: dark;
}

*,
*::before,
*::after {
  box-sizing: border-box;
}

html,
body,
#root {
  margin: 0;
  padding: 0;
  height: 100%;
  background: var(--bg);
  color: var(--text);
  overflow: hidden;
}

button {
  font: inherit;
  cursor: pointer;
}
```

- [ ] **Step 11.2: Commit**

```bash
git add src/styles/globals.css
git commit -m "style: dark theme variables and base resets"
```

---

## Task 12: Zustand engine store

**Files:**
- Create: `src/store/engineStore.ts`

- [ ] **Step 12.1: Create the engine store**

```bash
mkdir -p src/store
```

Write to `src/store/engineStore.ts`:

```ts
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
```

- [ ] **Step 12.2: Verify type-check**

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: exits 0.

- [ ] **Step 12.3: Commit**

```bash
git add src/store/engineStore.ts
git commit -m "feat(store): Zustand engine store with play/pause/reset"
```

---

## Task 13: Custom React Flow nodes

**Files:**
- Create: `src/components/canvas/nodes/ClientNode.tsx`
- Create: `src/components/canvas/nodes/ServiceNode.tsx`

- [ ] **Step 13.1: Create the Client node**

```bash
mkdir -p src/components/canvas/nodes
```

Write to `src/components/canvas/nodes/ClientNode.tsx`:

```tsx
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

export interface ClientNodeData {
  label: string;
  rps: number;
}

export function ClientNode(props: NodeProps) {
  const data = props.data as unknown as ClientNodeData;
  return (
    <div
      style={{
        padding: "10px 14px",
        background: "var(--panel)",
        border: "2px solid var(--client)",
        borderRadius: 8,
        minWidth: 110,
        color: "var(--text)",
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 600 }}>🌐 {data.label}</div>
      <div style={{ fontSize: 10, color: "var(--text-dim)" }}>rps: {data.rps}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
```

- [ ] **Step 13.2: Create the Service node**

Write to `src/components/canvas/nodes/ServiceNode.tsx`:

```tsx
import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

export interface ServiceNodeData {
  label: string;
  latency_ms: number;
}

export function ServiceNode(props: NodeProps) {
  const data = props.data as unknown as ServiceNodeData;
  return (
    <div
      style={{
        padding: "10px 14px",
        background: "var(--panel)",
        border: "2px solid var(--service)",
        borderRadius: 8,
        minWidth: 130,
        color: "var(--text)",
        fontSize: 12,
      }}
    >
      <Handle type="target" position={Position.Left} />
      <div style={{ fontWeight: 600 }}>⚙️ {data.label}</div>
      <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
        p99: ~{data.latency_ms}ms
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
```

- [ ] **Step 13.3: Commit**

```bash
git add src/components/canvas/nodes
git commit -m "feat(ui): Client and Service custom React Flow nodes"
```

---

## Task 14: React Flow canvas wrapper

**Files:**
- Create: `src/components/canvas/FlowCanvas.tsx`

- [ ] **Step 14.1: Build FlowCanvas**

Write to `src/components/canvas/FlowCanvas.tsx`:

```tsx
import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node as RFNode,
  type Edge as RFEdge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useEngineStore } from "@/store/engineStore";
import { ClientNode } from "./nodes/ClientNode";
import { ServiceNode } from "./nodes/ServiceNode";
import { ParticleLayer } from "./ParticleLayer";

const nodeTypes = { client: ClientNode, service: ServiceNode };

export function FlowCanvas() {
  const diagram = useEngineStore((s) => s.diagram);

  const { nodes, edges } = useMemo<{ nodes: RFNode[]; edges: RFEdge[] }>(() => {
    if (!diagram) return { nodes: [], edges: [] };
    const nodes: RFNode[] = diagram.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position ?? { x: 0, y: 0 },
      data:
        n.type === "client"
          ? { label: n.label, rps: n.rps }
          : { label: n.label, latency_ms: n.latency_ms },
    }));
    const edges: RFEdge[] = diagram.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: "default",
    }));
    return { nodes, edges };
  }, [diagram]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        proOptions={{ hideAttribution: true }}
        fitView
      >
        <Background gap={20} color="var(--border)" />
        <Controls />
      </ReactFlow>
      <ParticleLayer />
    </div>
  );
}
```

- [ ] **Step 14.2: Commit (the file references ParticleLayer which is created in Task 15)**

Skip commit until Task 15 lands so we don't push a broken build.

---

## Task 15: Particle Canvas overlay

**Files:**
- Create: `src/components/canvas/ParticleLayer.tsx`

- [ ] **Step 15.1: Build ParticleLayer**

The overlay reads the engine state on every animation frame, computes each particle's screen position (interpolating along the visible edge geometry), and draws coloured dots on a 2D canvas absolutely positioned over React Flow. Pan/zoom from React Flow's viewport are applied as a CSS transform on the canvas.

Write to `src/components/canvas/ParticleLayer.tsx`:

```tsx
import { useEffect, useRef } from "react";
import { useStore as useRFStore } from "@xyflow/react";
import { useEngineStore } from "@/store/engineStore";

const PARTICLE_RADIUS = 4;
const COLOR_BY_ORIGIN: Record<string, string> = {
  http: "#4ade80",
  webhook: "#60a5fa",
  cron: "#fbbf24",
};

export function ParticleLayer() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  // React Flow viewport (pan/zoom).
  const transform = useRFStore((s) => s.transform); // [x, y, zoom]
  const nodeMap = useRFStore((s) => s.nodeLookup);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const { offsetWidth: w, offsetHeight: h } = canvas;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    const obs = new ResizeObserver(resize);
    obs.observe(canvas);

    function draw(now: number) {
      const last = lastTimeRef.current ?? now;
      const dt = Math.min(50, now - last);
      lastTimeRef.current = now;

      const { engine, isRunning, step } = useEngineStore.getState();
      if (engine && isRunning) step(dt);

      ctx!.clearRect(0, 0, canvas!.offsetWidth, canvas!.offsetHeight);
      if (!engine) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const [tx, ty, zoom] = transform;
      const particles = engine.state.particles;
      for (const p of particles) {
        const pos = particlePos(p, engine.state.diagram, nodeMap);
        if (!pos) continue;
        const x = pos.x * zoom + tx;
        const y = pos.y * zoom + ty;
        ctx!.beginPath();
        ctx!.arc(x, y, PARTICLE_RADIUS, 0, Math.PI * 2);
        ctx!.fillStyle = COLOR_BY_ORIGIN[p.originType] ?? "#fff";
        ctx!.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    }
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      obs.disconnect();
    };
  }, [transform, nodeMap]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
    />
  );
}

interface XY {
  x: number;
  y: number;
}

/**
 * Compute the unprojected (diagram-space) position of a particle. Returns
 * null if the source/target nodes are not yet measured by React Flow.
 */
function particlePos(
  particle: ReturnType<typeof useEngineStore.getState>["engine"] extends infer _ ? import("@/engine").Particle : never,
  diagram: import("@/schema").Diagram | null,
  nodeMap: Map<string, { internals?: { positionAbsolute?: XY }; measured?: { width?: number; height?: number } }>,
): XY | null {
  if (!diagram) return null;

  const nodeCenter = (id: string): XY | null => {
    const internal = nodeMap.get(id);
    const pos = internal?.internals?.positionAbsolute;
    if (!pos) return null;
    const w = internal?.measured?.width ?? 120;
    const h = internal?.measured?.height ?? 40;
    return { x: pos.x + w / 2, y: pos.y + h / 2 };
  };

  if (particle.location.kind === "node") {
    return nodeCenter(particle.location.id);
  }
  const edge = diagram.edges.find((e) => e.id === particle.location.id);
  if (!edge) return null;
  const a = nodeCenter(edge.source);
  const b = nodeCenter(edge.target);
  if (!a || !b) return null;
  const t = Math.min(1, Math.max(0, particle.location.progress));
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
```

- [ ] **Step 15.2: Commit Tasks 14 + 15 together**

```bash
git add src/components/canvas/FlowCanvas.tsx src/components/canvas/ParticleLayer.tsx
git commit -m "feat(ui): React Flow canvas with particle overlay"
```

---

## Task 16: Toolbar with play/pause/reset/seed

**Files:**
- Create: `src/components/toolbar/Toolbar.tsx`

- [ ] **Step 16.1: Build the Toolbar**

```bash
mkdir -p src/components/toolbar
```

Write to `src/components/toolbar/Toolbar.tsx`:

```tsx
import { useEngineStore } from "@/store/engineStore";

export function Toolbar() {
  const isRunning = useEngineStore((s) => s.isRunning);
  const seed = useEngineStore((s) => s.seed);
  const play = useEngineStore((s) => s.play);
  const pause = useEngineStore((s) => s.pause);
  const reset = useEngineStore((s) => s.reset);
  const setSeed = useEngineStore((s) => s.setSeed);
  const tickCount = useEngineStore((s) => s.tickCount);
  const engine = useEngineStore((s) => s.engine);

  const counters = engine?.state.counters ?? { emitted: 0, completed: 0, failed: 0 };
  const inFlight = engine?.state.particles.length ?? 0;

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        padding: "8px 12px",
        background: "var(--bg-elev)",
        borderTop: "1px solid var(--border)",
        fontSize: 12,
      }}
    >
      <button
        onClick={() => (isRunning ? pause() : play())}
        style={btnStyle(isRunning ? "var(--warn)" : "var(--accent)")}
      >
        {isRunning ? "⏸ Pause" : "▶ Play"}
      </button>
      <button onClick={reset} style={btnStyle("var(--border)")}>⟲ Reset</button>
      <label style={{ color: "var(--text-dim)" }}>
        seed:&nbsp;
        <input
          type="number"
          value={seed}
          onChange={(e) => setSeed(Number(e.target.value))}
          style={{
            width: 80,
            background: "var(--panel)",
            border: "1px solid var(--border)",
            color: "var(--text)",
            padding: "2px 6px",
            borderRadius: 4,
          }}
        />
      </label>
      <div style={{ marginLeft: "auto", color: "var(--text-dim)", fontFamily: "ui-monospace, monospace" }}>
        ticks: {tickCount} · in-flight: {inFlight} · emitted: {counters.emitted} · ok:{" "}
        {counters.completed} · err: {counters.failed}
      </div>
    </div>
  );
}

function btnStyle(color: string): React.CSSProperties {
  return {
    padding: "4px 10px",
    background: "var(--panel)",
    color: "var(--text)",
    border: `1px solid ${color}`,
    borderRadius: 4,
  };
}
```

- [ ] **Step 16.2: Commit**

```bash
git add src/components/toolbar
git commit -m "feat(ui): toolbar with play/pause/reset/seed"
```

---

## Task 17: 3-pane Layout shell

**Files:**
- Create: `src/components/Layout.tsx`

- [ ] **Step 17.1: Build the Layout**

Write to `src/components/Layout.tsx`:

```tsx
import { ReactNode } from "react";

export function Layout({
  left,
  center,
  right,
  bottom,
}: {
  left: ReactNode;
  center: ReactNode;
  right: ReactNode;
  bottom: ReactNode;
}) {
  return (
    <div style={{ display: "grid", gridTemplateRows: "1fr auto", height: "100vh" }}>
      <div style={{ display: "grid", gridTemplateColumns: "170px 1fr 240px" }}>
        <aside style={paneStyle("right")}>{left}</aside>
        <main style={{ overflow: "hidden" }}>{center}</main>
        <aside style={paneStyle("left")}>{right}</aside>
      </div>
      {bottom}
    </div>
  );
}

function paneStyle(borderSide: "left" | "right"): React.CSSProperties {
  return {
    background: "var(--bg-elev)",
    [`border${borderSide === "right" ? "Right" : "Left"}`]: "1px solid var(--border)",
    padding: 12,
    overflowY: "auto",
    fontSize: 12,
  } as React.CSSProperties;
}
```

- [ ] **Step 17.2: Commit**

```bash
git add src/components/Layout.tsx
git commit -m "feat(ui): 3-pane layout shell"
```

---

## Task 18: Wire it all together in App.tsx + main.tsx

**Files:**
- Create: `src/App.tsx`
- Create: `src/main.tsx`

The Foundation app loads `foundation-demo.archflow.yaml` at startup, displays it on the canvas, and lets the user click Play to see the bolinhas flow.

- [ ] **Step 18.1: Create `App.tsx`**

Write to `src/App.tsx`:

```tsx
import { useEffect } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { Layout } from "./components/Layout";
import { FlowCanvas } from "./components/canvas/FlowCanvas";
import { Toolbar } from "./components/toolbar/Toolbar";
import { useEngineStore } from "./store/engineStore";
import { parseDiagram } from "./lib/yaml";
import demoYaml from "./examples/foundation-demo.archflow.yaml?raw";

export default function App() {
  const loadDiagram = useEngineStore((s) => s.loadDiagram);

  useEffect(() => {
    loadDiagram(parseDiagram(demoYaml));
  }, [loadDiagram]);

  return (
    <ReactFlowProvider>
      <Layout
        left={<PaletteStub />}
        center={<FlowCanvas />}
        right={<InspectorStub />}
        bottom={<Toolbar />}
      />
    </ReactFlowProvider>
  );
}

function PaletteStub() {
  return (
    <>
      <div style={{ textTransform: "uppercase", color: "var(--text-dim)", fontSize: 11 }}>
        Palette
      </div>
      <p style={{ color: "var(--text-dim)" }}>Palette comes in Plan 2.</p>
    </>
  );
}

function InspectorStub() {
  return (
    <>
      <div style={{ textTransform: "uppercase", color: "var(--text-dim)", fontSize: 11 }}>
        Inspector
      </div>
      <p style={{ color: "var(--text-dim)" }}>Inspector comes in Plan 2.</p>
    </>
  );
}
```

- [ ] **Step 18.2: Create `main.tsx`**

Write to `src/main.tsx`:

```tsx
import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./styles/globals.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
```

- [ ] **Step 18.3: Add Vite raw-import type declaration**

Vite already supports `?raw` imports but TS needs a declaration.

```bash
mkdir -p src/types
```

Write to `src/types/yaml-raw.d.ts`:

```ts
declare module "*.archflow.yaml?raw" {
  const content: string;
  export default content;
}
```

- [ ] **Step 18.4: Verify type-check**

Run: `npx tsc -p tsconfig.json --noEmit`
Expected: exits 0.

- [ ] **Step 18.5: Verify the dev server boots**

Run: `npm run dev`
Expected: Vite starts on http://localhost:5173 (or next free port). Open in a browser — you should see the 3-pane layout with the demo diagram, two nodes, an edge, and a toolbar at the bottom. Click ▶ Play and bolinhas verdes should travel from Client to Service.

Stop with Ctrl-C once verified.

- [ ] **Step 18.6: Commit**

```bash
git add src/App.tsx src/main.tsx src/types/yaml-raw.d.ts
git commit -m "feat(ui): wire Layout + Canvas + Toolbar + demo YAML"
```

---

## Task 19: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

- [ ] **Step 19.1: Create the CI workflow**

```bash
mkdir -p .github/workflows
```

Write to `.github/workflows/ci.yml`:

```yaml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: "npm"
      - run: npm ci
      - run: npm run lint
      - run: npx tsc -p tsconfig.json --noEmit
      - run: npm test
      - run: npm run build
```

- [ ] **Step 19.2: Commit**

```bash
git add .github/workflows/ci.yml
git commit -m "ci: lint, typecheck, test, build on push and PR"
```

---

## Task 20: Minimal README and LICENSE placeholders

**Files:**
- Create: `README.md`
- Create: `LICENSE`

- [ ] **Step 20.1: Create README placeholder**

Write to `README.md`:

```markdown
# archflow

> Open-source interactive architecture diagrams with simulated request flows.

**Status:** Foundation slice (Plan 1). The full app, docs, and live demo land in Plan 5.

## Run locally

```bash
npm install
npm run dev
```

Open the printed URL, click ▶ Play, watch the bolinhas flow.

## Test

```bash
npm test
```

## License

MIT — see `LICENSE`.
```

- [ ] **Step 20.2: Create LICENSE (MIT)**

Write to `LICENSE`:

```
MIT License

Copyright (c) 2026 archflow contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

- [ ] **Step 20.3: Commit**

```bash
git add README.md LICENSE
git commit -m "docs: minimal README and MIT LICENSE"
```

---

## Task 21: Final verification

- [ ] **Step 21.1: Run the full local pipeline**

```bash
npm run lint && npx tsc -p tsconfig.json --noEmit && npm test && npm run build
```
Expected: every command exits 0. Build artifacts land in `dist/`.

- [ ] **Step 21.2: Manual smoke test**

Run: `npm run preview`
Open the printed URL in a browser. Confirm:
1. Two nodes (Client, Service) and an edge are visible.
2. Clicking ▶ Play makes green bolinhas appear at the Client and travel along the edge.
3. After ~150 ms each particle reaches the Service, processes ~50 ms, then disappears.
4. The toolbar counters increment: emitted goes up steadily, completed follows.
5. Clicking ⟲ Reset returns counters to zero.

Stop with Ctrl-C once verified.

- [ ] **Step 21.3: Push to GitHub (when remote exists)**

```bash
git remote -v
# If `origin` is configured:
git push -u origin main
```

If no remote yet, skip — Plan 5 covers GitHub Pages publishing.

---

## Definition of Done — Plan 1

Plan 1 is complete when **all** of the following hold:

1. `npm install && npm run dev` starts the app and shows the 3-pane layout with the demo diagram.
2. Clicking ▶ Play animates green bolinhas from Client to Service.
3. ⏸ Pause halts the simulation; ▶ Play resumes from the same state.
4. ⟲ Reset clears particles and counters.
5. Changing the seed (then resetting) yields a deterministic re-run.
6. `npm test` runs every test green (rng, schema, yaml, client, service, integration).
7. `npm run lint`, `npx tsc --noEmit`, and `npm run build` all exit 0.
8. CI workflow file exists and runs the same four checks on push and PR.
9. `src/engine/` imports nothing from `react`, `@xyflow/react`, or `zustand`. Verified with `grep -R "from \"react\"" src/engine` returning nothing.
10. Repository has commits for every task above.
