import { z } from "zod";

export const TriggerSchema = z.object({
  id: z.string().min(1),
  cron: z.string().min(1),
  payload_size: z.number().int().nonnegative().optional(),
});
export type Trigger = z.infer<typeof TriggerSchema>;

export const ScenarioSchema = z.object({
  id: z.string().min(1),
  origin: z.string().min(1),
  trigger_id: z.string().optional(),
  color: z.string().optional(),
  weight: z.number().positive().default(1),
});
export type Scenario = z.infer<typeof ScenarioSchema>;

export const ClientNodeSchema = z.object({
  type: z.literal("client"),
  id: z.string().min(1),
  label: z.string().default("Client"),
  rps: z.number().positive(),
  pattern: z.enum(["constant", "burst", "ramp"]).default("constant"),
  payload_size: z.number().int().nonnegative().default(0),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
});

export const ServiceNodeSchema = z.object({
  type: z.literal("service"),
  id: z.string().min(1),
  label: z.string().default("Service"),
  latency_ms: z.number().nonnegative().default(20),
  capacity_rps: z.number().positive().default(1000),
  error_rate: z.number().min(0).max(1).default(0),
  triggers: z.array(TriggerSchema).optional(),
  position: z.object({ x: z.number(), y: z.number() }).optional(),
});

export const NodeSchema = z.discriminatedUnion("type", [
  ClientNodeSchema,
  ServiceNodeSchema,
]);

export const EdgeSchema = z.object({
  id: z.string().min(1),
  source: z.string().min(1),
  target: z.string().min(1),
  kind: z.enum(["sync", "async"]).default("sync"),
  latency_ms: z.number().nonnegative().default(5),
  label: z.string().optional(),
  weight: z.number().positive().default(1),
  tags: z.array(z.string()).optional(),
});

export const DiagramSchema = z
  .object({
    version: z.literal(1),
    nodes: z.array(NodeSchema),
    edges: z.array(EdgeSchema),
    scenarios: z.array(ScenarioSchema).optional(),
  })
  .superRefine((diagram, ctx) => {
    const ids = new Set(diagram.nodes.map((n) => n.id));
    diagram.edges.forEach((edge, idx) => {
      if (!ids.has(edge.source)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["edges", idx, "source"],
          message: `edge ${edge.id} references unknown source ${edge.source}`,
        });
      }
      if (!ids.has(edge.target)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["edges", idx, "target"],
          message: `edge ${edge.id} references unknown target ${edge.target}`,
        });
      }
    });
  });

export type ClientNode = z.infer<typeof ClientNodeSchema>;
export type ServiceNode = z.infer<typeof ServiceNodeSchema>;
export type Node = z.infer<typeof NodeSchema>;
export type Edge = z.infer<typeof EdgeSchema>;
export type Diagram = z.infer<typeof DiagramSchema>;
