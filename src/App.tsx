import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { Layout } from "./components/Layout";
import { FlowCanvas } from "./components/canvas/FlowCanvas";
import { Toolbar, type ViewMode } from "./components/toolbar/Toolbar";
import { Inspector } from "./components/Inspector";
import { useEngineStore } from "./store/engineStore";
import { parseDiagram, stringifyDiagram } from "./lib/yaml";
import demoYaml from "./examples/foundation-demo.archflow.yaml?raw";
import ecommerceYaml from "./examples/ecommerce.archflow.yaml?raw";
import scalingYaml from "./examples/scaling.yaml?raw";

const YamlEditor = lazy(() => import("./components/editor/YamlEditor"));

type ExampleName = "foundation" | "ecommerce" | "scaling";

const viewModes: ViewMode[] = ["canvas", "split", "editor"];

function initialViewMode(): ViewMode {
  const saved = localStorage.getItem("archflow.viewMode");
  return viewModes.includes(saved as ViewMode) ? (saved as ViewMode) : "canvas";
}

export default function App() {
  const [example, setExample] = useState<ExampleName>("foundation");
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [editorError, setEditorError] = useState<string | null>(null);
  const [editorText, setEditorText] = useState("");
  const editorOriginDiagramRef = useRef(useEngineStore.getState().diagram);
  const diagram = useEngineStore((s) => s.diagram);
  const loadDiagram = useEngineStore((s) => s.loadDiagram);
  const setDiagramFromYaml = useEngineStore((s) => s.setDiagramFromYaml);

  useEffect(() => {
    const yamlByExample: Record<ExampleName, string> = {
      foundation: demoYaml,
      ecommerce: ecommerceYaml,
      scaling: scalingYaml,
    };
    loadDiagram(parseDiagram(yamlByExample[example]));
    setEditorError(null);
  }, [loadDiagram, example]);

  useEffect(() => {
    localStorage.setItem("archflow.viewMode", viewMode);
  }, [viewMode]);

  useEffect(() => {
    if (!diagram) {
      setEditorText("");
      return;
    }
    if (diagram === editorOriginDiagramRef.current) {
      editorOriginDiagramRef.current = null;
      return;
    }
    setEditorText(stringifyDiagram(diagram));
  }, [diagram]);

  const handleEditorChange = useCallback(
    (text: string) => {
      setEditorText(text);
      const result = setDiagramFromYaml(text);
      if (result.ok) {
        editorOriginDiagramRef.current = useEngineStore.getState().diagram;
        setEditorError(null);
      } else {
        setEditorError(result.error);
      }
    },
    [setDiagramFromYaml],
  );

  return (
    <ReactFlowProvider>
      <Layout
        left={<PaletteStub example={example} onExampleChange={setExample} />}
        center={
          <div style={{ display: "flex", width: "100%", height: "100%", minHeight: 0 }}>
            <div
              style={{
                display: viewMode === "editor" ? "none" : "block",
                flex: viewMode === "split" ? "0 0 60%" : "1 1 auto",
                minWidth: 0,
              }}
            >
              <FlowCanvas />
            </div>
            {viewMode !== "canvas" ? (
              <div style={{ flex: viewMode === "split" ? "0 0 40%" : "1 1 auto", minWidth: 0, height: "100%" }}>
                <Suspense fallback={<div style={{ padding: 12 }}>Loading editor…</div>}>
                  <YamlEditor value={editorText} onChange={handleEditorChange} error={editorError} />
                </Suspense>
              </div>
            ) : null}
          </div>
        }
        right={<Inspector />}
        bottom={<Toolbar viewMode={viewMode} onViewModeChange={setViewMode} />}
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
