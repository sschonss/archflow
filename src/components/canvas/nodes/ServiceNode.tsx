import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";
import { useEngineStore } from "@/store/engineStore";

export interface ServiceNodeData {
  label: string;
  latency_ms: number;
}

export function ServiceNode(props: NodeProps) {
  const data = props.data as unknown as ServiceNodeData;
  useEngineStore((s) => s.tickCount);
  const replicas = useEngineStore((s) => s.engine?.state.nodes[props.id]?.replicas ?? 1);
  const cpu = useEngineStore((s) => s.engine?.state.nodes[props.id]?.cpu_utilization ?? 0);
  const cpuPercent = Math.min(100, Math.max(0, cpu * 100));
  const cpuColor = cpuPercent >= 85 ? "#d0021b" : cpuPercent >= 60 ? "#f5a623" : "#7ed321";

  return (
    <div
      style={{
        position: "relative",
        padding: "10px 14px",
        paddingRight: 34,
        background: "var(--panel)",
        border: "2px solid var(--service)",
        borderRadius: 8,
        minWidth: 130,
        color: "var(--text)",
        fontSize: 12,
        overflow: "hidden",
      }}
    >
      <div
        style={{
          position: "absolute",
          top: 4,
          right: 6,
          fontSize: 10,
          background: "var(--accent)",
          color: "#000",
          padding: "0 4px",
          borderRadius: 4,
          lineHeight: "14px",
        }}
      >
        ×{replicas}
      </div>
      <Handle type="target" position={Position.Left} />
      <div style={{ fontWeight: 600 }}>⚙️ {data.label}</div>
      <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
        p99: ~{data.latency_ms}ms
      </div>
      <div
        style={{
          position: "absolute",
          bottom: 0,
          left: 0,
          height: 3,
          width: `${cpuPercent}%`,
          background: cpuColor,
        }}
      />
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
