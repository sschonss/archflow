# archflow Plan 4 — Editor Monaco · Presets · Export · Chaos

## Problem

Hoje só dá pra trocar entre exemplos via dropdown. Pra ser uma ferramenta de
verdade pra arquitetos brincarem, precisamos:

1. **Editor YAML embutido** (Monaco) com validação ao vivo, bidirecional com o
   diagrama (editar texto → diagrama atualiza; mover nó no canvas → texto
   atualiza).
2. **Presets persistentes** em `localStorage` (salvar/abrir/duplicar/excluir
   diagramas do usuário).
3. **Export** YAML (download `.yaml`) e PNG (snapshot do canvas via
   `html-to-image`).
4. **Chaos buttons**: injetar falhas em runtime (kill node, slow node, drop
   x% das requests) sem recarregar o YAML.

## Approach

- Adicionar painel de editor Monaco abaixo (ou alternável com) o canvas. 
  Toolbar ganha botão **"Editor"** que toggla view: canvas-only ↔ split
  (canvas + monaco) ↔ editor-only.
- Bidirecional com debounce: parse com `parseDiagram()`, se válido aplica
  via `loadDiagram()`. Erros do Zod aparecem inline (linha 1 fallback).
  Drag de nó no canvas atualiza `diagram.nodes[i].position` no store e
  re-serializa via `stringifyDiagram()`.
- Presets: `localStorage["archflow.presets"] = { [name]: yamlText }`. 
  PaletteStub vira `LeftPanel` com seções: Examples, My Presets, Save Current.
- Export: `yaml` botão chama `stringifyDiagram(diagram)` + Blob download.
  `png` botão usa `html-to-image.toPng(reactFlowWrapper)` + download.
- Chaos: novos métodos no store: `chaosKillNode(id)`, `chaosSlowNode(id, factor)`,
  `chaosDropRequests(id, fraction)`. Aplicam mutações no `EngineState`
  (e.g., set `runtime.failureRate`, multiply `latency`). Botões aparecem no
  Inspector quando um nó está selecionado.

## Constraints

- Engine permanece pura: chaos é mutação na runtime feita pelo store, não nova
  feature de engine.
- Monaco lazy-loaded (dynamic import + Suspense) pra não inflar o bundle inicial.
- Persistência só usa `localStorage` — sem backend.
- Field names: `type`/`label` (NÃO `kind`/`name`).
- Engine purity: nada de react/zustand/@xyflow/uplot/monaco em `src/engine/**`.

## Tasks

### T1 — Yaml round-trip helper (TDD)

**File:** `tests/lib/yaml.roundtrip.test.ts` (novo) e ajustes em `src/lib/yaml.ts`

- Confirmar que `parseDiagram(stringifyDiagram(d))` é `deepEqual` a `d`
  para todos os 3 exemplos (foundation, ecommerce, scaling).
- Garantir ordem estável de chaves em `stringify` (já usa `lineWidth: 0`;
  adicionar `sortMapEntries: false` se necessário).

**Commit:** `test(yaml): bidirectional round-trip preserves diagram`

### T2 — Store: setDiagramFromYaml + updateNodePosition

**Files:** `src/store/engineStore.ts`, `tests/store/yaml-actions.test.ts`

- `setDiagramFromYaml(text: string): { ok: true } | { ok: false; error: string }`:
  parse com try/catch (Zod errors → mensagem amigável). Se ok, chama
  `loadDiagram(diagram)` mantendo seed atual.
- `updateNodePosition(id, position)`: muta `diagram.nodes[i].position` e
  re-cria engine (evita drift). Atualiza `diagram` no estado.
- Ações chaos (esqueleto, comportamento real T6):
  `chaosKillNode(id)`, `chaosSlowNode(id, factor=2)`, `chaosDropRequests(id, fraction=0.5)`,
  `chaosClear(id?)`.
- Testes: parse inválido retorna `{ok:false}` sem quebrar engine.

**Commit:** `feat(store): yaml actions + chaos hooks`

### T3 — Monaco editor component (lazy)

**Files:** `src/components/editor/YamlEditor.tsx` (novo), `package.json`

- `npm i @monaco-editor/react monaco-editor`
- Componente `<YamlEditor value onChange height />` usando `<Editor language="yaml" theme="vs-dark" />`.
- Debounce 300ms via `useEffect` + `setTimeout`.
- Callback `onChange(text)` chama `setDiagramFromYaml(text)`. Se `ok===false`,
  mostra banner de erro vermelho no rodapé do editor (não quebra a app).
- Lazy: `const YamlEditor = lazy(() => import('./editor/YamlEditor'))` no caller.

**Commit:** `feat(ui): monaco yaml editor (lazy-loaded)`

### T4 — Layout: split view com toggle

**Files:** `src/App.tsx`, `src/components/Layout.tsx` (se necessário)

- Toolbar ganha botão "Editor" cycle: `canvas` → `split` → `editor` → `canvas`.
- Em `split`, canvas ocupa 60% width, editor 40%. Em `editor`, canvas escondido.
- Estado `viewMode` no store ou em `App` (preferir `App` pra não inflar store).
- Persistir `viewMode` em `localStorage["archflow.viewMode"]`.

**Commit:** `feat(ui): split view canvas + editor`

### T5 — Bidirecional: drag → yaml

**Files:** `src/components/canvas/FlowCanvas.tsx`

- Usar `onNodeDragStop` do React Flow → chama `updateNodePosition(id, {x, y})`.
- Após update, App re-deriva texto do editor via `stringifyDiagram(diagram)`
  (passar `value={stringifyDiagram(diagram)}` pro `<YamlEditor>` quando
  `viewMode !== 'canvas'`).
- Cuidado com loop: editor onChange dispara parse → loadDiagram → render →
  passa novo string → editor compara. Memoizar com `useMemo` keyed em
  `diagram` (referência muda só em mutations reais).

**Commit:** `feat(canvas): drag updates yaml round-trip`

### T6 — Chaos engine semantics

**Files:** `src/engine/types.ts`, `src/engine/tick.ts`, `tests/engine/chaos.test.ts`

- Adicionar a `NodeRuntime`: `chaos?: { killed?: boolean; slow_factor?: number; drop_fraction?: number }`.
- Em `tick.ts`, antes de processar cada nó:
  - Se `chaos.killed` → drop todas as in-flight desse nó com `reason='unavailable'` e não roteia novas.
  - Se `chaos.slow_factor` → multiplica latência por esse fator.
  - Se `chaos.drop_fraction` → `Math.random() < drop_fraction` → drop com `reason='dropped'`.
- Adicionar `'unavailable'` e `'dropped'` ao union `FailureReason` se ainda não existem.
- Store `chaosKillNode` etc. mutam `engine.state.nodes[id].chaos = ...`.
- Teste de integração: kill node → counters.failed sobe; slow node → latência média sobe.

**Commit:** `feat(engine): chaos semantics (kill/slow/drop)`

### T7 — Inspector: chaos buttons

**Files:** `src/components/Inspector.tsx`

- Quando nó selecionado for `service`/`worker`/`gateway`/`database`/`cache`/`queue`,
  mostrar bloco "Chaos" com 4 botões: Kill, Slow x2, Drop 50%, Clear.
- Indicador visual quando chaos ativo (badge vermelho/amarelo no card).
- Botões disabled quando `chaos` daquele tipo já ativo (toggle).

**Commit:** `feat(ui): chaos controls in inspector`

### T8 — Presets persistentes

**Files:** `src/lib/presets.ts` (novo), `src/components/presets/PresetsPanel.tsx` (novo), `src/App.tsx`

- `presets.ts`: `listPresets() → {name, yaml}[]`, `savePreset(name, yaml)`,
  `deletePreset(name)`, `getPreset(name)`. Storage key: `archflow.presets`.
  JSON object `{ [name]: string }`. Validar nome (slug, max 40 chars).
- `PresetsPanel`: lista de presets + botão "Save current as…" (prompt nome) +
  botão "Delete" por item. Click no preset → carrega no editor/canvas.
- App: substituir `PaletteStub` por `LeftPanel` com seções:
  - Examples (foundation/ecommerce/scaling)
  - My Presets (dinâmico)
  - Save Current
- Teste unitário do `presets.ts` (mock localStorage).

**Commit:** `feat(presets): localStorage save/load/delete`

### T9 — Export YAML + PNG

**Files:** `src/lib/export.ts` (novo), `src/components/toolbar/Toolbar.tsx`, `package.json`

- `npm i html-to-image`
- `exportYaml(diagram)`: chama `stringifyDiagram(diagram)`, cria Blob `application/x-yaml`,
  trigger download `archflow-{timestamp}.yaml`.
- `exportPng(canvasEl)`: `htmlToImage.toPng(el, { pixelRatio: 2 })` → download
  `archflow-{timestamp}.png`. CanvasEl = `document.querySelector('.react-flow__viewport')` ou ref.
- Toolbar ganha botões "↓ YAML" e "↓ PNG".
- Teste: `exportYaml` retorna string serializada esperada (sem testar o download em si).

**Commit:** `feat(toolbar): export yaml + png`

### T10 — Final verify + tag

- `npm run lint` exit 0
- `npx tsc -p tsconfig.json --noEmit` exit 0
- `npm test` all green
- `npm run build` succeeds (ok se warning de chunk; documentar)
- Engine purity: `grep -RnE "from ['\"](@xyflow|react|zustand|uplot|monaco|@monaco-editor)" src/engine` empty
- Manual smoke (descrever no commit msg): edit yaml → canvas atualiza; drag node → yaml atualiza; save preset → reload page → preset persiste; export YAML/PNG; chaos kill node → particles param.
- Tag: `git tag archflow-plan-4 -m "archflow Plan 4: Editor + Presets + Export + Chaos shipped"`

**Commit:** `chore: archflow Plan 4 verified`

## Notes

- Monaco vai dobrar tamanho do bundle inicial se importado eager. Usar `lazy()` + `Suspense fallback={<div>Loading editor…</div>}`. Code-splitting esperado: chunk principal fica ~600 kB, monaco em chunk separado ~3 MB (carregado só ao abrir editor).
- `html-to-image` ~30 kB, ok pra eager.
- Ordem das chaves do YAML (legibilidade): aceitar a ordem nativa do `yaml` package; não tentamos formatar manualmente.
- Chaos é mutação direta na runtime; é por design "imperdoável" do ponto de vista de engine puridade — mas o store é quem aplica, então engine continua pura.
