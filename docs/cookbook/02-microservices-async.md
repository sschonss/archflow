# 02 Microservices Async

A producer service accepts bursty events, buffers them in a queue, and drains work through a worker pool with concurrency 4 into a database; the high arrival rate intentionally demonstrates backpressure.

```text
[Event Clients] -> [Producer Service] -> [Jobs Queue] -> [Worker Pool x4] -> [Events DB]
```

| Name | Type | Key params |
| --- | --- | --- |
| Event Clients | client | 420 rps, burst pattern |
| Producer Service | service | 18 ms latency, 220 rps capacity |
| Jobs Queue | queue | depth 800, dlq overflow |
| Worker Pool x4 | worker | concurrency 4, 180 ms latency |
| Events DB | database | pool 18, 18 ms query latency |

The `backpressure` scenario starts at the event clients. Because arrivals exceed worker drain capacity, queue depth grows and overflow behavior becomes visible.

[Open in app](?example=02-microservices-async)
