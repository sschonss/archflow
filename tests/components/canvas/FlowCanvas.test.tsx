import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import type { Diagram } from "@/schema";
import { useEngineStore } from "@/store/engineStore";
import { FlowCanvas } from "@/components/canvas/FlowCanvas";

vi.mock("@xyflow/react", () => ({
  ReactFlow: ({ onNodeDragStop }: { onNodeDragStop?: (_event: unknown, node: { id: string; position: { x: number; y: number } }) => void }) => (
    <button type="button" onClick={() => onNodeDragStop?.({}, { id: "s", position: { x: 88, y: 99 } })}>
      drag service
    </button>
  ),
  Background: () => null,
  Controls: () => null,
}));

vi.mock("@/components/canvas/ParticleLayer", () => ({ ParticleLayer: () => null }));
vi.mock("@/components/canvas/nodes/ClientNode", () => ({ ClientNode: () => null }));
vi.mock("@/components/canvas/nodes/ServiceNode", () => ({ ServiceNode: () => null }));
vi.mock("@/components/canvas/nodes/WebhookNode", () => ({ WebhookNode: () => null }));
vi.mock("@/components/canvas/nodes/LoadBalancerNode", () => ({ LoadBalancerNode: () => null }));
vi.mock("@/components/canvas/nodes/GatewayNode", () => ({ GatewayNode: () => null }));
vi.mock("@/components/canvas/nodes/WorkerNode", () => ({ WorkerNode: () => null }));
vi.mock("@/components/canvas/nodes/QueueNode", () => ({ QueueNode: () => null }));
vi.mock("@/components/canvas/nodes/CacheNode", () => ({ CacheNode: () => null }));
vi.mock("@/components/canvas/nodes/DatabaseNode", () => ({ DatabaseNode: () => null }));
vi.mock("@/components/canvas/nodes/ClusterNode", () => ({ ClusterNode: () => null }));

const diagram: Diagram = {
  version: 1,
  nodes: [
    { type: "client", id: "c", label: "Client", rps: 1, pattern: "constant", payload_size: 0, position: { x: 0, y: 0 } },
    { type: "service", id: "s", label: "Service", latency_ms: 10, capacity_rps: 100, error_rate: 0, position: { x: 1, y: 2 } },
  ],
  edges: [{ id: "cs", source: "c", target: "s", kind: "sync", latency_ms: 1, weight: 1 }],
};

function resetStore() {
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

afterEach(() => {
  act(resetStore);
});

describe("FlowCanvas", () => {
  it("persists dragged node positions in the diagram store", () => {
    act(() => {
      useEngineStore.getState().loadDiagram(diagram, 42);
    });
    render(<FlowCanvas />);

    act(() => {
      fireEvent.click(screen.getByRole("button", { name: "drag service" }));
    });

    expect(useEngineStore.getState().diagram?.nodes.find((node) => node.id === "s")?.position).toEqual({ x: 88, y: 99 });
  });
});
