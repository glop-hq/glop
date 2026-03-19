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
  commits: number;
  prs: number;
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
        y: d.lines_changed,
        z: Math.max(d.commits * 60 + 40, 40),
        label: d.label,
        developer: dev,
        commits: d.commits,
        prs: d.prs,
      }));
    return { name: dev, color: DEVELOPER_COLORS[idx % DEVELOPER_COLORS.length], points };
  });

  return (
    <ResponsiveContainer width="100%" height={350}>
      <ScatterChart margin={{ top: 10, right: 20, bottom: 10, left: 10 }}>
        <CartesianGrid
          strokeDasharray="3 3"
          className="stroke-border"
          vertical={false}
          strokeOpacity={0.5}
        />
        <XAxis
          type="number"
          dataKey="x"
          name="Turns"
          allowDecimals={false}
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
          axisLine={false}
          tickLine={false}
          tickMargin={8}
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
          name="Lines Changed"
          allowDecimals={false}
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
          axisLine={false}
          tickLine={false}
          tickMargin={8}
          label={{
            value: "Lines Changed",
            angle: -90,
            position: "insideLeft",
            fontSize: 12,
            className: "fill-muted-foreground",
          }}
        />
        <ZAxis type="number" dataKey="z" range={[40, 400]} />
        <Tooltip
          contentStyle={{
            backgroundColor: "var(--popover)",
            border: "none",
            borderRadius: "0.5rem",
            color: "var(--popover-foreground)",
            boxShadow:
              "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
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
                  <p>Lines changed: {p.y.toLocaleString()}</p>
                  <p>Commits: {p.commits}</p>
                  <p>PRs: {p.prs}</p>
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
