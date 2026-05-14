import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

export interface DatabaseNodeData {
  label: string;
  pool_size?: number;
}

export function DatabaseNode(props: NodeProps) {
  const data = props.data as unknown as DatabaseNodeData;
  return (
    <div
      style={{
        padding: "10px 14px",
        background: "var(--panel)",
        border: "2px solid var(--danger)",
        borderRadius: 8,
        minWidth: 120,
        color: "var(--text)",
        fontSize: 12,
      }}
    >
      <Handle type="target" position={Position.Left} />
      <div style={{ fontWeight: 600 }}>🗄️ {data.label}</div>
      <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
        pool: {data.pool_size || 10}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
