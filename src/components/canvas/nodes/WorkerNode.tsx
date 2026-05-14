import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

export interface WorkerNodeData {
  label: string;
  concurrency?: number;
}

export function WorkerNode(props: NodeProps) {
  const data = props.data as unknown as WorkerNodeData;
  return (
    <div
      style={{
        padding: "10px 14px",
        background: "var(--panel)",
        border: "2px solid var(--service)",
        borderRadius: 8,
        minWidth: 120,
        color: "var(--text)",
        fontSize: 12,
      }}
    >
      <Handle type="target" position={Position.Left} />
      <div style={{ fontWeight: 600 }}>👷 {data.label}</div>
      <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
        conc: {data.concurrency || 1}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
