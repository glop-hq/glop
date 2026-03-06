import { NavHeader } from "@/components/nav-header";
import { HistoryTable } from "@/components/history-table";

export default function HistoryPage() {
  return (
    <div className="min-h-screen">
      <NavHeader />
      <main className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
        <div className="mb-4">
          <h1 className="text-lg font-semibold">History</h1>
        </div>
        <HistoryTable />
      </main>
    </div>
  );
}
