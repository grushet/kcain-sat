"use client";

import { useMemo, useState } from "react";

export interface TrendPoint {
  label: string;
  value: number;
}

/**
 * Total score across past sittings. One series, so the title names it and no
 * legend box is needed; the endpoint carries a direct label and the axis plus
 * the tooltip carry the rest.
 *
 * The line colour is the app's own #E85A2A, which passes the lightness band and
 * the 3:1 surface-contrast check against both the light and the dark surface.
 *
 * The axis is padded around the data rather than pinned to the full 400-1600
 * scale, because three sittings inside a 150-point range read as a flat line on
 * the full scale. Both end values are printed on the axis, so the range a reader
 * is looking at is never implied.
 */

const W = 760;
const H = 240;
const PAD = { top: 18, right: 56, bottom: 34, left: 46 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

const LINE = "#E85A2A";

function niceDomain(values: number[]): [number, number] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (min === max) {
    return [Math.max(400, min - 100), Math.min(1600, max + 100)];
  }
  const pad = Math.max(40, Math.round((max - min) * 0.25));
  const lo = Math.max(400, Math.floor((min - pad) / 50) * 50);
  const hi = Math.min(1600, Math.ceil((max + pad) / 50) * 50);
  return [lo, hi];
}

export function ScoreTrend({ points }: { points: TrendPoint[] }) {
  const [hover, setHover] = useState<number | null>(null);

  const geometry = useMemo(() => {
    if (points.length < 2) return null;
    const [lo, hi] = niceDomain(points.map((p) => p.value));
    const span = hi - lo || 1;
    const x = (i: number) => PAD.left + (i / (points.length - 1)) * PLOT_W;
    const y = (v: number) => PAD.top + PLOT_H - ((v - lo) / span) * PLOT_H;
    const mid = Math.round((lo + hi) / 2);
    return {
      lo,
      hi,
      mid,
      x,
      y,
      path: points.map((p, i) => `${i === 0 ? "M" : "L"}${x(i)},${y(p.value)}`).join(" "),
    };
  }, [points]);

  if (!geometry) return null;

  const { lo, hi, mid, x, y, path } = geometry;
  const last = points.length - 1;
  const active = hover ?? last;

  function handleMove(e: React.PointerEvent<SVGSVGElement>) {
    const box = e.currentTarget.getBoundingClientRect();
    if (box.width === 0) return;
    const svgX = ((e.clientX - box.left) / box.width) * W;
    const ratio = (svgX - PAD.left) / PLOT_W;
    const index = Math.round(ratio * (points.length - 1));
    setHover(Math.min(Math.max(index, 0), points.length - 1));
  }

  const tooltipX = x(active);
  const tooltipAnchor = tooltipX > W - 150 ? "end" : "start";
  const tooltipDx = tooltipAnchor === "end" ? -10 : 10;

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      className="w-full h-auto touch-none"
      role="img"
      aria-label={`Total score across ${points.length} practice tests, from ${points[0].value} to ${points[last].value}. The same figures are listed below.`}
      onPointerMove={handleMove}
      onPointerLeave={() => setHover(null)}
    >
      {/* Gridlines, solid and recessive */}
      {[hi, mid, lo].map((v) => (
        <g key={v}>
          <line
            x1={PAD.left}
            x2={PAD.left + PLOT_W}
            y1={y(v)}
            y2={y(v)}
            className="stroke-sat-gray-200 dark:stroke-sat-horizon"
            strokeWidth={1}
          />
          <text
            x={PAD.left - 10}
            y={y(v) + 4}
            textAnchor="end"
            className="fill-sat-gray-400 dark:fill-sat-mist"
            fontSize={12}
          >
            {v}
          </text>
        </g>
      ))}

      {/* Crosshair for the point being read */}
      {hover !== null && (
        <line
          x1={x(hover)}
          x2={x(hover)}
          y1={PAD.top}
          y2={PAD.top + PLOT_H}
          className="stroke-sat-gray-300 dark:stroke-sat-horizon"
          strokeWidth={1}
        />
      )}

      <path d={path} fill="none" stroke={LINE} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />

      {/* Markers: 8px across, with a surface ring so they stay legible on the line */}
      {points.map((p, i) => (
        <circle
          key={i}
          cx={x(i)}
          cy={y(p.value)}
          r={i === active ? 5.5 : 4}
          fill={LINE}
          className="stroke-white dark:stroke-sat-night"
          strokeWidth={2}
        />
      ))}

      {/* Direct label on the most recent score */}
      <text
        x={x(last) + 10}
        y={y(points[last].value) + 4}
        className="fill-sat-gray-700 dark:fill-sat-frost"
        fontSize={13}
        fontWeight={700}
      >
        {points[last].value}
      </text>

      {/* First and last dates only, so labels cannot collide */}
      <text
        x={PAD.left}
        y={H - 10}
        className="fill-sat-gray-400 dark:fill-sat-mist"
        fontSize={12}
      >
        {points[0].label}
      </text>
      {points.length > 1 && (
        <text
          x={PAD.left + PLOT_W}
          y={H - 10}
          textAnchor="end"
          className="fill-sat-gray-400 dark:fill-sat-mist"
          fontSize={12}
        >
          {points[last].label}
        </text>
      )}

      {hover !== null && (
        <text
          x={tooltipX + tooltipDx}
          y={PAD.top + 4}
          textAnchor={tooltipAnchor}
          className="fill-sat-gray-700 dark:fill-sat-frost"
          fontSize={13}
        >
          {points[hover].label}: {points[hover].value}
        </text>
      )}
    </svg>
  );
}
