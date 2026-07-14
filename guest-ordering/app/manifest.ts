import type { MetadataRoute } from "next";

/**
 * PWA manifest — makes guest-ordering installable ("Add to Home Screen").
 * This is a hard requirement for Web Push on iOS: iOS Safari only delivers
 * push to a site the guest has installed to their home screen (iOS 16.4+).
 * Android/Chrome doesn't require install, but the manifest gives it a proper
 * icon + standalone launch too.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "POUR — Order Beverages",
    short_name: "POUR",
    description: "Premium drinks delivered directly to your seat.",
    // This is only the generic app-level fallback manifest (used if someone
    // somehow installs from the bare "/" root, which real guests never visit —
    // they always land via a QR code straight on /order/[locationId]). Real
    // installs use the PER-LOCATION manifest at app/order/[locationId]/manifest.ts
    // instead, so each venue location's home-screen icon reopens at that same
    // location rather than this generic fallback.
    start_url: "/",
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
}
