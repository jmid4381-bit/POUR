import Link from "next/link";
import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

type Accent = "gold" | "felt" | "red" | "amber" | "blue" | "violet" | "slate";

const ACCENT_MAP: Record<Accent, {
  value: string; icon: string; stripe: string; pulse?: string;
}> = {
  gold:   { value: "text-gold-300",   icon: "text-gold-400   bg-gold-400/10   border-gold-400/20",   stripe: "bg-gold-gradient"                                             },
  felt:   { value: "text-felt-400",   icon: "text-felt-400   bg-felt-400/10   border-felt-400/20",   stripe: "bg-felt-gradient"                                             },
  red:    { value: "text-red-400",    icon: "text-red-400    bg-red-400/10    border-red-400/20",    stripe: "bg-red-500",    pulse: "animate-ping-gold shadow-[0_0_0_0_rgba(239,68,68,0.5)]" },
  amber:  { value: "text-amber-400",  icon: "text-amber-400  bg-amber-400/10  border-amber-400/20",  stripe: "bg-amber-400"                                                 },
  blue:   { value: "text-blue-400",   icon: "text-blue-400   bg-blue-400/10   border-blue-400/20",   stripe: "bg-blue-500"                                                  },
  violet: { value: "text-violet-400", icon: "text-violet-400 bg-violet-400/10 border-violet-400/20", stripe: "bg-violet-500"                                                },
  slate:  { value: "text-ink-300",    icon: "text-ink-400    bg-ink-400/10    border-ink-400/20",    stripe: "bg-ink-600"                                                   },
};

interface MetricCardProps {
  label:   string;
  value:   string | number;
  sub?:    string;
  icon:    LucideIcon;
  accent:  Accent;
  alert?:  boolean;   // triggers pulse animation
  href?:   string;    // navigates to another page (e.g. Order History)
  onClick?: () => void; // same-page action (e.g. scroll to Alert Centre)
}

export function MetricCard({ label, value, sub, icon: Icon, accent, alert, href, onClick }: MetricCardProps) {
  const a = ACCENT_MAP[accent];
  const isActionable = !!(href || onClick);

  const content = (
    <>
      {/* Top colour stripe */}
      <div className={cn("h-0.5 w-full", a.stripe)} />

      {/* Pulse overlay for alert state */}
      {alert && (
        <div className="absolute inset-0 rounded-2xl pointer-events-none border border-red-500/20 animate-ping-gold" />
      )}

      <div className="p-4">
        <div className="flex items-start justify-between gap-2 mb-3">
          <p className="text-[10px] font-mono text-ink-400 uppercase tracking-[0.12em] leading-none mt-0.5">
            {label}
          </p>
          <div className={cn("w-8 h-8 rounded-xl border flex items-center justify-center flex-shrink-0", a.icon)}>
            <Icon size={14} strokeWidth={1.8} />
          </div>
        </div>
        <p className={cn(
          "font-mono font-bold leading-none",
          a.value,
          typeof value === "number" && value > 9999 ? "text-xl" : "text-2xl",
        )}>
          {value}
        </p>
        {sub && <p className="text-[11px] text-ink-400 font-body mt-1.5 leading-snug">{sub}</p>}
      </div>
    </>
  );

  const className = cn(
    "relative bg-surface border border-edge rounded-2xl overflow-hidden shadow-card block w-full text-left",
    "transition-all duration-200 hover:border-rim hover:shadow-card-hover",
    isActionable && "cursor-pointer active:scale-[0.98]",
    alert && "border-red-500/30",
  );

  if (href) {
    return <Link href={href} className={className}>{content}</Link>;
  }
  if (onClick) {
    return <button onClick={onClick} className={className}>{content}</button>;
  }
  return <div className={className}>{content}</div>;
}
