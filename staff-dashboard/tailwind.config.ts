import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
    "./hooks/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Base surfaces — deep command-center noir
        void:    "#030508",
        base:    "#060b12",
        surface: "#0a1220",
        raised:  "#0f1a2a",
        border:  "#162030",
        rim:     "#1e2e42",
        // Status palette — precise signal colors
        pending:   { DEFAULT: "#f59e0b", dim: "rgba(245,158,11,0.08)",  border: "rgba(245,158,11,0.18)" },
        active:    { DEFAULT: "#3b82f6", dim: "rgba(59,130,246,0.08)",   border: "rgba(59,130,246,0.18)" },
        ready:     { DEFAULT: "#8b5cf6", dim: "rgba(139,92,246,0.08)",   border: "rgba(139,92,246,0.18)" },
        delivered: { DEFAULT: "#10b981", dim: "rgba(16,185,129,0.08)",   border: "rgba(16,185,129,0.18)" },
        overdue:   { DEFAULT: "#ef4444", dim: "rgba(239,68,68,0.08)",    border: "rgba(239,68,68,0.18)"  },
        // Urgency scale — Fix 5
        urgency: {
          caution: "#f59e0b",  // 5-8 min — amber
          urgent:  "#f97316",  // 8-10 min — orange
          overdue: "#ef4444",  // 10+ min — red
        },
        // Brand gold
        gold: {
          300: "#f0d878",
          400: "#e0bc44",
          500: "#c9a030",
          600: "#9a7820",
        },
        // Text ramp
        slate: {
          50:  "#f1f5f9",
          100: "#e2e8f0",
          200: "#b8cad8",
          300: "#8da8be",
          400: "#607d94",
          500: "#415570",
          600: "#2a3e54",
        },
      },
      fontFamily: {
        display: ["var(--font-syne)",       "ui-sans-serif", "system-ui"],
        body:    ["var(--font-outfit)",     "system-ui",  "sans-serif"],
        mono:    ["var(--font-jetbrains)",  "monospace"              ],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1.4" }],   // 11px — tiny badges/tags
        xs:    ["0.75rem",   { lineHeight: "1.4" }],   // 12px — eyebrow/label
        sm:    ["0.875rem",  { lineHeight: "1.4" }],   // 14px — secondary body
        base:  ["1rem",      { lineHeight: "1.4" }],   // 16px — card title/body
        lg:    ["1.125rem",  { lineHeight: "1.3" }],   // 18px — modal heading
        xl:    ["1.375rem",  { lineHeight: "1.25" }],  // 22px — section heading
        "2xl": ["1.75rem",   { lineHeight: "1.2"  }],  // 28px — page heading
      },
      backgroundImage: {
        // Subtle dot-grid atmosphere
        "grid-dots":     "radial-gradient(circle, rgba(30,46,66,0.8) 1px, transparent 1px)",
        // Status gradients
        "grad-pending":  "linear-gradient(135deg,rgba(245,158,11,0.15) 0%,transparent 60%)",
        "grad-active":   "linear-gradient(135deg,rgba(59,130,246,0.12) 0%,transparent 60%)",
        "grad-ready":    "linear-gradient(135deg,rgba(139,92,246,0.12) 0%,transparent 60%)",
        "grad-delivered":"linear-gradient(135deg,rgba(16,185,129,0.10) 0%,transparent 60%)",
        "grad-overdue":  "linear-gradient(135deg,rgba(239,68,68,0.14) 0%,transparent 60%)",
        // Gold brand gradient
        "gold-grad":     "linear-gradient(135deg,#e0bc44 0%,#c9a030 100%)",
      },
      boxShadow: {
        "card":          "0 1px 0 rgba(255,255,255,0.03), 0 4px 24px rgba(0,0,0,0.5)",
        "pending-glow":  "0 0 0 1px rgba(245,158,11,0.2),  0 4px 20px rgba(245,158,11,0.08)",
        "active-glow":   "0 0 0 1px rgba(59,130,246,0.2),  0 4px 20px rgba(59,130,246,0.08)",
        "ready-glow":    "0 0 0 1px rgba(139,92,246,0.2),  0 4px 20px rgba(139,92,246,0.08)",
        "delivered-glow":"0 0 0 1px rgba(16,185,129,0.2),  0 4px 20px rgba(16,185,129,0.08)",
        "overdue-glow":  "0 0 0 1px rgba(239,68,68,0.3),   0 4px 24px rgba(239,68,68,0.12)",
        "btn-accept":    "0 2px 12px rgba(16,185,129,0.35)",
        "btn-ready":     "0 2px 12px rgba(139,92,246,0.35)",
        "btn-deliver":   "0 2px 12px rgba(59,130,246,0.35)",
        "col-new":       "inset 0 0 0 1px rgba(245,158,11,0.12)",
      },
      keyframes: {
        "fade-up":      { from: { opacity:"0", transform:"translateY(10px)" }, to: { opacity:"1", transform:"translateY(0)" } },
        "fade-in":      { from: { opacity:"0" },                               to: { opacity:"1"                           } },
        "slide-down":   { from: { opacity:"0", transform:"translateY(-12px)"},  to: { opacity:"1", transform:"translateY(0)" } },
        "pulse-ring":   { "0%": { boxShadow:"0 0 0 0 rgba(245,158,11,0.5)" }, "70%": { boxShadow:"0 0 0 8px rgba(245,158,11,0)" }, "100%": { boxShadow:"0 0 0 0 rgba(245,158,11,0)" } },
        "pulse-red":    { "0%": { boxShadow:"0 0 0 0 rgba(239,68,68,0.5)"  }, "70%": { boxShadow:"0 0 0 8px rgba(239,68,68,0)"  }, "100%": { boxShadow:"0 0 0 0 rgba(239,68,68,0)"  } },
        "pulse-violet": { "0%": { boxShadow:"0 0 0 0 rgba(139,92,246,0.5)" }, "70%": { boxShadow:"0 0 0 8px rgba(139,92,246,0)" }, "100%": { boxShadow:"0 0 0 0 rgba(139,92,246,0)" } },
        "blink":        { "0%,100%": { opacity:"1" }, "50%": { opacity:"0.3" } },
        "count-in":     { from: { opacity:"0", transform:"scale(0.85)" }, to: { opacity:"1", transform:"scale(1)" } },
        "alert-in":     { from: { opacity:"0", transform:"translateX(100%)" }, to: { opacity:"1", transform:"translateX(0)" } },
        "shimmer":      { from: { backgroundPosition:"-200% 0" }, to: { backgroundPosition:"200% 0" } },
      },
      animation: {
        "fade-up":      "fade-up    0.4s cubic-bezier(0.16,1,0.3,1) both",
        "fade-in":      "fade-in    0.3s ease-out both",
        "slide-down":   "slide-down 0.35s cubic-bezier(0.16,1,0.3,1) both",
        "pulse-ring":   "pulse-ring 1.8s ease-out infinite",
        "pulse-red":    "pulse-red  1.4s ease-out infinite",
        "pulse-violet": "pulse-violet 1.6s ease-out infinite",
        "blink":        "blink      1.2s ease-in-out infinite",
        "count-in":     "count-in  0.25s ease-out both",
        "alert-in":     "alert-in  0.45s cubic-bezier(0.16,1,0.3,1) both",
        "shimmer":      "shimmer   2s linear infinite",
      },
    },
  },
  plugins: [],
};
export default config;
