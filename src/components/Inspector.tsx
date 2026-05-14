import { useEngineStore } from "@/store/engineStore";

export function Inspector() {
  const selectedNodeId = useEngineStore((s) => s.selectedNodeId);
  const diagram = useEngineStore((s) => s.diagram);
  useEngineStore((s) => s.tickCount);
  const getMetrics = useEngineStore((s) => s.getMetrics);

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

  return (
    <div style={{ fontSize: 11 }}>
      <h3 style={{ margin: "0 0 8px 0", fontSize: 13 }}>
        {node.label} <small style={{ color: "var(--text-dim)" }}>({node.type})</small>
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
        </div>
      ) : (
        <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
          No metrics available
        </div>
      )}
    </div>
  );
}
