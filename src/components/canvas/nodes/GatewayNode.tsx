import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

export interface GatewayNodeData {
  label: string;
  rate_limit_rps?: number;
}

export function GatewayNode(props: NodeProps) {
  const data = props.data as unknown as GatewayNodeData;
  return (
    <div
      style={{
        padding: "10px 14px",
        background: "var(--panel)",
        border: "2px solid var(--accent)",
        borderRadius: 8,
        minWidth: 120,
        color: "var(--text)",
        fontSize: 12,
      }}
    >
      <Handle type="target" position={Position.Left} />
      <div style={{ fontWeight: 600 }}>🚪 {data.label}</div>
      <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
        limit: {(data.rate_limit_rps ?? 0).toFixed(0)} rps
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
