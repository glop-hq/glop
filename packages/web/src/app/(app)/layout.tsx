import { NavHeader } from "@/components/nav-header";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen">
      <NavHeader />
      {children}
    </div>
  );
}
