import { NextRequest, NextResponse } from "next/server";

/**
 * Per-location PWA manifest, served as a plain Route Handler (not the
 * manifest.ts metadata-file convention — that convention doesn't support
 * being placed inside a dynamic segment folder, unlike icon.tsx/
 * opengraph-image.tsx which explicitly do; it 404s if you try).
 *
 * start_url points back at THIS location, so a guest who scans the QR code
 * at e.g. "Screened In Porch" and adds it to their Home Screen relaunches at
 * /order/screened-porch — not the generic app root (which redirects to an
 * inactive placeholder location and would otherwise show a false
 * "Service Paused" for every installed icon, regardless of which real table
 * the guest is actually at).
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: Promise<{ locationId: string }> },
) {
  const { locationId } = await params;

  const manifest = {
    name: "POUR — Order Beverages",
    short_name: "POUR",
    description: "Premium drinks delivered directly to your seat.",
    start_url: `/order/${locationId}`,
    display: "standalone",
    background_color: "#040608",
    theme_color: "#040608",
    orientation: "portrait",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };

  return NextResponse.json(manifest, {
    headers: { "Content-Type": "application/manifest+json" },
  });
}
