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
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          type="number"
          allowDecimals={false}
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
        />
        <YAxis
          type="category"
          dataKey="label"
          width={100}
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
        />
        <Bar dataKey="count" fill="var(--chart-3)" name="Runs" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
