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
import type { BusiestHour } from "@glop/shared";

function formatHour(hour: number): string {
  if (hour === 0) return "12am";
  if (hour === 12) return "12pm";
  return hour < 12 ? `${hour}am` : `${hour - 12}pm`;
}

export function BusiestHoursChart({ data }: { data: BusiestHour[] }) {
  const formatted = data.map((d) => ({
    ...d,
    label: formatHour(d.hour),
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <BarChart data={formatted}>
        <CartesianGrid
          strokeDasharray="3 3"
          className="stroke-border"
          vertical={false}
          strokeOpacity={0.5}
        />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 11 }}
          className="text-muted-foreground"
          interval={2}
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
          cursor={{ fill: "var(--muted)", opacity: 0.5 }}
          contentStyle={{
            backgroundColor: "var(--popover)",
            border: "none",
            borderRadius: "0.5rem",
            color: "var(--popover-foreground)",
            boxShadow:
              "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
          }}
          labelFormatter={(_, payload) => {
            if (payload?.[0]) {
              return formatHour(payload[0].payload.hour);
            }
            return "";
          }}
        />
        <Bar dataKey="run_count" fill="var(--chart-1)" name="Runs" radius={[6, 6, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}
