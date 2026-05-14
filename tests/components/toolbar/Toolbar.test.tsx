import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { Toolbar } from "@/components/toolbar/Toolbar";
import type { Diagram } from "@/schema";
import { useEngineStore } from "@/store/engineStore";
import { exportPng, exportYaml } from "@/lib/export";

vi.mock("@/lib/export", () => ({
  exportPng: vi.fn(),
  exportYaml: vi.fn(),
}));

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
  vi.clearAllMocks();
  document.body.innerHTML = "";
  act(resetStore);
});

describe("Toolbar", () => {
  it("exports the current diagram as YAML", () => {
    act(() => {
      useEngineStore.getState().loadDiagram(diagram, 42);
    });
    render(<Toolbar viewMode="canvas" onViewModeChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "↓ YAML" }));

    expect(exportYaml).toHaveBeenCalledWith(diagram);
  });

  it("exports the React Flow viewport as PNG", () => {
    const viewport = document.createElement("div");
    viewport.className = "react-flow__viewport";
    document.body.appendChild(viewport);
    render(<Toolbar viewMode="canvas" onViewModeChange={vi.fn()} />);

    fireEvent.click(screen.getByRole("button", { name: "↓ PNG" }));

    expect(exportPng).toHaveBeenCalledWith(viewport);
  });

  it.each([
    ["canvas", "split"],
    ["split", "editor"],
    ["editor", "canvas"],
  ] as const)("cycles editor view mode from %s to %s", (viewMode, nextMode) => {
    const onViewModeChange = vi.fn();
    render(<Toolbar viewMode={viewMode} onViewModeChange={onViewModeChange} />);

    fireEvent.click(screen.getByRole("button", { name: new RegExp(`Editor: ${viewMode}`, "i") }));

    expect(onViewModeChange).toHaveBeenCalledWith(nextMode);
  });
});
