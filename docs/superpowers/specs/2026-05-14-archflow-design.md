# archflow — Design Spec

**Date:** 2026-05-14
**Status:** Approved (brainstorming)
**License:** MIT
**Repo name:** `archflow`

## 1. Vision and Principles

archflow is an open-source static SPA that lets users build software architecture diagrams in a hybrid drag-and-drop ↔ YAML editor and watch interactive flow simulations: animated particles ("balls") representing requests traveling through services, gateways, queues, caches, databases, and Kubernetes-like scaling pods, with real-time metrics.

**Audience:** personal study, teaching (talks, courses, blog posts), and the broader open-source dev community.

**Principles:**

- **YAML is the source of truth.** Every diagram serializes to a versionable YAML file; the canvas is just a rendered view of the YAML.
- **Deterministic by default.** Same diagram + same seed = same simulation. Critical for teaching and reproducibility.
- **Zero backend.** Pure browser-side; export/import via files; no accounts.
- **Extensible by presets.** Users save configured variants of built-in components as reusable items in their palette.
- **Pedagogical.** Clear metrics, presentation-friendly UI, easy export to PNG/MP4.
- **LLM-friendly.** First-class machine-readable schema, `llms.txt`, and a copy-paste prompt so any AI agent can author/validate diagrams.

## 2. Built-in Component Catalog (MVP)

Eight component types plus origin/trigger primitives. Each component has configurable properties and a deterministic behavior in the simulation engine.

| Type | Key properties | Behavior |
|---|---|---|
| **Client** | `rps`, `pattern` (constant/burst/ramp), `payload_size` | HTTP-like origin. Generates particles at the configured rate. |
| **External Webhook** | `pattern` (poisson/burst), `mean_interval_s`, `payload_size` | Intermittent external event source (e.g. simulated Stripe webhook). |
| **Load Balancer** | `strategy` (round-robin / least-conn / random), `latency_ms` | Distributes incoming particles across N outgoing edges. |
| **API Gateway** | `latency_ms`, `rate_limit_rps`, `auth_check_ms` | Routes by edge tag/rule; can drop with 429 if over rate limit. |
| **Service** | `replicas`, `latency_ms` (mean ± stddev), `capacity_rps`, `error_rate`, `resources`, `scaling`, `triggers` (optional) | Processes requests; can call other nodes; saturates → 503. Pods can scale via HPA. With `triggers`, can also originate flows on a cron schedule. |
| **Worker / Consumer** | `concurrency`, `processing_time_ms`, `error_rate`, `triggers` (optional) | Consumes from a Queue, processes, may publish to another Queue. With `triggers`, can also originate flows on a cron schedule. |
| **Queue** | `max_depth`, `dlq_enabled` | Accumulates particles; overflow → drop or DLQ. |
| **Cache (Redis)** | `hit_rate`, `latency_ms`, `ttl_s` | Hit responds fast; miss forwards to next node. |
| **Database** | `latency_ms`, `max_connections`, `qps_capacity` | Connection-pool semantics; saturates → wait or timeout. |

### 2.1. Flow Origins (where particles are born)

A particle is created exclusively by a **flow origin**. Every other node propagates an existing particle along its outgoing edges. The MVP supports three origin types:

1. **Client (HTTP)** — synthetic external user. Emits at a configured `rps` with a pattern (`constant`, `burst`, `ramp`).
2. **External Webhook** — intermittent external event source. Emits using a `poisson` or `burst` pattern with `mean_interval_s`.
3. **Cron trigger** — a property added to any **Service** or **Worker**:

   ```yaml
   - type: service
     id: orders-svc
     triggers:
       - id: nightly-report
         cron: "0 2 * * *"       # cron syntax
         payload_size: 1024
   ```

   The host node fires a new particle at each scheduled interval (simulation-time, accelerated by the speed multiplier).

**Workers consuming from a Queue are NOT flow origins** — they continue a flow started by an upstream origin. **Services calling other Services** are also propagators, not origins.

Each particle records its `originNodeId` and `originType` (`http` / `webhook` / `cron`), used for debugging, scenario coloring, and metrics breakdown.

### 2.2. Edges (connections)

- `kind`: `sync` or `async` (Queue inputs require `async`).
- `latency_ms` (optional, network latency).
- `label` (optional, free-form).
- `weight` (optional, default 1; used for probabilistic routing when no scenario is active).
- `tags` (optional, used by named scenarios to pin paths).

### 2.3. Cluster (decorative)

A non-semantic grouping node that visually wraps other nodes and shows a cluster/namespace label. Has no effect on simulation.

### 2.4. User Presets

A user can configure any built-in component and "Save as preset" with a custom name (e.g. `meu-gateway`). The preset appears in the left palette and can be dragged like a built-in. Presets persist in `localStorage` and can be exported/imported as `.preset.yaml` files.

## 3. Simulation Engine

**Model:** tick-based simulation, continuous render.

- `simulationTick` runs at 60 Hz, configurable via speed multiplier (`0.5×`, `1×`, `2×`, `5×`, `10×`).
- Each tick: clients emit particles at their `rps`, in-flight particles advance along edges (proportional to edge `latency_ms`), nodes process arrivals.
- Render: `requestAnimationFrame` interpolates particle positions between ticks for smooth animation on a Canvas 2D overlay.

### 3.1. Particle

```ts
{
  id: string;
  scenarioId: string | null;
  currentEdgeOrNode: NodeId | EdgeId;
  path: NodeId[];          // history (for debugging / visualization)
  birthTime: number;       // ms since simulation start
  latencySoFar: number;    // ms
  status: 'in_flight' | 'processing' | 'queued' | 'failed' | 'completed';
  failureReason?: '429' | '503' | 'timeout' | 'queue_overflow' | 'oom';
}
```

### 3.2. Saturation rules

- **Service / Worker:** in-flight requests > `max_in_flight` → 503; otherwise queued internally and processed FIFO.
- **Queue:** if `depth > max_depth` → drop or DLQ (per `dlq_enabled`).
- **Database:** active connections > `max_connections` → wait up to a timeout, then fail.

### 3.3. Scenarios

- A scenario has a name, an **origin** (a Client, an External Webhook, or a Cron-triggered Service/Worker), and an optional pinned path defined by `scenario:<name>` tags on edges.
- Without an active scenario, traffic from any origin follows outgoing edges probabilistically (by `weight`).
- Multiple scenarios can run simultaneously; each gets a distinct particle color.

```yaml
scenarios:
  - id: criar-pedido
    origin: client-mobile        # Client (http)
  - id: stripe-payment
    origin: webhook-stripe       # External Webhook
  - id: nightly-report
    origin: orders-svc           # Cron trigger inside orders-svc
    trigger_id: nightly-report   # disambiguates if the node has multiple triggers
```

### 3.4. Metrics

Each node and edge exposes a sliding-window (~10 s) view of:

- `rps_in`, `rps_out`
- `latency p50 / p95 / p99` (ms)
- `error_rate` (% of failures)
- `queue_depth` (Queue / internal)
- `throughput_total` (cumulative since start)

Per-Service additional: `cpu_pct`, `memory_pct`, `pods_active`, `pods_starting`, `oom_kills`, `scale_events`.

### 3.5. Determinism

A seeded RNG (`mulberry32`) drives all probabilistic choices (edge selection, error injection, latency jitter, cache hit/miss). Same `(yaml, seed)` always produces the same particle stream and metrics.

### 3.6. Performance target

60 fps with up to ~2,000 simultaneous particles in the Canvas overlay. Above that, render every N frames (degrade gracefully).

## 4. Resources and Kubernetes-like Scaling

Services have an optional resource model that drives the simulated HPA.

```yaml
- type: service
  id: orders-svc
  resources:
    cpu_request: 250m       # millicores
    cpu_limit: 1000m
    memory_request: 256Mi
    memory_limit: 512Mi
  cost_per_request:
    cpu_ms: 30              # CPU consumed per processed request
    memory_kb: 50           # memory held during processing
  scaling:
    enabled: true
    min: 1
    max: 10
    metric: cpu             # cpu | memory | rps
    target_pct: 70
    scale_up_after_s: 5
    scale_down_after_s: 30
```

**Behavior:**

- Each pod tracks `current_cpu_pct` and `current_memory_pct` derived from in-flight requests × per-request cost.
- **CPU throttling:** when usage exceeds `cpu_limit`, request latency is multiplied by a throttle factor.
- **OOM kill:** when memory exceeds `memory_limit`, the pod dies (visual flash → fade), HPA spawns a replacement.
- **HPA loop:** runs every 15 s (configurable), averages utilization across active pods, scales between `min` and `max`, respecting cooldowns.
- **Pod warm-up:** newly started pods are not added to the load-balancer rotation for `startup_delay_s` (configurable, default 3 s).

**Visual:**

- The Service node is a container; pods are small circles inside, each with two micro-bars (CPU blue, RAM purple).
- Saturating pod turns red.
- HPA scale-up: new pod "pops" in. Scale-down: pod fades out. OOM kill: 💥 burst then disappear.
- Service HUD shows `pods: 4/10 · cpu: 67% · mem: 42%`.

**Inspector → Resources tab:** uPlot line chart of cluster-wide CPU/memory over time + a scale-event log (`scaled up to 5 (cpu 78% > 70%)`).

## 5. UI Layout

Three-pane layout, all on one screen:

- **Left (170 px):** component palette (built-ins on top, user presets below) + scenarios list.
- **Center:** React Flow canvas with a Canvas 2D overlay for particles. Dotted background grid. HUD pill (bottom-right) showing simulation status, total in-flight, current global RPS.
- **Right (240 px):** contextual inspector with tabs `Inspect` / `YAML` / `Metrics` / `Resources` (Resources only shown for Service).
- **Bottom toolbar:** play / pause / stop, speed selector, load preset (constant / burst / ramp), chaos buttons (kill node, delay edge), seed input, export menu (YAML / PNG / MP4 v0.2).

Dark theme by default (presentation-friendly). Light theme is post-MVP.

## 6. Tech Stack

- **React 18** + **TypeScript** + **Vite** (static SPA, deployed to GitHub Pages).
- **React Flow (xyflow)** for nodes, edges, pan/zoom, drag-drop.
- **Custom Canvas 2D overlay** for particles, viewport-synced with React Flow. (PixiJS deferred to v2 if needed.)
- **Zustand** for global state (diagram, simulation, presets, UI).
- **eemeli/yaml** for parse/stringify.
- **Monaco Editor** (lazy-loaded) for the YAML tab, with JSON Schema autocomplete.
- **uPlot** for charts (latency, throughput, CPU, memory).
- **Framer Motion** for UI transitions (not particles).
- **Zod** for schemas → single source of truth for TS types and emitted JSON Schema.
- **Vitest** for unit tests (heavy focus on `engine/`).
- **Playwright** for e2e smoke tests.
- **ESLint + Prettier** with strict config.
- **GitHub Actions** CI: lint + typecheck + test + build + Pages deploy on `main`.

## 7. Folder Structure

```
archflow/
├── src/
│   ├── engine/            # pure TS, no React
│   │   ├── tick.ts        # main loop
│   │   ├── particle.ts
│   │   ├── nodes/         # behavior per type (service, queue, cache, ...)
│   │   ├── scheduler.ts   # HPA, scaling
│   │   ├── metrics.ts     # sliding window, percentiles
│   │   └── rng.ts         # mulberry32 seeded
│   ├── schema/            # Zod schemas + TS types + JSON Schema emit
│   │   ├── component.ts
│   │   ├── diagram.ts
│   │   └── preset.ts
│   ├── components/        # React UI
│   │   ├── canvas/        # React Flow + ParticleLayer (Canvas 2D)
│   │   ├── palette/
│   │   ├── inspector/
│   │   ├── scenarios/
│   │   ├── toolbar/
│   │   └── yaml-editor/
│   ├── store/             # Zustand slices
│   ├── presets/           # built-in presets (.yaml)
│   ├── examples/          # cookbook diagrams (.yaml)
│   ├── lib/               # utils
│   └── App.tsx
├── public/
│   ├── llms.txt
│   ├── llms-full.txt
│   └── schema/
│       ├── diagram.schema.json
│       └── components.json
├── tests/
├── docs/
│   ├── getting-started.md
│   ├── components.md         # auto-generated from schema
│   ├── yaml-format.md
│   ├── scenarios.md
│   ├── llm-prompt.md
│   ├── contributing.md
│   └── cookbook/
│       ├── microservices.archflow.yaml
│       ├── event-driven.archflow.yaml
│       ├── cqrs.archflow.yaml
│       ├── cache-aside.archflow.yaml
│       └── k8s-autoscaling.archflow.yaml
├── README.md
├── LICENSE                   # MIT
└── .github/workflows/
```

**Critical separation:** `src/engine/` is pure TypeScript with no React imports. It receives diagram state and returns particle/metric state. This makes it testable in isolation and reusable for the future CLI and MCP server.

**Web Worker:** deferred to v1.1. MVP runs the engine on the main thread for simplicity.

## 8. Documentation

### 8.1. For humans

- `README.md` — short pitch, demo gif, 3-step quickstart, link to live app.
- `docs/getting-started.md` — build your first diagram in 5 minutes.
- `docs/components.md` — full reference per component type, auto-generated from the JSON Schema.
- `docs/yaml-format.md` — complete spec of the YAML format with examples.
- `docs/scenarios.md` — modeling named flows.
- `docs/cookbook/` — 5 ready-made example diagrams covering classic microservices, event-driven, CQRS / saga, cache-aside, and k8s autoscaling.
- `docs/contributing.md` — how to add a new component type, run tests, file issues.

### 8.2. For LLMs (first-class)

- `/llms.txt` (per llmstxt.org) — navigable index of the documentation, served at the SPA root.
- `/llms-full.txt` — concatenated full docs (single fetch = full context).
- `/schema/diagram.schema.json` — public JSON Schema, derived from Zod. Any LLM with a validation tool can check structural errors.
- `/schema/components.json` — machine-readable catalog of every component type with properties, defaults, valid ranges, and one-line descriptions.
- `docs/llm-prompt.md` — ready-to-paste system prompt: "You are creating archflow diagrams. Here is the schema, here are examples, validation rules…".
- Examples use the `.archflow.yaml` extension with a commented header explaining the scenario (LLMs read these comments as context).

### 8.3. Anti-drift guarantee

The JSON Schema, the components reference doc, and the TypeScript types are all generated from a single source (the Zod schemas). CI fails if they drift apart.

## 9. MCP Server and CLI (post-MVP)

Both ship from the same repo, reusing the pure `engine/` package.

**`archflow-mcp` (v1.1, opt-in):**

MCP server exposing tools to any compatible AI agent:

- `validate_diagram(yaml)` → schema errors.
- `render_preview(yaml)` → PNG of the diagram.
- `simulate(yaml, duration_s, seed)` → headless run, returns metrics JSON.
- `list_components()` / `describe_component(type)` → metadata.

**CLI (v1.1):**

- `npx archflow validate file.yaml`
- `npx archflow render file.yaml -o diagram.png`
- `npx archflow simulate file.yaml --duration 60s --seed 42 --json`

## 10. MVP Scope (v0.1) — Definition of Done

The MVP ships when all of the following are true:

1. Canvas with React Flow: drag, drop, connect; pan/zoom; delete.
2. All 9 built-in components implemented (Client, External Webhook, Load Balancer, API Gateway, Service, Worker, Queue, Cache, Database) with their properties and simulated behavior, plus the Cron-trigger property on Service and Worker.
3. Cluster decorative grouping.
4. Inspector with `Inspect`, `YAML`, `Metrics`, and `Resources` (Service-only) tabs.
5. Monaco YAML editor with bidirectional sync to the canvas and JSON Schema autocomplete.
6. Engine: tick-based simulation, particle rendering on Canvas 2D, named scenarios with distinct colors.
7. Metrics: sliding window for rps, p50/p95/p99 latency, error rate, queue depth, CPU/mem.
8. Simulated HPA driven by CPU / memory / RPS targets.
9. Toolbar: play/pause/stop, speed (`0.5×` … `10×`), seed, load preset (constant / burst / ramp), chaos buttons (kill node, delay edge).
10. User presets: save / load / export / import via localStorage and `.preset.yaml`.
11. Export: YAML and PNG.
12. Cookbook with at least 5 example diagrams.
13. `llms.txt`, `llms-full.txt`, `schema/diagram.schema.json`, `schema/components.json`, `docs/llm-prompt.md` all present and validated in CI.
14. Deployed to GitHub Pages with a public live URL linked from the README.
15. CI green: lint, typecheck, unit tests (engine ≥ 80% coverage), e2e smoke test.
16. MIT license.

## 11. Roadmap (post-MVP)

**v0.2:**

- Chaos toolkit: kill node, delay edge, partition network.
- Export MP4 / GIF of the simulation.
- Share via URL (state serialized in the URL hash).
- More components: Pub/Sub topic, CDN, External API, Object Storage (S3-like).

**v1.0:**

- `archflow-mcp` MCP server.
- Headless CLI (`validate` / `render` / `simulate`).
- Web Worker for the engine.
- Composite components.

**v1.1+:**

- Rule scripting (mini-DSL or JS sandbox for routing rules).
- Light theme.
- i18n (pt-BR, en).
- Plugin system for external component packages.
- Importers: docker-compose, k8s manifests as starter diagrams.

## 12. Non-Goals (Permanent Out of Scope)

- Real-time multiplayer collaboration.
- Accounts, login, cloud storage.
- Replacing real monitoring tools (Grafana, Datadog, etc.).
- Generating production code from diagrams.
