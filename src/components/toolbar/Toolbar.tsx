import { useEngineStore } from "@/store/engineStore";
import { exportPng, exportYaml } from "@/lib/export";

export type ViewMode = "canvas" | "split" | "editor";

interface ToolbarProps {
  viewMode: ViewMode;
  onViewModeChange: (mode: ViewMode) => void;
}

export function Toolbar({ viewMode, onViewModeChange }: ToolbarProps) {
  const isRunning = useEngineStore((s) => s.isRunning);
  const seed = useEngineStore((s) => s.seed);
  const play = useEngineStore((s) => s.play);
  const pause = useEngineStore((s) => s.pause);
  const reset = useEngineStore((s) => s.reset);
  const setSeed = useEngineStore((s) => s.setSeed);
  const tickCount = useEngineStore((s) => s.tickCount);
  const engine = useEngineStore((s) => s.engine);
  const diagram = useEngineStore((s) => s.diagram);

  const counters = engine?.state.counters ?? { emitted: 0, completed: 0, failed: 0 };
  const inFlight = engine?.state.particles.length ?? 0;

  const handlePngExport = () => {
    const viewport = document.querySelector<HTMLElement>(".react-flow__viewport");
    if (viewport) void exportPng(viewport);
  };

  return (
    <div
      style={{
        display: "flex",
        gap: 12,
        alignItems: "center",
        padding: "8px 12px",
        background: "var(--bg-elev)",
        borderTop: "1px solid var(--border)",
        fontSize: 12,
      }}
    >
      <button
        onClick={() => (isRunning ? pause() : play())}
        style={btnStyle(isRunning ? "var(--warn)" : "var(--accent)")}
      >
        {isRunning ? "⏸ Pause" : "▶ Play"}
      </button>
      <button onClick={reset} style={btnStyle("var(--border)")}>⟲ Reset</button>
      <button onClick={() => onViewModeChange(nextViewMode(viewMode))} style={btnStyle("var(--info)")}>Editor: {viewMode}</button>
      <button onClick={() => diagram && exportYaml(diagram)} disabled={!diagram} style={btnStyle("var(--border)")}>↓ YAML</button>
      <button onClick={handlePngExport} style={btnStyle("var(--border)")}>↓ PNG</button>
      <label style={{ color: "var(--text-dim)" }}>
        seed:&nbsp;
        <input
          type="number"
          value={seed}
          onChange={(e) => setSeed(Number(e.target.value))}
          style={{
            width: 80,
            background: "var(--panel)",
            border: "1px solid var(--border)",
            color: "var(--text)",
            padding: "2px 6px",
            borderRadius: 4,
          }}
        />
      </label>
      <div style={{ marginLeft: "auto", color: "var(--text-dim)", fontFamily: "ui-monospace, monospace" }}>
        ticks: {tickCount} · in-flight: {inFlight} · emitted: {counters.emitted} · ok:{" "}
        {counters.completed} · err: {counters.failed}
      </div>
    </div>
  );
}

function nextViewMode(mode: ViewMode): ViewMode {
  if (mode === "canvas") return "split";
  if (mode === "split") return "editor";
  return "canvas";
}

function btnStyle(color: string): React.CSSProperties {
  return {
    padding: "4px 10px",
    background: "var(--panel)",
    color: "var(--text)",
    border: `1px solid ${color}`,
    borderRadius: 4,
  };
}
