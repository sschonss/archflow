import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

export interface QueueNodeData {
  label: string;
  max_depth?: number;
}

export function QueueNode(props: NodeProps) {
  const data = props.data as unknown as QueueNodeData;
  return (
    <div
      style={{
        padding: "10px 14px",
        background: "var(--panel)",
        border: "2px solid var(--info)",
        borderRadius: 8,
        minWidth: 110,
        color: "var(--text)",
        fontSize: 12,
      }}
    >
      <Handle type="target" position={Position.Left} />
      <div style={{ fontWeight: 600 }}>📥 {data.label}</div>
      <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
        max: {data.max_depth || 100}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
