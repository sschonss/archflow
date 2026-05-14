# archflow

> Declarative interactive architecture diagrams with simulated request flows.

[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](LICENSE)
[![CI](https://img.shields.io/github/actions/workflow/status/<owner>/archflow/ci.yml?branch=master&label=ci)](https://github.com/<owner>/archflow/actions)
[![Pages](https://img.shields.io/badge/pages-live-brightgreen)](https://<owner>.github.io/archflow/)

## Why archflow

Architecture diagrams often freeze before the system does. archflow keeps diagrams executable by pairing declarative YAML with simulated traffic, queues, databases, caches, failures, and autoscaling. Teams can sketch a system, run scenarios, and see where latency, saturation, and error pressure appear before building the real thing.

## Features

- Declarative YAML diagrams.
- Simulated request flows across services and infrastructure.
- 10 node types: `client`, `webhook`, `gateway`, `load_balancer`, `service`, `worker`, `queue`, `cache`, `database`, `cluster`.
- Kubernetes-style HPA scaling.
- Scenarios with weighted routing.
- Live metrics and sparklines.
- Monaco YAML editor.
- Presets saved in localStorage.
- YAML and PNG export.
- Chaos engineering controls.
- Public JSON Schema.
- MCP server for agent integrations.
- LLM-friendly docs via `llms.txt` and prompt templates.

## Demo

Open the e-commerce cookbook example: <https://<owner>.github.io/archflow/?example=01-ecommerce>

![demo](docs/assets/demo.gif)

## Quickstart

```bash
git clone https://github.com/<owner>/archflow.git
cd archflow
npm install
npm run dev
```

Open the local URL printed by Vite.

## Cookbook

- [01 E-commerce](docs/cookbook/01-ecommerce.md)
- [02 Microservices async](docs/cookbook/02-microservices-async.md)
- [03 API gateway](docs/cookbook/03-api-gateway.md)
- [04 Kubernetes autoscaling](docs/cookbook/04-k8s-autoscaling.md)
- [05 Event driven](docs/cookbook/05-event-driven.md)

## Project structure

```text
archflow/
├── src/
│   ├── engine/       # Pure simulation engine
│   ├── components/   # React UI components
│   ├── store/        # App state and actions
│   ├── schema/       # Zod diagram schema and node catalog
│   ├── lib/          # YAML, export, and utility helpers
│   └── examples/     # Demo and cookbook YAML diagrams
├── scripts/          # Schema and LLM artifact generators
└── public/
    └── schema/       # Published JSON Schema
```

## For LLMs

- Discovery file: [public/llms.txt](public/llms.txt)
- Prompt-ready instructions: [docs/llm-prompt.md](docs/llm-prompt.md)
- JSON Schema: <https://example.com/archflow/schema/archflow.schema.json>

## MCP server

An MCP (Model Context Protocol) server is on the roadmap; for now agents can consume `llms.txt`, `llm-prompt.md` and the published JSON Schema directly.

## Development

```bash
npm test
npm run lint
npm run build
npm run schema:gen
npm run llms:gen
```

Use `npx tsc --noEmit` for an explicit typecheck without writing build output.

## Contributing

Fork the repo, create a branch, and keep changes focused. Before opening a PR, run linting, typechecking, and tests (`npm run lint`, `npx tsc --noEmit`, `npm test -- --run`). Describe the scenario your change supports and include screenshots or YAML examples when useful.

## Releasing

Releases are tag-based for now. Update versioned artifacts, run the full verification suite, then create an annotated git tag such as `v0.1.0`; there is no npm publish step yet.

## License

MIT — see [LICENSE](LICENSE).
