import type { Metadata } from "next";

/**
 * Server-component layout for the (client-component) order page. Its only job
 * is to point this route's <link rel="manifest"> at the per-location manifest
 * (./manifest.ts) instead of the app-wide one — page.tsx is "use client" and
 * can't export generateMetadata itself.
 */
export async function generateMetadata({
  params,
}: {
  params: Promise<{ locationId: string }>;
}): Promise<Metadata> {
  const { locationId } = await params;
  return {
    manifest: `/order/${locationId}/manifest.webmanifest`,
  };
}

export default function LocationLayout({ children }: { children: React.ReactNode }) {
  return children;
}
