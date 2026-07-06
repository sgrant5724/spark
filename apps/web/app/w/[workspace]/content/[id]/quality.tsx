"use client";

import { useEffect, useState } from "react";
import {
  PolarAngleAxis,
  PolarGrid,
  PolarRadiusAxis,
  Radar,
  RadarChart,
  ResponsiveContainer,
  Tooltip,
} from "recharts";
import { STATUS } from "@/lib/viz";

/**
 * Article quality radar (Recharts, client). Five axes, each 0-100 and each
 * sourced from a real computed signal (SEO field completeness, WCAG pass rate,
 * source verification, Flesch readability, length vs tier target). Animation
 * honors prefers-reduced-motion.
 */

export type RadarAxis = { axis: string; score: number };

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduced(mq.matches);
    const on = () => setReduced(mq.matches);
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return reduced;
}

export function QualityRadar({ data }: { data: RadarAxis[] }) {
  const reduced = useReducedMotion();
  return (
    <ResponsiveContainer width="100%" height={210}>
      <RadarChart data={data} outerRadius="68%" margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
        <PolarGrid stroke="#E2EAF4" />
        <PolarAngleAxis
          dataKey="axis"
          tick={{ fontSize: 10, fill: "#8A97A6", fontFamily: "Quicksand, sans-serif" }}
        />
        <PolarRadiusAxis domain={[0, 100]} tick={false} axisLine={false} />
        <Tooltip
          contentStyle={{
            borderRadius: 8,
            border: "1px solid #E2EAF4",
            fontSize: 12,
            fontFamily: "'JetBrains Mono', monospace",
          }}
          formatter={(v) => [`${v}/100`, "score"]}
        />
        <Radar
          name="Quality"
          dataKey="score"
          stroke={STATUS.good}
          strokeWidth={2}
          fill={STATUS.good}
          fillOpacity={0.22}
          isAnimationActive={!reduced}
        />
      </RadarChart>
    </ResponsiveContainer>
  );
}
