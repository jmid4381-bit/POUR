import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "gold" | "felt" | "ghost" | "danger" | "surface";
  size?:    "xs" | "sm" | "md" | "lg";
  loading?: boolean;
  icon?:    React.ReactNode;
}

export function Button({
  variant = "felt", size = "md", loading, icon,
  children, className, disabled, ...props
}: ButtonProps) {
  const base = "inline-flex items-center justify-center gap-2 font-body font-semibold rounded-xl transition-all duration-200 active:scale-[0.97] select-none disabled:opacity-40 disabled:cursor-not-allowed";

  const variants = {
    gold:    "bg-gold-gradient text-void shadow-btn-gold hover:brightness-110",
    felt:    "bg-felt-gradient text-white shadow-btn-felt hover:brightness-110",
    ghost:   "bg-transparent border border-rim text-ink-200 hover:border-ink-400/50 hover:bg-raised",
    danger:  "bg-red-600/15 border border-red-500/30 text-red-400 hover:bg-red-600/25",
    surface: "bg-raised border border-edge text-ink-100 hover:bg-rim/60",
  };

  const sizes = {
    xs: "text-[11px] px-2.5 py-1.5 gap-1",
    sm: "text-xs px-3 py-2 gap-1.5",
    md: "text-sm px-4 py-2.5",
    lg: "text-base px-6 py-3.5",
  };

  return (
    <button
      className={cn(base, variants[variant], sizes[size], className)}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? <Loader2 size={13} className="animate-spin" /> : icon}
      {children}
    </button>
  );
}
