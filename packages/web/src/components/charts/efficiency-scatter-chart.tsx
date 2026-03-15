"use client";

import {
  ScatterChart,
  Scatter,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ZAxis,
  Legend,
} from "recharts";
import type { RunBreakdown } from "@glop/shared";

const DEVELOPER_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
];

interface ScatterPoint {
  x: number;
  y: number;
  z: number;
  label: string;
  developer: string;
  prs: number;
  compactions: number;
}

export function EfficiencyScatterChart({ data }: { data: RunBreakdown[] }) {
  if (data.length === 0) {
    return (
      <p className="py-8 text-center text-sm text-muted-foreground">
        No runs in this period.
      </p>
    );
  }

  // Group by developer for coloring
  const developers = [...new Set(data.map((d) => d.developer_name))];

  const seriesByDev = developers.map((dev, idx) => {
    const points: ScatterPoint[] = data
      .filter((d) => d.developer_name === dev)
      .map((d) => ({
        x: d.conversation_turns,
        y: d.commits,
        z: Math.max(d.prs * 80 + 40, 40),
        label: d.label,
        developer: dev,
        prs: d.prs,
        compactions: d.compactions,
      }));
    return { name: dev, color: DEVELOPER_COLORS[idx % DEVELOPER_COLORS.length], points };
  });

  return (
    <ResponsiveContainer width="100%" height={350}>
      <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          type="number"
          dataKey="x"
          name="Turns"
          allowDecimals={false}
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
          label={{
            value: "Conversation Turns",
            position: "insideBottom",
            offset: -5,
            fontSize: 12,
            className: "fill-muted-foreground",
          }}
        />
        <YAxis
          type="number"
          dataKey="y"
          name="Commits"
          allowDecimals={false}
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
          label={{
            value: "Commits",
            angle: -90,
            position: "insideLeft",
            fontSize: 12,
            className: "fill-muted-foreground",
          }}
        />
        <ZAxis type="number" dataKey="z" range={[40, 400]} />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "0.5rem",
            color: "hsl(var(--popover-foreground))",
          }}
          content={({ payload }) => {
            if (!payload?.length) return null;
            const p = payload[0].payload as ScatterPoint;
            return (
              <div className="rounded-lg border bg-popover p-3 text-sm text-popover-foreground shadow-md">
                <p className="font-medium">{p.label}</p>
                <p className="text-muted-foreground">{p.developer}</p>
                <div className="mt-1 space-y-0.5">
                  <p>Turns: {p.x}</p>
                  <p>Commits: {p.y}</p>
                  <p>PRs: {p.prs}</p>
                  <p>Compactions: {p.compactions}</p>
                </div>
              </div>
            );
          }}
        />
        {developers.length > 1 && <Legend />}
        {seriesByDev.map((series) => (
          <Scatter
            key={series.name}
            name={series.name}
            data={series.points}
            fill={series.color}
            fillOpacity={0.7}
          />
        ))}
      </ScatterChart>
    </ResponsiveContainer>
  );
}
