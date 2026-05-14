# 03 API Gateway

A public API gateway performs rate limiting and JWT-like auth checks before forwarding to a load balancer and three downstream services backed by a shared cache and database.

```text
[Public Users] -> [Rate-limit + JWT Gateway] -> [LB] -> [Users Service]  -> [Shared Cache] -> [DB]
                                                   |-> [Orders Service] -> [Shared Cache] -> [DB]
                                                   |-> [Search Service] -> [Shared Cache] -> [DB]
```

| Name | Type | Key params |
| --- | --- | --- |
| Public Users | client | 180 rps, constant |
| Rate-limit + JWT Gateway | gateway | 150 rps rate limit, 8 ms auth |
| Service Load Balancer | load_balancer | round_robin |
| Users Service | service | 30 ms latency, 70 rps capacity |
| Orders Service | service | 45 ms latency, 65 rps capacity |
| Search Service | service | 55 ms latency, 90 rps capacity |
| Shared Redis Cache | cache | 76% hit rate, 2 ms latency |
| Shared Database | database | pool 32, 14 ms query latency |

Scenarios model `profile`, `orders`, and `search` requests with weighted routing through the gateway and load balancer. Cache hit/miss tags show how misses fall through to the database.

[Open in app](?example=03-api-gateway)
