"use client";

import { use } from "react";
import { RunDetailPage } from "@/components/run-detail-page";

export default function RunPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  return <RunDetailPage runId={id} />;
}
