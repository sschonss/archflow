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
