import { afterEach, describe, expect, it } from "vitest";
import { useEngineStore } from "@/store/engineStore";
import type { Diagram } from "@/schema";

const diagram: Diagram = {
  version: 1,
  nodes: [
    { type: "client", id: "c", label: "Client", rps: 1, pattern: "constant", payload_size: 0 },
    { type: "service", id: "s", label: "Service", latency_ms: 10, capacity_rps: 1000, error_rate: 0 },
  ],
  edges: [{ id: "cs", source: "c", target: "s", kind: "sync", latency_ms: 1, weight: 1 }],
};

const validYaml = `version: 1
nodes:
  - type: client
    id: c2
    label: Client 2
    rps: 2
  - type: service
    id: s2
    label: Service 2
    latency_ms: 20
edges:
  - id: c2s2
    source: c2
    target: s2
`;

function resetStore() {
  const store = useEngineStore.getState();
  store.pause();
  useEngineStore.setState({
    engine: null,
    diagram: null,
    seed: 42,
    isRunning: false,
    tickCount: 0,
    selectedNodeId: null,
    history: {},
  });
}

afterEach(resetStore);

describe("engine store YAML and chaos actions", () => {
  it("returns an error for invalid YAML without throwing or replacing the live engine", () => {
    const store = useEngineStore.getState();
    store.loadDiagram(diagram, 77);
    const previousEngine = useEngineStore.getState().engine;

    const result = useEngineStore.getState().setDiagramFromYaml("nodes: [");

    expect(result.ok).toBe(false);
    expect(useEngineStore.getState().engine).toBe(previousEngine);
    expect(useEngineStore.getState().engine?.state.seed).toBe(77);
  });

  it("returns an error for schema-invalid YAML without replacing the live engine", () => {
    const store = useEngineStore.getState();
    store.loadDiagram(diagram, 77);
    const previousEngine = useEngineStore.getState().engine;

    const result = useEngineStore.getState().setDiagramFromYaml(`version: 1
nodes:
  - type: client
    id: c
edges: []
`);

    expect(result.ok).toBe(false);
    expect(useEngineStore.getState().engine).toBe(previousEngine);
    expect(useEngineStore.getState().engine?.state.seed).toBe(77);
  });

  it("loads a valid YAML diagram while keeping the current seed", () => {
    const store = useEngineStore.getState();
    store.setSeed(99);

    const result = useEngineStore.getState().setDiagramFromYaml(validYaml);

    expect(result).toEqual({ ok: true });
    expect(useEngineStore.getState().diagram?.nodes.map((node) => node.id)).toEqual(["c2", "s2"]);
    expect(useEngineStore.getState().engine?.state.seed).toBe(99);
  });

  it("updates a node position immutably and recreates the engine", () => {
    const store = useEngineStore.getState();
    store.loadDiagram(diagram, 42);
    const previousDiagram = useEngineStore.getState().diagram;
    const previousEngine = useEngineStore.getState().engine;

    useEngineStore.getState().updateNodePosition("s", { x: 12, y: 34 });

    const nextState = useEngineStore.getState();
    expect(nextState.diagram).not.toBe(previousDiagram);
    expect(nextState.engine).not.toBe(previousEngine);
    expect(nextState.diagram?.nodes.find((node) => node.id === "s")?.position).toEqual({ x: 12, y: 34 });
    expect(nextState.engine?.state.diagram.nodes.find((node) => node.id === "s")?.position).toEqual({ x: 12, y: 34 });
  });

  it("sets and clears runtime chaos hooks", () => {
    const store = useEngineStore.getState();
    store.loadDiagram(diagram, 42);

    useEngineStore.getState().chaosKillNode("s");
    expect(useEngineStore.getState().engine?.state.nodes.s.chaos).toEqual({ killed: true });

    useEngineStore.getState().chaosSlowNode("s");
    expect(useEngineStore.getState().engine?.state.nodes.s.chaos).toEqual({ killed: true, slow_factor: 2 });

    useEngineStore.getState().chaosDropRequests("s", 0.25);
    expect(useEngineStore.getState().engine?.state.nodes.s.chaos).toEqual({
      killed: true,
      slow_factor: 2,
      drop_fraction: 0.25,
    });

    useEngineStore.getState().chaosClear("s");
    expect(useEngineStore.getState().engine?.state.nodes.s.chaos).toBeUndefined();

    useEngineStore.getState().chaosSlowNode("s", 4);
    useEngineStore.getState().chaosKillNode("c");
    useEngineStore.getState().chaosClear();
    expect(useEngineStore.getState().engine?.state.nodes.s.chaos).toBeUndefined();
    expect(useEngineStore.getState().engine?.state.nodes.c.chaos).toBeUndefined();
  });
});
