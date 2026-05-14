import { lazy, Suspense, useCallback, useEffect, useRef, useState } from "react";
import { ReactFlowProvider } from "@xyflow/react";
import { Layout } from "./components/Layout";
import { FlowCanvas } from "./components/canvas/FlowCanvas";
import { Toolbar, type ViewMode } from "./components/toolbar/Toolbar";
import { Inspector } from "./components/Inspector";
import { PresetsPanel } from "./components/presets/PresetsPanel";
import { useEngineStore } from "./store/engineStore";
import { savePreset } from "./lib/presets";
import { parseDiagram, stringifyDiagram } from "./lib/yaml";
import demoYaml from "./examples/foundation-demo.archflow.yaml?raw";
import ecommerceYaml from "./examples/ecommerce.archflow.yaml?raw";
import scalingYaml from "./examples/scaling.yaml?raw";
import cookbookEcommerceYaml from "./examples/01-ecommerce.yaml?raw";
import microservicesAsyncYaml from "./examples/02-microservices-async.yaml?raw";
import apiGatewayYaml from "./examples/03-api-gateway.yaml?raw";
import k8sAutoscalingYaml from "./examples/04-k8s-autoscaling.yaml?raw";
import eventDrivenYaml from "./examples/05-event-driven.yaml?raw";

const YamlEditor = lazy(() => import("./components/editor/YamlEditor"));

const yamlByExample = {
  foundation: demoYaml,
  ecommerce: ecommerceYaml,
  scaling: scalingYaml,
  "01-ecommerce": cookbookEcommerceYaml,
  "02-microservices-async": microservicesAsyncYaml,
  "03-api-gateway": apiGatewayYaml,
  "04-k8s-autoscaling": k8sAutoscalingYaml,
  "05-event-driven": eventDrivenYaml,
};

const exampleOptions = [
  { value: "foundation", label: "Foundation Demo" },
  { value: "ecommerce", label: "E-commerce Catalog" },
  { value: "scaling", label: "Scaling HPA Demo" },
  { value: "01-ecommerce", label: "01 E-commerce" },
  { value: "02-microservices-async", label: "02 Microservices Async" },
  { value: "03-api-gateway", label: "03 API Gateway" },
  { value: "04-k8s-autoscaling", label: "04 K8s Autoscaling" },
  { value: "05-event-driven", label: "05 Event Driven" },
] as const;

type ExampleName = keyof typeof yamlByExample;

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

  const handleLoadPreset = useCallback(
    (yaml: string) => {
      const result = setDiagramFromYaml(yaml);
      if (result.ok) {
        setEditorText(yaml);
        setEditorError(null);
      } else {
        setEditorError(result.error);
      }
    },
    [setDiagramFromYaml],
  );

  const handleSaveCurrent = useCallback(
    (name: string) => {
      if (!diagram) return;
      savePreset(name, stringifyDiagram(diagram));
    },
    [diagram],
  );

  return (
    <ReactFlowProvider>
      <Layout
        left={
          <LeftPanel
            example={example}
            onExampleChange={setExample}
            onLoadPreset={handleLoadPreset}
            onSaveCurrent={handleSaveCurrent}
          />
        }
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

function LeftPanel({
  example,
  onExampleChange,
  onLoadPreset,
  onSaveCurrent,
}: {
  example: ExampleName;
  onExampleChange: (ex: ExampleName) => void;
  onLoadPreset: (yaml: string) => void;
  onSaveCurrent: (name: string) => void;
}) {
  return (
    <>
      <section style={{ marginBottom: 16 }}>
        <div style={sectionTitleStyle}>Examples</div>
        <select
          value={example}
          onChange={(e) => onExampleChange(e.target.value as ExampleName)}
          style={selectStyle}
        >
          {exampleOptions.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </section>
      <section style={{ marginBottom: 16 }}>
        <div style={sectionTitleStyle}>My Presets</div>
        <PresetsPanel onLoad={onLoadPreset} onSaveCurrent={onSaveCurrent} />
      </section>
      <section>
        <div style={sectionTitleStyle}>Palette</div>
        <p style={{ color: "var(--text-dim)" }}>Palette comes in Plan 2.</p>
      </section>
    </>
  );
}

const sectionTitleStyle: React.CSSProperties = {
  textTransform: "uppercase",
  color: "var(--text-dim)",
  fontSize: 11,
  marginBottom: 6,
};

const selectStyle: React.CSSProperties = {
  width: "100%",
  padding: "6px 8px",
  fontSize: 12,
  backgroundColor: "var(--bg-secondary)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: 4,
};
