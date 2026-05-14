import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Inspector } from "@/components/Inspector";

vi.mock("@/components/charts/Sparkline", () => ({ Sparkline: () => null }));
import type { Diagram } from "@/schema";
import { useEngineStore } from "@/store/engineStore";

const diagram: Diagram = {
  version: 1,
  nodes: [
    { type: "client", id: "c", label: "Client", rps: 1, pattern: "constant", payload_size: 0 },
    { type: "service", id: "s", label: "Service", latency_ms: 10, capacity_rps: 1000, error_rate: 0 },
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

describe("Inspector chaos controls", () => {
  it("renders chaos controls for supported node types and applies runtime chaos", () => {
    act(() => {
      useEngineStore.getState().loadDiagram(diagram, 42);
      useEngineStore.getState().selectNode("s");
    });

    render(<Inspector />);

    expect(screen.getByText("Chaos")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Kill" }));
    expect(useEngineStore.getState().engine?.state.nodes.s.chaos?.killed).toBe(true);
    expect(screen.getByText("Chaos active")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Kill" })).toBeDisabled();

    fireEvent.click(screen.getByRole("button", { name: "Clear" }));
    expect(useEngineStore.getState().engine?.state.nodes.s.chaos).toBeUndefined();
  });

  it("does not render chaos controls for unsupported node types", () => {
    act(() => {
      useEngineStore.getState().loadDiagram(diagram, 42);
      useEngineStore.getState().selectNode("c");
    });

    render(<Inspector />);

    expect(screen.queryByText("Chaos")).not.toBeInTheDocument();
    expect(screen.queryByRole("button", { name: "Kill" })).not.toBeInTheDocument();
  });
});
