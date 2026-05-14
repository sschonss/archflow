import { useEffect, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { Layout } from "./components/Layout";
import { FlowCanvas } from "./components/canvas/FlowCanvas";
import { Toolbar } from "./components/toolbar/Toolbar";
import { Inspector } from "./components/Inspector";
import { useEngineStore } from "./store/engineStore";
import { parseDiagram } from "./lib/yaml";
import demoYaml from "./examples/foundation-demo.archflow.yaml?raw";
import ecommerceYaml from "./examples/ecommerce.archflow.yaml?raw";

export default function App() {
  const [example, setExample] = useState<"foundation" | "ecommerce">("foundation");
  const loadDiagram = useEngineStore((s) => s.loadDiagram);

  useEffect(() => {
    const yaml = example === "foundation" ? demoYaml : ecommerceYaml;
    loadDiagram(parseDiagram(yaml));
  }, [loadDiagram, example]);

  return (
    <ReactFlowProvider>
      <Layout
        left={<PaletteStub example={example} onExampleChange={setExample} />}
        center={<FlowCanvas />}
        right={<Inspector />}
        bottom={<Toolbar />}
      />
    </ReactFlowProvider>
  );
}

function PaletteStub({
  example,
  onExampleChange,
}: {
  example: "foundation" | "ecommerce";
  onExampleChange: (ex: "foundation" | "ecommerce") => void;
}) {
  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <div style={{ textTransform: "uppercase", color: "var(--text-dim)", fontSize: 11, marginBottom: 6 }}>
          Example
        </div>
        <select
          value={example}
          onChange={(e) => onExampleChange(e.target.value as "foundation" | "ecommerce")}
          style={{
            width: "100%",
            padding: "6px 8px",
            fontSize: 12,
            backgroundColor: "var(--bg-secondary)",
            color: "var(--text)",
            border: "1px solid var(--border)",
            borderRadius: 4,
          }}
        >
          <option value="foundation">Foundation Demo</option>
          <option value="ecommerce">E-commerce Catalog</option>
        </select>
      </div>
      <div style={{ textTransform: "uppercase", color: "var(--text-dim)", fontSize: 11 }}>
        Palette
      </div>
      <p style={{ color: "var(--text-dim)" }}>Palette comes in Plan 2.</p>
    </>
  );
}
