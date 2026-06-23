import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));

export const fmtUSD = (n: number) =>
  new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 0 }).format(n);

export const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true, timeZone: "America/New_York" });

// Cryptographically random — not derivable from placement time, so order
// IDs can't be guessed/enumerated even though status lookups are public.
export const generateOrderId = () =>
  `ORD-${crypto.randomUUID().replace(/-/g, "").slice(0, 10).toUpperCase()}`;
