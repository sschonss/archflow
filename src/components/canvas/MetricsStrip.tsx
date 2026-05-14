import { useEngineStore } from "@/store/engineStore";

export function MetricsStrip({ nodeId }: { nodeId: string }) {
  useEngineStore((s) => s.tickCount);
  const metrics = useEngineStore((s) => s.getMetrics(nodeId));

  if (!metrics) return null;

  const parts: string[] = [];
  parts.push(`${metrics.rps_in.toFixed(1)} rps`);
  parts.push(`p95 ${metrics.p95.toFixed(0)}ms`);

  if (metrics.queue_depth > 0) {
    parts.push(`q=${metrics.queue_depth}`);
  }

  const errorPercent = (metrics.error_rate * 100).toFixed(0);
  if (parseInt(errorPercent) > 0) {
    parts.push(`err ${errorPercent}%`);
  }

  return (
    <div style={{ fontSize: 10, color: "var(--text-dim)" }}>
      {parts.join(" • ")}
    </div>
  );
}
