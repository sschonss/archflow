import { useEffect, useRef } from "react";
import { useStore as useRFStore } from "@xyflow/react";
import { useEngineStore } from "@/store/engineStore";
import type { Particle } from "@/engine";
import type { Diagram } from "@/schema";

const PARTICLE_RADIUS = 4;
const COLOR_BY_ORIGIN: Record<string, string> = {
  http: "#4ade80",
  webhook: "#60a5fa",
  cron: "#fbbf24",
};

interface XY {
  x: number;
  y: number;
}

type RFNodeLookup = Map<
  string,
  { internals?: { positionAbsolute?: XY }; measured?: { width?: number; height?: number } }
>;

export function ParticleLayer() {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const rafRef = useRef<number | null>(null);
  const lastTimeRef = useRef<number | null>(null);

  const transform = useRFStore((s) => s.transform);
  const nodeMap = useRFStore((s) => s.nodeLookup) as unknown as RFNodeLookup;

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    function resize() {
      if (!canvas) return;
      const dpr = window.devicePixelRatio || 1;
      const { offsetWidth: w, offsetHeight: h } = canvas;
      canvas.width = w * dpr;
      canvas.height = h * dpr;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    resize();
    const obs = new ResizeObserver(resize);
    obs.observe(canvas);

    function draw(now: number) {
      const last = lastTimeRef.current ?? now;
      const dt = Math.min(50, now - last);
      lastTimeRef.current = now;

      const { engine, isRunning, step } = useEngineStore.getState();
      if (engine && isRunning) step(dt);

      ctx!.clearRect(0, 0, canvas!.offsetWidth, canvas!.offsetHeight);
      if (!engine) {
        rafRef.current = requestAnimationFrame(draw);
        return;
      }

      const [tx, ty, zoom] = transform;
      const particles = engine.state.particles;
      for (const p of particles) {
        const pos = particlePos(p, engine.state.diagram, nodeMap);
        if (!pos) continue;
        const x = pos.x * zoom + tx;
        const y = pos.y * zoom + ty;
        ctx!.beginPath();
        ctx!.arc(x, y, PARTICLE_RADIUS, 0, Math.PI * 2);
        ctx!.fillStyle = COLOR_BY_ORIGIN[p.originType] ?? "#fff";
        ctx!.fill();
      }

      rafRef.current = requestAnimationFrame(draw);
    }
    rafRef.current = requestAnimationFrame(draw);
    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      obs.disconnect();
    };
  }, [transform, nodeMap]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        position: "absolute",
        inset: 0,
        pointerEvents: "none",
      }}
    />
  );
}

function particlePos(
  particle: Particle,
  diagram: Diagram | null,
  nodeMap: RFNodeLookup,
): XY | null {
  if (!diagram) return null;

  const nodeCenter = (id: string): XY | null => {
    const internal = nodeMap.get(id);
    const pos = internal?.internals?.positionAbsolute;
    if (!pos) return null;
    const w = internal?.measured?.width ?? 120;
    const h = internal?.measured?.height ?? 40;
    return { x: pos.x + w / 2, y: pos.y + h / 2 };
  };

  if (particle.location.kind === "node") {
    return nodeCenter(particle.location.id);
  }
  const edge = diagram.edges.find((e) => e.id === particle.location.id);
  if (!edge) return null;
  const a = nodeCenter(edge.source);
  const b = nodeCenter(edge.target);
  if (!a || !b) return null;
  const t = Math.min(1, Math.max(0, particle.location.progress));
  return { x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t };
}
