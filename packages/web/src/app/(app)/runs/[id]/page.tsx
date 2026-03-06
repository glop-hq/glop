import { RunDetailView } from "@/components/run-detail-view";

export default async function RunDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;

  return (
    <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
      <RunDetailView runId={id} />
    </main>
  );
}
