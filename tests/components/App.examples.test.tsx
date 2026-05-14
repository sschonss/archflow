import { fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import App from "@/App";

type MockEngineState = {
  diagram: null;
  loadDiagram: ReturnType<typeof vi.fn>;
  setDiagramFromYaml: ReturnType<typeof vi.fn>;
};

const engineStoreMock = vi.hoisted(() => {
  const state = {
    diagram: null,
    loadDiagram: vi.fn(),
    setDiagramFromYaml: vi.fn(() => ({ ok: true })),
  };
  const useEngineStore = Object.assign(<T,>(selector: (s: typeof state) => T) => selector(state), {
    getState: () => state,
    setState: (next: Partial<MockEngineState>) => Object.assign(state, next),
  });
  return { state, useEngineStore };
});

vi.mock("@/store/engineStore", () => ({ useEngineStore: engineStoreMock.useEngineStore }));
vi.mock("@xyflow/react", () => ({
  ReactFlowProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/Layout", () => ({
  Layout: ({ left, center, right, bottom }: { left: React.ReactNode; center: React.ReactNode; right: React.ReactNode; bottom: React.ReactNode }) => (
    <div>
      {left}
      {center}
      {right}
      {bottom}
    </div>
  ),
}));
vi.mock("@/components/canvas/FlowCanvas", () => ({ FlowCanvas: () => <div>canvas</div> }));
vi.mock("@/components/toolbar/Toolbar", () => ({ Toolbar: () => <div>toolbar</div> }));
vi.mock("@/components/Inspector", () => ({ Inspector: () => <div>inspector</div> }));
vi.mock("@/components/presets/PresetsPanel", () => ({ PresetsPanel: () => <div>presets</div> }));

function resetLocation(search = "") {
  window.history.replaceState(null, "", `/${search}`);
}

afterEach(() => {
  resetLocation();
  localStorage.clear();
  engineStoreMock.state.diagram = null;
  engineStoreMock.state.loadDiagram.mockClear();
  engineStoreMock.state.setDiagramFromYaml.mockClear();
});

describe("App example links", () => {
  it("uses a valid example query param as the initial selection", () => {
    resetLocation("?example=03-api-gateway");

    render(<App />);

    expect(screen.getByRole("combobox")).toHaveValue("03-api-gateway");
  });

  it("updates the example query param while preserving other params", () => {
    resetLocation("?theme=dark&example=foundation");
    render(<App />);

    fireEvent.change(screen.getByRole("combobox"), { target: { value: "05-event-driven" } });

    expect(new URLSearchParams(window.location.search).get("theme")).toBe("dark");
    expect(new URLSearchParams(window.location.search).get("example")).toBe("05-event-driven");
  });
});
