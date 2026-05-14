import { useEffect, useRef } from 'react';
import uPlot, { type Options as UPlotOptions } from 'uplot';
import 'uplot/dist/uPlot.min.css';

export interface SparklineProps {
  values: number[];        // y-values, x = index
  color?: string;
  height?: number;
  width?: number;
  label?: string;
}

export function Sparkline({ values, color = '#4caf50', height = 48, width = 200, label }: SparklineProps) {
  const ref = useRef<HTMLDivElement | null>(null);
  const plotRef = useRef<uPlot | null>(null);

  useEffect(() => {
    if (!ref.current) return;
    const opts: UPlotOptions = {
      width,
      height,
      legend: { show: false },
      cursor: { show: false },
      scales: { x: { time: false } },
      axes: [{ show: false }, { show: false }],
      series: [
        {},
        { stroke: color, width: 1.5, points: { show: false } },
      ],
    };
    const xs = values.map((_, i) => i);
    plotRef.current = new uPlot(opts, [xs, values], ref.current);
    return () => { plotRef.current?.destroy(); plotRef.current = null; };
  }, [width, height, color]);

  useEffect(() => {
    if (!plotRef.current) return;
    const xs = values.map((_, i) => i);
    plotRef.current.setData([xs, values]);
  }, [values]);

  return (
    <div style={{ fontSize: 10, color: 'var(--text-dim)' }}>
      {label && <div>{label}</div>}
      <div ref={ref} />
    </div>
  );
}
