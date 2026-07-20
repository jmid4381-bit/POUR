"use client";

import { AdminSidebar }  from "@/components/admin/AdminSidebar";
import { MobileNavBar } from "@/components/admin/MobileNavBar";
import { AuthGate } from "@/components/auth/AuthGate";
import { useStore } from "@/lib/store";

// platform_admin has no fixed venue — must pick one (via the sidebar
// switcher) before any venue-scoped query below can resolve to real data.
function VenueGate({ children }: { children: React.ReactNode }) {
  const { isPlatformAdmin, venues, chooseVenue, venueResolving } = useStore();

  if (isPlatformAdmin && venueResolving) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center p-4">
        <div className="w-full max-w-sm bg-surface border border-edge rounded-2xl p-5 space-y-4">
          <p className="text-white font-body text-lg text-center">Select a venue</p>
          <div className="space-y-2">
            {venues.map(v => (
              <button
                key={v.id}
                onClick={() => chooseVenue(v.id)}
                className="w-full px-4 py-3 rounded-xl border border-edge bg-raised text-ink-300 hover:border-rim hover:text-white text-sm font-body font-medium transition-colors"
              >
                {v.name}
              </button>
            ))}
            {venues.length === 0 && (
              <p className="text-ink-500 text-sm font-body text-center">No venues found.</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthGate>
    <VenueGate>
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
    </VenueGate>
    </AuthGate>
  );
}
