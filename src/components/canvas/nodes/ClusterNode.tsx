import type { NodeProps } from "@xyflow/react";

export interface ClusterNodeData {
  label: string;
}

export function ClusterNode(props: NodeProps) {
  const data = props.data as unknown as ClusterNodeData;

  return (
    <div
      style={{
        width: "100%",
        height: "100%",
        border: "1.5px dashed var(--text-dim)",
        borderRadius: 10,
        background: "rgba(255,255,255,0.04)",
        padding: 8,
        boxSizing: "border-box",
      }}
    >
      <div style={{ fontSize: 10, color: "var(--text-dim)", textTransform: "uppercase" }}>
        ☁ {data.label}
      </div>
    </div>
  );
}
