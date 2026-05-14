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
import scalingYaml from "./examples/scaling.yaml?raw";

type ExampleName = "foundation" | "ecommerce" | "scaling";

export default function App() {
  const [example, setExample] = useState<ExampleName>("foundation");
  const loadDiagram = useEngineStore((s) => s.loadDiagram);

  useEffect(() => {
    const yamlByExample: Record<ExampleName, string> = {
      foundation: demoYaml,
      ecommerce: ecommerceYaml,
      scaling: scalingYaml,
    };
    loadDiagram(parseDiagram(yamlByExample[example]));
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
  example: ExampleName;
  onExampleChange: (ex: ExampleName) => void;
}) {
  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <div style={{ textTransform: "uppercase", color: "var(--text-dim)", fontSize: 11, marginBottom: 6 }}>
          Example
        </div>
        <select
          value={example}
          onChange={(e) => onExampleChange(e.target.value as ExampleName)}
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
          <option value="scaling">Scaling HPA Demo</option>
        </select>
      </div>
      <div style={{ textTransform: "uppercase", color: "var(--text-dim)", fontSize: 11 }}>
        Palette
      </div>
      <p style={{ color: "var(--text-dim)" }}>Palette comes in Plan 2.</p>
    </>
  );
}
