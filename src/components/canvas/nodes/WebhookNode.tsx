import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

export interface WebhookNodeData {
  label: string;
  rps: number;
  pattern?: string;
}

export function WebhookNode(props: NodeProps) {
  const data = props.data as unknown as WebhookNodeData;
  return (
    <div
      style={{
        padding: "10px 14px",
        background: "var(--panel)",
        border: "2px solid var(--info)",
        borderRadius: 8,
        minWidth: 120,
        color: "var(--text)",
        fontSize: 12,
      }}
    >
      <div style={{ fontWeight: 600 }}>📡 {data.label}</div>
      <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
        {data.rps.toFixed(1)} rps {data.pattern ? `(${data.pattern})` : ""}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
