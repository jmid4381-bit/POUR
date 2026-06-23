import { AdminSidebar }  from "@/components/admin/AdminSidebar";
import { MobileNavBar } from "@/components/admin/MobileNavBar";
import { AuthGate } from "@/components/auth/AuthGate";

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
    <div className="flex min-h-screen bg-base">
      {/* Dot-grid atmosphere */}
      <div
        className="fixed inset-0 pointer-events-none"
        style={{
          backgroundImage: "radial-gradient(circle,rgba(28,47,68,0.55) 1px,transparent 1px)",
          backgroundSize: "28px 28px",
        }}
      />
      {/* Top gold glow */}
      <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_80%_30%_at_50%_0%,rgba(201,142,8,0.05),transparent)]" />

      {/* Desktop sidebar — hidden on mobile/tablet */}
      <AdminSidebar />

      <main className="relative z-10 flex-1 min-w-0 flex flex-col min-h-screen">
        {/* Mobile/tablet navigation bar — hidden on desktop */}
        <MobileNavBar />
        {children}
      </main>
    </div>
    </AuthGate>
  );
}
