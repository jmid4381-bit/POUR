import type { Metadata, Viewport } from "next";
import { Syne, Outfit, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import { ClockProvider } from "@/contexts/ClockContext";
import { AuthGate } from "@/components/auth/AuthGate";

const syne = Syne({
  subsets: ["latin"],
  variable: "--font-syne",
  weight: ["400", "500", "600", "700", "800"],
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
  weight: ["300", "400", "500", "600"],
  display: "swap",
});

// Static fallback for the initial server-rendered <title> — the real venue
// name (event_settings.venue_name) is set dynamically client-side once
// fetched (see app/staff/page.tsx).
export const metadata: Metadata = {
  title: "Staff Operations — POUR",
  description: "Real-time beverage order management for casino floor staff.",
};

export const viewport: Viewport = {
  themeColor: "#030508",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${syne.variable} ${outfit.variable} ${jetbrains.variable}`}>
      {/*
        ClockProvider wraps the entire app here so every LiveTimer
        component reads from one shared tick — one setInterval total
        regardless of how many orders are on screen. (Fix 2)
      */}
      <body className="font-body bg-void text-white antialiased">
        <ClockProvider>
          <AuthGate>{children}</AuthGate>
        </ClockProvider>
      </body>
    </html>
  );
}
