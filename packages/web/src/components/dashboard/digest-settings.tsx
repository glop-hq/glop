"use client";

import { useState, useEffect, useCallback } from "react";
import { useWorkspaces } from "@/hooks/use-workspaces";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { DigestFrequency, DigestSchedule } from "@glop/shared";

const FREQUENCY_OPTIONS: { value: DigestFrequency; label: string }[] = [
  { value: "weekly", label: "Weekly" },
  { value: "biweekly", label: "Bi-weekly" },
  { value: "monthly", label: "Monthly" },
  { value: "disabled", label: "Disabled" },
];

export function DigestSettings() {
  const { currentWorkspace } = useWorkspaces();
  const [schedule, setSchedule] = useState<DigestSchedule | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const fetchSchedule = useCallback(async () => {
    if (!currentWorkspace?.id) return;
    try {
      const res = await fetch(
        `/api/v1/dashboard/digests?workspace_id=${currentWorkspace.id}`
      );
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setSchedule(json.schedule);
    } finally {
      setLoading(false);
    }
  }, [currentWorkspace?.id]);

  useEffect(() => {
    fetchSchedule();
  }, [fetchSchedule]);

  const handleSave = async (
    frequency: DigestFrequency,
    enabled: boolean
  ) => {
    if (!currentWorkspace?.id) return;
    setSaving(true);
    try {
      const res = await fetch("/api/v1/dashboard/digests", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspace_id: currentWorkspace.id,
          frequency,
          enabled,
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setSchedule(json.schedule);
    } finally {
      setSaving(false);
    }
  };

  const currentFrequency = schedule?.frequency ?? "weekly";
  const currentEnabled = schedule?.enabled ?? true;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-medium">Digest Settings</CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <Skeleton className="h-16 w-full" />
        ) : (
          <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">
                Frequency:
              </label>
              <select
                value={currentFrequency}
                onChange={(e) =>
                  handleSave(e.target.value as DigestFrequency, currentEnabled)
                }
                disabled={saving}
                className="cursor-pointer rounded-md border bg-background px-3 py-1.5 text-sm"
              >
                {FREQUENCY_OPTIONS.map((opt) => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="flex items-center gap-2">
              <label className="text-sm text-muted-foreground">Enabled:</label>
              <button
                onClick={() => handleSave(currentFrequency, !currentEnabled)}
                disabled={saving}
                className={`cursor-pointer relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent transition-colors ${
                  currentEnabled
                    ? "bg-green-500"
                    : "bg-muted"
                }`}
              >
                <span
                  className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                    currentEnabled ? "translate-x-5" : "translate-x-0"
                  }`}
                />
              </button>
            </div>

            {schedule?.last_sent_at && (
              <span className="text-xs text-muted-foreground">
                Last sent:{" "}
                {new Date(schedule.last_sent_at).toLocaleDateString()}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
