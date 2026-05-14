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
import { WebhookNode } from "./nodes/WebhookNode";
import { LoadBalancerNode } from "./nodes/LoadBalancerNode";
import { GatewayNode } from "./nodes/GatewayNode";
import { WorkerNode } from "./nodes/WorkerNode";
import { QueueNode } from "./nodes/QueueNode";
import { CacheNode } from "./nodes/CacheNode";
import { DatabaseNode } from "./nodes/DatabaseNode";
import { ParticleLayer } from "./ParticleLayer";

const nodeTypes = {
  client: ClientNode,
  service: ServiceNode,
  webhook: WebhookNode,
  load_balancer: LoadBalancerNode,
  gateway: GatewayNode,
  worker: WorkerNode,
  queue: QueueNode,
  cache: CacheNode,
  database: DatabaseNode,
};

export function FlowCanvas() {
  const diagram = useEngineStore((s) => s.diagram);
  const selectNode = useEngineStore((s) => s.selectNode);

  const { nodes, edges } = useMemo<{ nodes: RFNode[]; edges: RFEdge[] }>(() => {
    if (!diagram) return { nodes: [], edges: [] };
    const nodes: RFNode[] = diagram.nodes.map((n) => {
      let data: Record<string, unknown> = { label: n.label };
      
      switch (n.type) {
        case "client":
          data.rps = n.rps;
          break;
        case "webhook":
          data.rps = n.rps;
          data.pattern = n.pattern;
          break;
        case "load_balancer":
          data.strategy = n.strategy;
          break;
        case "gateway":
          data.rate_limit_rps = n.rate_limit_rps;
          break;
        case "service":
          data.latency_ms = n.latency_ms;
          break;
        case "worker":
          data.concurrency = n.concurrency;
          data.latency_ms = n.latency_ms;
          break;
        case "queue":
          data.max_depth = n.max_depth;
          break;
        case "cache":
          data.hit_rate = n.hit_rate;
          data.latency_ms = n.latency_ms;
          break;
        case "database":
          data.pool_size = n.pool_size;
          break;
      }
      
      return {
        id: n.id,
        type: n.type,
        position: n.position ?? { x: 0, y: 0 },
        data,
      };
    });
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
        onNodeClick={(_e, n) => selectNode(n.id)}
      >
        <Background gap={20} color="var(--border)" />
        <Controls />
      </ReactFlow>
      <ParticleLayer />
    </div>
  );
}
