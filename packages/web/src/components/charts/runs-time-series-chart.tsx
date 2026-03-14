"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { RunsPerDay } from "@glop/shared";

export function RunsTimeSeriesChart({ data }: { data: RunsPerDay[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 12 }}
          tickFormatter={(v) => {
            const d = new Date(v + "T00:00:00");
            return d.toLocaleDateString(undefined, {
              month: "short",
              day: "numeric",
            });
          }}
          className="text-muted-foreground"
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "0.5rem",
            color: "hsl(var(--popover-foreground))",
          }}
          labelFormatter={(v) => {
            const d = new Date(v + "T00:00:00");
            return d.toLocaleDateString(undefined, {
              weekday: "short",
              month: "short",
              day: "numeric",
            });
          }}
        />
        <Legend />
        <Bar
          dataKey="completed"
          stackId="runs"
          fill="var(--chart-2)"
          name="Completed"
          radius={[0, 0, 0, 0]}
        />
        <Bar
          dataKey="failed"
          stackId="runs"
          fill="var(--chart-5)"
          name="Failed"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
