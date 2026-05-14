# 05 Event Driven

An event-driven webhook ingestion pipeline combines poisson webhook arrivals with a scheduled batch trigger, queues events, fans out to projection and cache invalidation workers, and persists to an event store.

```text
[Partner Webhook] -> [Webhook Ingestor] -> [Event Queue] -> [Projection Worker] -> [Event Store DB]
                                             |-----------> [Cache Invalidator] -> [Read Cache] -> [Event Store DB]
```

| Name | Type | Key params |
| --- | --- | --- |
| Partner Webhook | webhook | 65 rps, poisson pattern |
| Webhook Ingestor | service | 22 ms latency, nightly cron trigger |
| Event Queue | queue | depth 1200, dlq overflow |
| Projection Worker Fan-out | worker | concurrency 8, 90 ms latency |
| Cache Invalidation Worker | worker | concurrency 3, 45 ms latency |
| Read Model Cache | cache | 88% hit rate, 2 ms latency |
| Event Store DB | database | pool 28, 20 ms query latency |

Scenarios split queued events into `projection` and `invalidation` flows. The service trigger `nightly-batch` adds cron-driven load alongside webhook poisson arrivals.

[Open in app](?example=05-event-driven)
