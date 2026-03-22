"use client";

import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, Legend } from "recharts";
import type { SessionOutcomeBreakdown } from "@glop/shared";

interface Props {
  data: SessionOutcomeBreakdown[];
}

const OUTCOME_LABELS: Record<string, string> = {
  fully_achieved: "Fully Achieved",
  mostly_achieved: "Mostly Achieved",
  partially_achieved: "Partially Achieved",
  not_achieved: "Not Achieved",
  unclear: "Unclear",
};

const OUTCOME_COLORS: Record<string, string> = {
  fully_achieved: "hsl(142 71% 45%)",
  mostly_achieved: "hsl(160 55% 45%)",
  partially_achieved: "hsl(45 80% 50%)",
  not_achieved: "hsl(0 72% 51%)",
  unclear: "hsl(220 9% 46%)",
};

export function SessionOutcomeChart({ data }: Props) {
  if (data.length === 0) {
    return (
      <div className="flex h-[300px] items-center justify-center text-sm text-muted-foreground">
        No outcome data
      </div>
    );
  }

  const chartData = data.map((d) => ({
    name: OUTCOME_LABELS[d.outcome] ?? d.outcome,
    value: d.count,
    outcome: d.outcome,
  }));

  return (
    <ResponsiveContainer width="100%" height={300}>
      <PieChart>
        <Pie
          data={chartData}
          dataKey="value"
          nameKey="name"
          cx="50%"
          cy="50%"
          innerRadius={60}
          outerRadius={100}
          paddingAngle={2}
        >
          {chartData.map((entry) => (
            <Cell
              key={entry.outcome}
              fill={OUTCOME_COLORS[entry.outcome] ?? "hsl(var(--chart-1))"}
            />
          ))}
        </Pie>
        <Tooltip
          contentStyle={{
            backgroundColor: "hsl(var(--popover))",
            border: "1px solid hsl(var(--border))",
            borderRadius: "8px",
            fontSize: "12px",
          }}
        />
        <Legend />
      </PieChart>
    </ResponsiveContainer>
  );
}
