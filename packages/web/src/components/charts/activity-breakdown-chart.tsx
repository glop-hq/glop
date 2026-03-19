"use client";

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { ActivityBreakdownItem } from "@glop/shared";

function formatActivityKind(kind: string): string {
  return kind
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

export function ActivityBreakdownChart({
  data,
}: {
  data: ActivityBreakdownItem[];
}) {
  const formatted = data.map((d) => ({
    ...d,
    label: formatActivityKind(d.activity_kind),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={formatted} layout="vertical">
        <CartesianGrid
          strokeDasharray="3 3"
          className="stroke-border"
          horizontal={false}
          strokeOpacity={0.5}
        />
        <XAxis
          type="number"
          allowDecimals={false}
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
          axisLine={false}
          tickLine={false}
          tickMargin={8}
        />
        <YAxis
          type="category"
          dataKey="label"
          width={100}
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
          axisLine={false}
          tickLine={false}
          tickMargin={8}
        />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.5 }}
          contentStyle={{
            backgroundColor: "var(--popover)",
            border: "none",
            borderRadius: "0.5rem",
            color: "var(--popover-foreground)",
            boxShadow:
              "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
          }}
        />
        <Bar dataKey="count" fill="var(--chart-3)" name="Runs" radius={[0, 6, 6, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
