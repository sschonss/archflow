# 04 K8s Autoscaling

A bursting client drives traffic through an ingress and frontend to an API service inside a Kubernetes cluster with HPA enabled from 1 to 10 replicas at a 60% CPU target.

```text
                 +-- Production Kubernetes ----------------+
[Burst Client] -> [Ingress] -> [Frontend] -> [API + HPA] -> [State DB]
                 +------------------------------------------+
```

| Name | Type | Key params |
| --- | --- | --- |
| Production Kubernetes | cluster | members: frontend, api-service |
| Burst Traffic Client | client | 360 rps, burst pattern |
| Ingress Gateway | gateway | 500 rps rate limit, 2 ms auth |
| Frontend Service | service | 20 ms latency, 180 rps capacity |
| API Service with HPA | service | min 1, max 10, target_cpu_pct 60 |
| State Database | database | pool 25, 16 ms query latency |

The `burst-scaleout` scenario demonstrates CPU utilization rising under burst traffic. The HPA should add replicas during sustained load and stabilize after the burst.

[Open in app](?example=04-k8s-autoscaling)
