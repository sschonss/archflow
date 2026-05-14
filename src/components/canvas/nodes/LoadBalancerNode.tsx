import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

export interface LoadBalancerNodeData {
  label: string;
  strategy?: string;
}

export function LoadBalancerNode(props: NodeProps) {
  const data = props.data as unknown as LoadBalancerNodeData;
  return (
    <div
      style={{
        padding: "10px 14px",
        background: "var(--panel)",
        border: "2px solid var(--warn)",
        borderRadius: 8,
        minWidth: 130,
        color: "var(--text)",
        fontSize: 12,
      }}
    >
      <Handle type="target" position={Position.Left} />
      <div style={{ fontWeight: 600 }}>⚖️ {data.label}</div>
      <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
        {data.strategy || "round_robin"}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
