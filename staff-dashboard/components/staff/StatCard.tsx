import { cn } from "@/lib/utils";
import type { LucideIcon } from "lucide-react";

interface StatCardProps {
  label:    string;
  value:    string | number;
  sub?:     string;
  icon:     LucideIcon;
  accent:   "gold" | "amber" | "blue" | "violet" | "emerald" | "red";
  pulse?:   boolean;
  onClick?: () => void;
}

const ACCENT = {
  gold:    { icon: "text-gold-400 bg-gold-400/10 border-gold-400/20",     value: "text-gold-300"    },
  amber:   { icon: "text-amber-400 bg-amber-400/10 border-amber-400/20",  value: "text-amber-300"   },
  blue:    { icon: "text-blue-400 bg-blue-400/10 border-blue-400/20",     value: "text-blue-300"    },
  violet:  { icon: "text-violet-400 bg-violet-400/10 border-violet-400/20",value:"text-violet-300"  },
  emerald: { icon: "text-emerald-400 bg-emerald-400/10 border-emerald-400/20", value: "text-emerald-300" },
  red:     { icon: "text-red-400 bg-red-400/10 border-red-400/20",        value: "text-red-300"     },
};

export function StatCard({ label, value, sub, icon: Icon, accent, pulse, onClick }: StatCardProps) {
  const a = ACCENT[accent];
  return (
    <button
      onClick={onClick}
      disabled={!onClick}
      className={cn(
        "relative rounded-2xl bg-surface border border-border overflow-hidden shadow-card",
        "text-left w-full transition-all duration-200",
        onClick && "hover:border-rim hover:shadow-card active:scale-[0.97] cursor-pointer",
        !onClick && "cursor-default",
      )}
    >
      {/* Status top-stripe */}
      <div className={cn(
        "h-[2px] w-full",
        accent === "gold"    && "bg-gold-grad",
        accent === "amber"   && "bg-amber-400",
        accent === "blue"    && "bg-blue-400",
        accent === "violet"  && "bg-violet-400",
        accent === "emerald" && "bg-emerald-400",
        accent === "red"     && "bg-red-500",
      )} />
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <p className="text-[10px] font-mono text-slate-400 uppercase tracking-[0.12em] leading-none mt-0.5">
            {label}
          </p>
          <div className={cn("w-7 h-7 rounded-xl border flex items-center justify-center flex-shrink-0", a.icon)}>
            <Icon size={13} strokeWidth={1.8} />
          </div>
        </div>
        <div className="flex items-end gap-1.5">
          <p className={cn("font-mono font-bold leading-none", a.value,
            typeof value === "number" && value > 99 ? "text-2xl" : "text-3xl"
          )}>
            {value}
          </p>
          {pulse && value !== 0 && (
            <span className="mb-0.5 flex h-2 w-2 relative">
              <span className="animate-ping absolute h-full w-full rounded-full bg-red-400 opacity-75" />
              <span className="relative h-2 w-2 rounded-full bg-red-500" />
            </span>
          )}
        </div>
        {sub && <p className="text-[10px] text-slate-400 font-body mt-1">{sub}</p>}
      </div>
    </button>
  );
}
