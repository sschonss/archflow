import { useMemo } from "react";
import {
  ReactFlow,
  Background,
  Controls,
  type Node as RFNode,
  type Edge as RFEdge,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";

import { useEngineStore } from "@/store/engineStore";
import { ClientNode } from "./nodes/ClientNode";
import { ServiceNode } from "./nodes/ServiceNode";
import { ParticleLayer } from "./ParticleLayer";

const nodeTypes = { client: ClientNode, service: ServiceNode };

export function FlowCanvas() {
  const diagram = useEngineStore((s) => s.diagram);

  const { nodes, edges } = useMemo<{ nodes: RFNode[]; edges: RFEdge[] }>(() => {
    if (!diagram) return { nodes: [], edges: [] };
    const nodes: RFNode[] = diagram.nodes.map((n) => ({
      id: n.id,
      type: n.type,
      position: n.position ?? { x: 0, y: 0 },
      data:
        n.type === "client"
          ? { label: n.label, rps: n.rps }
          : { label: n.label, latency_ms: n.latency_ms },
    }));
    const edges: RFEdge[] = diagram.edges.map((e) => ({
      id: e.id,
      source: e.source,
      target: e.target,
      type: "default",
    }));
    return { nodes, edges };
  }, [diagram]);

  return (
    <div style={{ position: "relative", width: "100%", height: "100%" }}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        nodeTypes={nodeTypes}
        proOptions={{ hideAttribution: true }}
        fitView
      >
        <Background gap={20} color="var(--border)" />
        <Controls />
      </ReactFlow>
      <ParticleLayer />
    </div>
  );
}
