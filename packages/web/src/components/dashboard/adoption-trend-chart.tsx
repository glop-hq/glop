"use client";

import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import type { AdoptionTrendPoint, AnalyticsPeriod } from "@glop/shared";
import { useMemo } from "react";

interface Props {
  data: AdoptionTrendPoint[];
  period: AnalyticsPeriod;
}

interface BucketedData {
  label: string;
  active_developers: number;
  sessions: number;
}

function aggregate(data: AdoptionTrendPoint[], period: AnalyticsPeriod): BucketedData[] {
  if (period === "7d") {
    return data.map((d) => {
      const date = new Date(d.date + "T00:00:00");
      return {
        label: date.toLocaleDateString(undefined, { weekday: "short" }),
        active_developers: d.active_developers,
        sessions: d.sessions,
      };
    });
  }

  // 30d and 90d — aggregate by week
  const weeks = new Map<string, { sessions: number; maxDevs: number }>();
  for (const d of data) {
    const date = new Date(d.date + "T00:00:00");
    const day = date.getDay();
    const monday = new Date(date);
    monday.setDate(date.getDate() - ((day + 6) % 7));
    const key = monday.toISOString().slice(0, 10);
    const entry = weeks.get(key) ?? { sessions: 0, maxDevs: 0 };
    entry.sessions += d.sessions;
    entry.maxDevs = Math.max(entry.maxDevs, d.active_developers);
    weeks.set(key, entry);
  }
  return Array.from(weeks.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, v]) => ({
      label: new Date(key + "T00:00:00").toLocaleDateString(undefined, {
        month: "short",
        day: "numeric",
      }),
      active_developers: v.maxDevs,
      sessions: v.sessions,
    }));
}

export function AdoptionTrendChart({ data, period }: Props) {
  const chartData = useMemo(() => aggregate(data, period), [data, period]);

  if (chartData.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        No data for this period
      </div>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
        <XAxis
          dataKey="label"
          tick={{ fontSize: 12 }}
          className="fill-muted-foreground"
        />
        <YAxis
          yAxisId="left"
          tick={{ fontSize: 12 }}
          className="fill-muted-foreground"
          allowDecimals={false}
        />
        <YAxis
          yAxisId="right"
          orientation="right"
          tick={{ fontSize: 12 }}
          className="fill-muted-foreground"
          allowDecimals={false}
        />
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            fontSize: "12px",
          }}
        />
        <Legend />
        <Line
          yAxisId="left"
          type="monotone"
          dataKey="active_developers"
          name="Developers"
          stroke="hsl(var(--chart-1))"
          strokeWidth={2}
          dot={false}
        />
        <Line
          yAxisId="right"
          type="monotone"
          dataKey="sessions"
          name="Sessions"
          stroke="hsl(var(--chart-2))"
          strokeWidth={2}
          dot={false}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}
