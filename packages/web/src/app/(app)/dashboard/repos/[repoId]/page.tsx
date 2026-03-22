"use client";

import { use } from "react";
import { RepoDrillDown } from "@/components/dashboard/repo-drill-down";

export default function RepoDashboardPage({
  params,
}: {
  params: Promise<{ repoId: string }>;
}) {
  const { repoId } = use(params);
  return <RepoDrillDown repoId={repoId} />;
}
