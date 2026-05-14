import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

export interface ServiceNodeData {
  label: string;
  latency_ms: number;
}

export function ServiceNode(props: NodeProps) {
  const data = props.data as unknown as ServiceNodeData;
  return (
    <div
      style={{
        padding: "10px 14px",
        background: "var(--panel)",
        border: "2px solid var(--service)",
        borderRadius: 8,
        minWidth: 130,
        color: "var(--text)",
        fontSize: 12,
      }}
    >
      <Handle type="target" position={Position.Left} />
      <div style={{ fontWeight: 600 }}>⚙️ {data.label}</div>
      <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
        p99: ~{data.latency_ms}ms
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
