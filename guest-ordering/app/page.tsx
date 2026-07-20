import { redirect } from "next/navigation";

// Fallback for a guest who lands on the bare root domain (no QR code path).
// Previously redirected to "loc-02", a placeholder location that no longer
// exists — every root visit hit a dead "Location Not Found" screen. Points
// at a real active location for now; Phase 5 of multi-tenancy (a real
// venue-picker landing page) replaces this hardcoded fallback entirely.
export default function Root() { redirect("/order/screened-porch"); }
