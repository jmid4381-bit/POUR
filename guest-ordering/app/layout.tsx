import type { Metadata, Viewport } from "next";
import { Cormorant_Garamond, Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const cormorant = Cormorant_Garamond({
  subsets: ["latin"],
  variable: "--font-cormorant",
  weight: ["300", "400", "500", "600", "700"],
  display: "swap",
});
const outfit = Outfit({
  subsets: ["latin"],
  variable: "--font-outfit",
  display: "swap",
});
const jetbrains = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-jetbrains",
  weight: ["300", "400", "500"],
  display: "swap",
});

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  themeColor: "#040608",
  viewportFit: "cover",
};

// Static fallback for the initial server-rendered <title> — the real venue
// name (event_settings.venue_name) is set dynamically client-side once
// fetched (see app/order/[locationId]/page.tsx).
export const metadata: Metadata = {
  title: "Order Beverages — POUR",
  description: "Premium drinks delivered directly to your seat.",
  // iOS Home Screen icon + PWA hints. The manifest (app/manifest.ts) covers
  // Android; these cover the iOS "Add to Home Screen" path that unlocks push.
  appleWebApp: {
    capable: true,
    title: "POUR",
    statusBarStyle: "black-translucent",
  },
  icons: {
    icon: "/icons/icon-192.png",
    apple: "/icons/apple-touch-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${cormorant.variable} ${outfit.variable} ${jetbrains.variable}`}>
      <body className="font-body bg-void text-white antialiased min-h-screen">
        {children}
      </body>
    </html>
  );
}
