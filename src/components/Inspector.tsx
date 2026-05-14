import { useEngineStore } from "@/store/engineStore";
import { Sparkline } from "./charts/Sparkline";

const buttonStyle: React.CSSProperties = {
  padding: "3px 7px",
  background: "var(--panel)",
  color: "var(--text)",
  border: "1px solid var(--border)",
  borderRadius: 4,
  fontSize: 10,
};

const chaosBadgeStyle: React.CSSProperties = {
  padding: "1px 6px",
  borderRadius: 999,
  background: "rgba(255, 80, 80, 0.16)",
  border: "1px solid rgba(255, 80, 80, 0.5)",
  color: "#ff8a8a",
  fontSize: 9,
  fontWeight: 600,
};

export function Inspector() {
  const selectedNodeId = useEngineStore((s) => s.selectedNodeId);
  const diagram = useEngineStore((s) => s.diagram);
  const engine = useEngineStore((s) => s.engine);
  useEngineStore((s) => s.tickCount);
  const getMetrics = useEngineStore((s) => s.getMetrics);
  const history = useEngineStore((s) => (selectedNodeId ? s.getHistory(selectedNodeId) : null));
  const chaosKillNode = useEngineStore((s) => s.chaosKillNode);
  const chaosSlowNode = useEngineStore((s) => s.chaosSlowNode);
  const chaosDropRequests = useEngineStore((s) => s.chaosDropRequests);
  const chaosClear = useEngineStore((s) => s.chaosClear);

  if (!selectedNodeId || !diagram) {
    return (
      <div style={{ color: "var(--text-dim)", fontSize: 12 }}>
        Select a node…
      </div>
    );
  }

  const node = diagram.nodes.find((n) => n.id === selectedNodeId);
  if (!node) {
    return (
      <div style={{ color: "var(--text-dim)", fontSize: 12 }}>
        Node not found
      </div>
    );
  }

  const metrics = getMetrics(selectedNodeId);
  const runtime = engine?.state.nodes[selectedNodeId];
  const chaos = runtime?.chaos;
  const isChaosActive = Boolean(chaos?.killed || chaos?.slow_factor || chaos?.drop_fraction);
  const supportsChaos = ["service", "worker", "gateway", "database", "cache", "queue"].includes(node.type);
  const showCharts =
    (node.type === "service" || node.type === "worker") &&
    history !== null &&
    (history.rps_in.length > 0 || history.cpu.length > 0 || history.replicas.length > 0);

  return (
    <div style={{ fontSize: 11 }}>
      <h3 style={{ margin: "0 0 8px 0", fontSize: 13, display: "flex", alignItems: "center", gap: 6 }}>
        <span>
          {node.label} <small style={{ color: "var(--text-dim)" }}>({node.type})</small>
        </span>
        {isChaosActive ? <span style={chaosBadgeStyle}>Chaos active</span> : null}
      </h3>

      <div style={{ marginBottom: 12 }}>
        <div style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 4 }}>
          Node data:
        </div>
        <pre
          style={{
            margin: 0,
            padding: 6,
            background: "var(--bg)",
            border: "1px solid var(--border)",
            borderRadius: 4,
            fontSize: 9,
            overflowX: "auto",
            maxHeight: 150,
            overflowY: "auto",
            color: "var(--text-dim)",
          }}
        >
          {JSON.stringify(node, null, 2)}
        </pre>
      </div>

      {supportsChaos ? (
        <section style={{ marginBottom: 12 }}>
          <div style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 6 }}>
            Chaos
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            <button type="button" onClick={() => chaosKillNode(selectedNodeId)} disabled={Boolean(chaos?.killed)} style={buttonStyle}>
              Kill
            </button>
            <button type="button" onClick={() => chaosSlowNode(selectedNodeId, 2)} disabled={Boolean(chaos?.slow_factor)} style={buttonStyle}>
              Slow x2
            </button>
            <button
              type="button"
              onClick={() => chaosDropRequests(selectedNodeId, 0.5)}
              disabled={Boolean(chaos?.drop_fraction)}
              style={buttonStyle}
            >
              Drop 50%
            </button>
            <button type="button" onClick={() => chaosClear(selectedNodeId)} disabled={!isChaosActive} style={buttonStyle}>
              Clear
            </button>
          </div>
        </section>
      ) : null}

      {metrics ? (
        <div>
          <div style={{ fontSize: 10, color: "var(--text-dim)", marginBottom: 4 }}>
            Live metrics:
          </div>
          <div style={{ fontSize: 10, display: "flex", flexDirection: "column", gap: 2 }}>
            <div>
              <span style={{ color: "var(--text-dim)" }}>rps_in:</span>{" "}
              {metrics.rps_in.toFixed(1)}
            </div>
            <div>
              <span style={{ color: "var(--text-dim)" }}>rps_out:</span>{" "}
              {metrics.rps_out.toFixed(1)}
            </div>
            <div>
              <span style={{ color: "var(--text-dim)" }}>error_rate:</span>{" "}
              {(metrics.error_rate * 100).toFixed(1)}%
            </div>
            <div>
              <span style={{ color: "var(--text-dim)" }}>p50:</span>{" "}
              {metrics.p50.toFixed(0)}ms
            </div>
            <div>
              <span style={{ color: "var(--text-dim)" }}>p95:</span>{" "}
              {metrics.p95.toFixed(0)}ms
            </div>
            <div>
              <span style={{ color: "var(--text-dim)" }}>p99:</span>{" "}
              {metrics.p99.toFixed(0)}ms
            </div>
            <div>
              <span style={{ color: "var(--text-dim)" }}>queue_depth:</span>{" "}
              {metrics.queue_depth}
            </div>
            <div>
              <span style={{ color: "var(--text-dim)" }}>throughput_total:</span>{" "}
              {metrics.throughput_total}
            </div>
          </div>
          {showCharts && (
            <div style={{ marginTop: 12, display: "flex", flexDirection: "column", gap: 8 }}>
              <Sparkline label="rps_in" values={history.rps_in} color="#4a90e2" />
              <Sparkline label="cpu" values={history.cpu} color="#f5a623" />
              <Sparkline label="replicas" values={history.replicas} color="#7ed321" />
            </div>
          )}
        </div>
      ) : (
        <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
          No metrics available
        </div>
      )}
    </div>
  );
}
