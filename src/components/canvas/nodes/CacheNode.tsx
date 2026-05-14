import { Handle, Position } from "@xyflow/react";
import type { NodeProps } from "@xyflow/react";

export interface CacheNodeData {
  label: string;
  hit_rate?: number;
}

export function CacheNode(props: NodeProps) {
  const data = props.data as unknown as CacheNodeData;
  return (
    <div
      style={{
        padding: "10px 14px",
        background: "var(--panel)",
        border: "2px solid var(--accent)",
        borderRadius: 8,
        minWidth: 110,
        color: "var(--text)",
        fontSize: 12,
      }}
    >
      <Handle type="target" position={Position.Left} />
      <div style={{ fontWeight: 600 }}>⚡ {data.label}</div>
      <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
        hit: {((data.hit_rate ?? 0) * 100).toFixed(0)}%
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
