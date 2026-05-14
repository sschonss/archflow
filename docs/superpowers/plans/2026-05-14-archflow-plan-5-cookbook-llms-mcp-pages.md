# archflow Plan 5 — Cookbook · JSON Schema · LLMs · README · MCP · GH Pages

## Problem

archflow já roda local, mas para virar um projeto open-source consumível por
humanos e por IAs precisamos:

1. **Cookbook** com 5 exemplos completos cobrindo padrões comuns (e-commerce
   completo, microsserviços com queue/worker, API gateway com rate-limit,
   k8s autoscaling, event-driven com webhook+queue+cache).
2. **JSON Schema público** gerado a partir do Zod schema, hospedado em URL
   estável, referenciável via `$schema` no YAML.
3. **llms.txt** + **llms-full.txt** + **llm-prompt.md** seguindo a convenção
   `/llms.txt` para que IAs descubram a documentação rapidamente e gerem
   diagramas válidos.
4. **README completo** com badges, features, screenshots/gif, quickstart,
   estrutura do projeto, contribuição, licença.
5. **MCP server** (Model Context Protocol) que expõe ferramentas para
   IAs criarem/validarem/explicarem diagramas archflow programaticamente.
6. **GH Pages deploy** via GitHub Actions, com workflow de release e o
   JSON Schema servido junto.

## Approach

- Todos os artefatos vivem no repo:
  - `examples/` (raiz) com os 5 cookbook YAMLs (movidos/duplicados de
    `src/examples/`; manter `src/examples/` como cópia importada via Vite,
    ou apontar Vite pra `../examples/` — escolher a opção mais simples:
    deixar `src/examples/` com os arquivos canônicos e symlinkar/copiar pro
    `examples/` na raiz).
  - `public/schema/archflow.schema.json` gerado via `zod-to-json-schema`
    no script `npm run schema:gen`.
  - `public/llms.txt`, `public/llms-full.txt`, `docs/llm-prompt.md`.
  - `mcp-server/` com servidor MCP standalone (npm publishable depois).
  - `.github/workflows/deploy.yml` para build + deploy GH Pages.
- README reescrito do zero.

## Constraints

- Engine continua puro (não importa nada de mcp/zod-to-json-schema dentro de `src/engine`).
- MCP server é projeto separado dentro do mesmo repo (workspace ou subpasta com
  seu próprio package.json) para não inflar o bundle do app.
- GH Pages publica `dist/` + `public/` (Vite já copia `public/` pra raiz).
- Mantém field names `type`/`label` (NÃO `kind`/`name`).
- Não introduz dependências pesadas no app principal: gerador de schema
  e MCP server vivem em devDeps ou subpacote.

## Tasks

### T1 — JSON Schema gerado

**Files:** `scripts/gen-schema.ts` (novo), `public/schema/archflow.schema.json` (gerado, commitado), `package.json`

- `npm i -D zod-to-json-schema`
- `scripts/gen-schema.ts`: importa `DiagramSchema` de `src/schema`, chama
  `zodToJsonSchema(DiagramSchema, 'archflow')`, escreve `public/schema/archflow.schema.json`
  com `$id: "https://<owner>.github.io/archflow/schema/archflow.schema.json"`
  e `$schema: "http://json-schema.org/draft-07/schema#"`.
- `package.json` script: `"schema:gen": "tsx scripts/gen-schema.ts"`. Add `tsx` devDep se não houver.
- Commit o `archflow.schema.json` no repo (artefato versionado).
- Atualizar `src/lib/yaml.ts` para aceitar campo opcional `$schema` (no Zod, marcar `passthrough()` no DiagramSchema OU adicionar `.optional()` para `$schema`). Revisitar para não quebrar o round-trip.
- Test `tests/schema/jsonschema.test.ts`: gera o schema e valida contra ajv que cada exemplo do cookbook conforma.

**Commit:** `feat(schema): public JSON Schema generated from zod`

### T2 — Cookbook: 5 exemplos canônicos

**Files:** `src/examples/*.yaml` (cinco arquivos), `docs/cookbook/*.md` (cinco páginas)

Os 5 exemplos:

1. **`01-ecommerce.yaml`** — variação rica do exemplo atual (catálogo, carrinho, pagamento, fulfillment via queue+worker, cache de produtos, db).
2. **`02-microservices-async.yaml`** — produtor → fila → worker pool → db; ilustra backpressure.
3. **`03-api-gateway.yaml`** — gateway com rate-limit + JWT + LB → 3 serviços downstream + cache compartilhado.
4. **`04-k8s-autoscaling.yaml`** — service com HPA min=1 max=10, target_cpu=60, dentro de cluster; client com burst.
5. **`05-event-driven.yaml`** — webhook → queue → fan-out para worker + database + cache invalidation; demonstra cron trigger.

Para cada exemplo: arquivo YAML com `$schema: "https://<owner>.github.io/archflow/schema/archflow.schema.json"` no topo + `docs/cookbook/0N-name.md` com:
- Diagrama ASCII curto.
- Explicação do que cada nó representa.
- Cenários incluídos (e o que acontece quando rodar).
- Link para abrir no app (`?example=01-ecommerce`).

App `src/App.tsx` atualizado com seleção dos 5 exemplos no dropdown (substitui foundation/ecommerce/scaling, OU mantém + 5 cookbook). Recomendo: dropdown com TODOS os 8 (3 demos + 5 cookbook).

**Commit:** `feat(cookbook): 5 canonical examples + docs`

### T3 — `?example=` query param

**Files:** `src/App.tsx`

- Ler `new URLSearchParams(window.location.search).get('example')` na inicialização.
- Se válido, definir como exemplo inicial. Atualizar URL (replaceState) ao trocar.
- Permite linkar diretamente: `https://...?example=03-api-gateway`.

**Commit:** `feat(app): example query param`

### T4 — `llms.txt` + `llms-full.txt` + `llm-prompt.md`

**Files:** `public/llms.txt`, `public/llms-full.txt`, `docs/llm-prompt.md`

Seguir spec https://llmstxt.org:

**`public/llms.txt`** — markdown curto:
```
# archflow

> Interactive architecture diagrams with simulated request flows.

archflow is an open-source SPA where users design system architecture
(services, gateways, queues, caches, DBs, workers) in YAML and watch
simulated requests flow through the components in real time, with metrics
and Kubernetes-style HPA scaling.

## Docs
- [README](https://github.com/<owner>/archflow#readme)
- [Cookbook](https://github.com/<owner>/archflow/tree/master/docs/cookbook)
- [JSON Schema](https://<owner>.github.io/archflow/schema/archflow.schema.json)
- [LLM prompt](https://github.com/<owner>/archflow/blob/master/docs/llm-prompt.md)

## Examples
- [01 e-commerce](https://github.com/<owner>/archflow/blob/master/src/examples/01-ecommerce.yaml)
- [02 microservices async](...)
- [03 api gateway](...)
- [04 k8s autoscaling](...)
- [05 event driven](...)

## Optional
- [llms-full.txt](https://<owner>.github.io/archflow/llms-full.txt)
```

**`public/llms-full.txt`** — concat de:
- README
- Schema descrição compacta (lista de tipos de nós + campos principais)
- 5 exemplos completos com YAML inline
- Cookbook docs

Gerar via script `scripts/gen-llms-full.ts` (concatena arquivos em ordem). Re-roda no build.

**`docs/llm-prompt.md`** — prompt pronto pra colar em LLM:
- Explica o que é archflow.
- Lista node types (`type` discriminator) com campos exigidos.
- Mostra mini-exemplo de YAML válido.
- Pede ao LLM gerar YAML válido para um sistema descrito pelo usuário.
- Aviso: validar com JSON Schema antes de usar.

**Commit:** `docs(llm): llms.txt + llm-prompt + generator`

### T5 — README completo

**Files:** `README.md`

Substituir README mínimo por completo:
- Header com nome, tagline, badges (license, build status placeholder, npm if applicable)
- "Why archflow" (3 frases)
- Features (lista bullet)
- Demo (link GH Pages + GIF placeholder se não houver)
- Quickstart (clone, install, dev)
- Cookbook (link `docs/cookbook/`)
- Architecture (estrutura de pastas resumida)
- For LLMs (link `llms.txt`, `llm-prompt.md`)
- MCP server (link `mcp-server/README.md`)
- Contributing (PRs welcome, run lint+tsc+test)
- License (MIT)

**Commit:** `docs: comprehensive README`

### T6 — MCP server

**Files:** `mcp-server/package.json`, `mcp-server/src/index.ts`, `mcp-server/README.md`, `mcp-server/tsconfig.json`

- Subpasta `mcp-server/` com seu `package.json` (nome `archflow-mcp`, type module).
- Deps: `@modelcontextprotocol/sdk`, `zod`, `js-yaml` (ou `yaml`), e import direto do schema do app via path relativo `../src/schema`.
- Tools expostas:
  - `validate_diagram(yaml: string)` → retorna `{valid: boolean, errors?: string[]}` (Zod parse).
  - `explain_diagram(yaml: string)` → retorna texto descrevendo nós, edges, fluxos.
  - `list_node_types()` → enum de types + campos requeridos.
  - `example(name: string)` → retorna YAML do cookbook.
  - `simulate_summary(yaml: string, ticks: number)` → roda `createEngine` por N ticks, retorna `counters` finais.
- `mcp-server/README.md` com setup pra Claude Desktop / Cursor / outros clients MCP.
- Sem testes formais por ora (smoke local apenas).
- Não bloqueia o build principal: `mcp-server/` tem `.gitignore` para `node_modules` próprio; `npm install` na raiz não roda no subpacote por padrão.

**Commit:** `feat(mcp): archflow MCP server with validate/explain/example tools`

### T7 — GitHub Actions: deploy GH Pages

**Files:** `.github/workflows/deploy.yml`, `.github/workflows/ci.yml` (se já existir, atualizar)

- `deploy.yml`:
  - `on: push: branches: [master]` + `workflow_dispatch`
  - Steps: checkout → setup-node 20 → `npm ci` → `npm run schema:gen` → `npm run build` → `actions/upload-pages-artifact@v3` → `actions/deploy-pages@v4`
  - Permissions: `pages: write`, `id-token: write`
  - Vite config base: `/archflow/` se URL é `<owner>.github.io/archflow/`. Tornar configurável via env var `VITE_BASE`.
- `ci.yml` (se não existir, criar): `on: push, pull_request` → `npm ci && npm run lint && npx tsc --noEmit && npm test -- --run && npm run build`.

**Commit:** `ci: GitHub Pages deploy + CI workflow`

### T8 — Vite base path + 404 SPA fallback

**Files:** `vite.config.ts`, `public/404.html` (novo)

- `vite.config.ts`: `base: process.env.VITE_BASE ?? '/'`.
- `public/404.html`: copy do `index.html` (truque clássico GH Pages SPA fallback) OU script de redirect com `?p=...`. Mais simples: copy do index.html, dado que app não usa rotas client-side ainda.

**Commit:** `chore(vite): base path + GH Pages SPA fallback`

### T9 — Final verify + tag v0.1.0

- `npm run schema:gen` — escreve `public/schema/archflow.schema.json` válido
- `npm run lint` exit 0
- `npx tsc -p tsconfig.json --noEmit` exit 0
- `npm test -- --run` ≥109 testes passando + novos
- `npm run build` succeeds com `VITE_BASE=/archflow/`
- `mcp-server/`: `cd mcp-server && npm install && npx tsc --noEmit` clean
- Engine purity grep clean (sem mcp/zod-to-json-schema/ajv)
- Bump `package.json` version → `0.1.0`
- Tag: `git tag -a v0.1.0 -m "archflow v0.1.0 — full release (Plans 1-5)"` + `git tag archflow-plan-5 -m "archflow Plan 5: Cookbook + Schema + LLMs + MCP + GH Pages shipped"`

**Commit:** `chore: release v0.1.0`

## Notes

- Owner placeholder: usar `<owner>` nos templates, substituir no commit do README/llms.txt pelo owner real (luizschons? aguardar confirmação ou usar `archflow` org placeholder). Para os links absolutos do JSON Schema `$id`, deixar configurável via env `ARCHFLOW_BASE_URL` no script de geração.
- MCP server compartilha schema via import relativo — assegurar que `mcp-server/tsconfig.json` use `paths` ou referencias o `src/schema/diagram.ts` corretamente (ou copiar o schema com codegen).
- `llms-full.txt` será grande (~50 kB). OK para LLMs; servido como text/plain.
- 7 vulnerabilidades reportadas pelo `npm audit` no Plan 4: rodar `npm audit fix` antes do release; se quebrar, documentar e seguir.
- Decisão: NÃO fazemos publish em npm neste plano (evita surface de manutenção). Documentar como fazer no README "Releasing".
