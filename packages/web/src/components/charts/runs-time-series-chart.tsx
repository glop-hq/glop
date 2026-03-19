"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { RunsPerDay } from "@glop/shared";

export function RunsTimeSeriesChart({ data }: { data: RunsPerDay[] }) {
  return (
    <ResponsiveContainer width="100%" height={300}>
      <AreaChart data={data}>
        <defs>
          <linearGradient id="runsGradient" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--chart-2)" stopOpacity={0.3} />
            <stop offset="100%" stopColor="var(--chart-2)" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid
          strokeDasharray="3 3"
          className="stroke-border"
          vertical={false}
          strokeOpacity={0.5}
        />
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
          axisLine={false}
          tickLine={false}
          tickMargin={8}
        />
        <YAxis
          allowDecimals={false}
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
          axisLine={false}
          tickLine={false}
          tickMargin={8}
        />
        <Tooltip
          cursor={{ stroke: "var(--muted)", strokeWidth: 1 }}
          contentStyle={{
            backgroundColor: "var(--popover)",
            border: "none",
            borderRadius: "0.5rem",
            color: "var(--popover-foreground)",
            boxShadow:
              "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
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
        <Area
          dataKey="total"
          type="monotone"
          stroke="var(--chart-2)"
          strokeWidth={2}
          fill="url(#runsGradient)"
          name="Runs"
          dot={false}
          activeDot={{ r: 4, strokeWidth: 0 }}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}
