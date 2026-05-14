# 01 E-commerce

A richer e-commerce topology showing browse, cart, and checkout flows through an edge gateway, app load balancer, catalog/cart/payment services, Redis-style product cache, Postgres, and asynchronous fulfillment workers.

```text
[Shoppers] -> [Gateway] -> [LB] -> [Catalog] -> [Product Cache] -> [DB]
                              |-> [Cart] -----------------------> [DB]
                              |-> [Payment] -> [Fulfillment Q] -> [Worker] -> [DB]
```

| Name | Type | Key params |
| --- | --- | --- |
| Web + Mobile Shoppers | client | 80 rps, constant, payload 4 |
| Edge API Gateway | gateway | 250 rps rate limit, 3 ms auth |
| App Load Balancer | load_balancer | least_conn |
| Catalog API | service | 25 ms latency, 120 rps capacity |
| Cart API | service | 35 ms latency, 90 rps capacity |
| Payment API | service | 80 ms latency, 45 rps capacity |
| Product Cache | cache | 82% hit rate, 2 ms latency |
| Commerce Postgres | database | pool 35, 12 ms query latency |
| Fulfillment Queue | queue | depth 1500, dlq overflow |
| Fulfillment Worker Pool | worker | concurrency 6, hourly reconcile trigger |

Scenarios split shopper traffic into `browse`, `cart`, and `checkout` tags so the simulator routes most traffic to catalog/cache, some to cart/database, and checkout traffic through payment into asynchronous fulfillment.

[Open in app](?example=01-ecommerce)
