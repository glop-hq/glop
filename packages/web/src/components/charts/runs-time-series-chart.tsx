"use client";

import { useMemo } from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import type { AnalyticsPeriod, RunsPerDay } from "@glop/shared";

interface BucketedData {
  label: string;
  total: number;
}

function aggregateData(
  data: RunsPerDay[],
  period: AnalyticsPeriod
): BucketedData[] {
  if (period === "7d") {
    return data.map((d) => {
      const date = new Date(d.date + "T00:00:00");
      return {
        label: date.toLocaleDateString(undefined, {
          weekday: "short",
        }),
        total: d.total,
      };
    });
  }

  if (period === "30d") {
    // Aggregate by week
    const weeks: Map<string, number> = new Map();
    for (const d of data) {
      const date = new Date(d.date + "T00:00:00");
      // Get Monday of the week
      const day = date.getDay();
      const monday = new Date(date);
      monday.setDate(date.getDate() - ((day + 6) % 7));
      const key = monday.toISOString().slice(0, 10);
      weeks.set(key, (weeks.get(key) ?? 0) + d.total);
    }
    return Array.from(weeks.entries()).map(([key, total]) => {
      const date = new Date(key + "T00:00:00");
      return {
        label: date.toLocaleDateString(undefined, {
          month: "short",
          day: "numeric",
        }),
        total,
      };
    });
  }

  // 90d — aggregate by month
  const months: Map<string, number> = new Map();
  for (const d of data) {
    const key = d.date.slice(0, 7); // "YYYY-MM"
    months.set(key, (months.get(key) ?? 0) + d.total);
  }
  return Array.from(months.entries()).map(([key, total]) => {
    const date = new Date(key + "-01T00:00:00");
    return {
      label: date.toLocaleDateString(undefined, {
        month: "short",
      }),
      total,
    };
  });
}

export function RunsTimeSeriesChart({
  data,
  period,
}: {
  data: RunsPerDay[];
  period: AnalyticsPeriod;
}) {
  const chartData = useMemo(() => aggregateData(data, period), [data, period]);

  return (
    <ResponsiveContainer width="100%" height={120}>
      <BarChart data={chartData}>
        <CartesianGrid
          strokeDasharray="3 3"
          className="stroke-border"
          vertical={false}
          strokeOpacity={0.5}
        />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 12 }}
          className="text-muted-foreground"
          axisLine={false}
          tickLine={false}
          tickMargin={8}
        />
        <YAxis hide />
        <Tooltip
          cursor={{ fill: "var(--muted)", opacity: 0.3 }}
          contentStyle={{
            backgroundColor: "var(--popover)",
            border: "none",
            borderRadius: "0.5rem",
            color: "var(--popover-foreground)",
            boxShadow:
              "0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)",
          }}
        />
        <Bar
          dataKey="total"
          fill="var(--chart-2)"
          radius={[8, 8, 0, 0]}
          name="Runs"
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
