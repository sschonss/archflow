# archflow LLM prompt

archflow is an open-source tool for declarative, interactive architecture diagrams. Users describe systems in YAML, then archflow renders components, simulates request flows, and reports live metrics such as throughput, latency, queue depth, errors, and autoscaling behavior.

## Node types

Use the `type` discriminator and these required fields:

| `type` | Required fields |
| --- | --- |
| `client` | `type`, `id`, `rps` |
| `webhook` | `type`, `id`, `rps`, `pattern` |
| `gateway` | `type`, `id`, `rate_limit_rps` |
| `load_balancer` | `type`, `id`, `strategy` |
| `service` | `type`, `id` |
| `worker` | `type`, `id`, `concurrency`, `latency_ms`, `error_rate` |
| `queue` | `type`, `id`, `max_depth` |
| `cache` | `type`, `id`, `hit_rate`, `latency_ms` |
| `database` | `type`, `id`, `pool_size`, `query_latency_ms`, `timeout_ms` |
| `cluster` | `type`, `id` |

## Mini valid YAML sample

```yaml
$schema: "https://example.com/archflow/schema/archflow.schema.json"
version: 1
nodes:
  - id: user
    type: client
    label: User traffic
    rps: 25
  - id: api
    type: service
    label: API service
    replicas: 2
    latency_ms: 45
    error_rate: 0.01
  - id: db
    type: database
    label: Primary database
    pool_size: 20
    query_latency_ms: 12
    timeout_ms: 200
edges:
  - from: user
    to: api
  - from: api
    to: db
```

## Instructions to LLM

Generate a single YAML diagram for the system the user describes. Output ONLY YAML inside a fenced code block. Validate against the JSON Schema at https://example.com/archflow/schema/archflow.schema.json before delivery. Use `type` not `kind`, `label` not `name`.
