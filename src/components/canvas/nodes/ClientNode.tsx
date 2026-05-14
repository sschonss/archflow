import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

export interface ClientNodeData {
  label: string;
  rps: number;
}

export function ClientNode(props: NodeProps) {
  const data = props.data as unknown as ClientNodeData;
  return (
    <div
      style={{
        padding: "10px 14px",
        background: "var(--panel)",
        border: "2px solid var(--client)",
        borderRadius: 8,
        minWidth: 110,
        color: "var(--text)",
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 600 }}>🌐 {data.label}</div>
      <div style={{ fontSize: 10, color: "var(--text-dim)" }}>rps: {data.rps}</div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
