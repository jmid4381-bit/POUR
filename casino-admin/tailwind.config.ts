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
        // Deep executive surfaces
        void:    "#030508",
        base:    "#060c14",
        surface: "#0a1520",
        raised:  "#0f1d2c",
        edge:    "#152030",
        rim:     "#1c2f44",
        // Gold — the brand spine
        gold: {
          50:  "#fefaec",
          100: "#fdf0c0",
          200: "#fce077",
          300: "#f5c830",
          400: "#e8ac0c",
          500: "#c98e08",
          600: "#a06d06",
          700: "#774f05",
        },
        // Emerald — primary actions
        felt: {
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
        },
        // Neutral text ramp
        ink: {
          50:  "#f2f6fa",
          100: "#dde6f0",
          200: "#b8ccde",
          300: "#8aaec8",
          400: "#5c8aac",
          500: "#3c6a8c",
          600: "#264e6e",
        },
      },
      fontFamily: {
        display: ["var(--font-syne)",      "ui-sans-serif", "system-ui"],
        body:    ["var(--font-outfit)",    "system-ui", "sans-serif"],
        mono:    ["var(--font-jetbrains)", "monospace"              ],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1.4" }],   // 11px — tiny badges/tags
        xs:    ["0.75rem",   { lineHeight: "1.4" }],   // 12px — eyebrow/label
        sm:    ["0.875rem",  { lineHeight: "1.4" }],   // 14px — secondary body/nav
        base:  ["1rem",      { lineHeight: "1.4" }],   // 16px — card title/body
        lg:    ["1.125rem",  { lineHeight: "1.3" }],   // 18px — section card heading
        xl:    ["1.375rem",  { lineHeight: "1.25" }],  // 22px — modal heading
        "2xl": ["1.75rem",   { lineHeight: "1.2"  }],  // 28px — page heading
      },
      backgroundImage: {
        // ── Brand gradients — both naming conventions supported ──
        "gold-gradient":    "linear-gradient(135deg,#e8ac0c 0%,#c98e08 100%)",
        "gold-grad":        "linear-gradient(135deg,#e8ac0c 0%,#c98e08 100%)",  // staff/guest alias
        "felt-gradient":    "linear-gradient(135deg,#10b981 0%,#059669 100%)",
        "felt-grad":        "linear-gradient(135deg,#10b981 0%,#059669 100%)",  // staff/guest alias
        "card-sheen":       "linear-gradient(135deg,rgba(255,255,255,0.03) 0%,transparent 55%)",
        "dot-grid":         "radial-gradient(circle,rgba(28,47,68,0.65) 1px,transparent 1px)",
        "sidebar-surface":  "linear-gradient(180deg,#07111e 0%,#050e18 100%)",
        "gold-sweep":       "linear-gradient(90deg,transparent 0%,rgba(232,172,12,0.35) 50%,transparent 100%)",
        // ── Status tints — matching staff dashboard ──
        "grad-pending":  "linear-gradient(135deg,rgba(245,158,11,0.15) 0%,transparent 60%)",
        "grad-active":   "linear-gradient(135deg,rgba(59,130,246,0.12) 0%,transparent 60%)",
        "grad-ready":    "linear-gradient(135deg,rgba(139,92,246,0.12) 0%,transparent 60%)",
        "grad-delivered":"linear-gradient(135deg,rgba(16,185,129,0.10) 0%,transparent 60%)",
        "grad-overdue":  "linear-gradient(135deg,rgba(239,68,68,0.14) 0%,transparent 60%)",
        // ── Ambient glows ──
        "hero-glow":     "radial-gradient(ellipse 80% 30% at 50% 0%,rgba(201,142,8,0.05),transparent)",
      },
      boxShadow: {
        "card":          "0 1px 0 rgba(255,255,255,0.025), 0 4px 24px rgba(0,0,0,0.55)",
        "card-hover":    "0 1px 0 rgba(255,255,255,0.035), 0 8px 32px rgba(0,0,0,0.65)",
        "gold-sm":       "0 0 0 1px rgba(201,142,8,0.2),  0 2px 14px rgba(201,142,8,0.12)",
        "gold-md":       "0 0 0 1px rgba(201,142,8,0.3),  0 4px 24px rgba(201,142,8,0.18)",
        "felt-sm":       "0 0 0 1px rgba(16,185,129,0.2), 0 2px 14px rgba(16,185,129,0.10)",
        "modal":         "0 32px 96px rgba(0,0,0,0.9), 0 0 0 1px rgba(255,255,255,0.04)",
        "btn-gold":      "0 2px 16px rgba(201,142,8,0.35)",
        "btn-felt":      "0 2px 16px rgba(16,185,129,0.30)",
        "price-active":  "0 0 0 2px rgba(232,172,12,0.4), 0 0 12px rgba(232,172,12,0.15)",
      },
      keyframes: {
        // ── Shared across all three apps ──
        "fade-up":      { from:{ opacity:"0", transform:"translateY(10px)" }, to:{ opacity:"1", transform:"translateY(0)" } },
        "fade-in":      { from:{ opacity:"0" },                               to:{ opacity:"1" }                           },
        "scale-in":     { from:{ opacity:"0", transform:"scale(0.96)" },      to:{ opacity:"1", transform:"scale(1)" }     },
        "slide-down":   { from:{ opacity:"0", transform:"translateY(-12px)"},  to:{ opacity:"1", transform:"translateY(0)" } },
        "slide-right":  { from:{ opacity:"0", transform:"translateX(-10px)" },to:{ opacity:"1", transform:"translateX(0)" }},
        "alert-in":     { from:{ opacity:"0", transform:"translateX(100%)" }, to:{ opacity:"1", transform:"translateX(0)" } },
        "row-in":       { from:{ opacity:"0", transform:"translateX(-6px)" }, to:{ opacity:"1", transform:"translateX(0)" }},
        "blink":        { "0%,100%":{ opacity:"1" }, "50%":{ opacity:"0.3" } },
        "count-in":     { from:{ opacity:"0", transform:"scale(0.85)" }, to:{ opacity:"1", transform:"scale(1)" }          },
        // ── Admin-specific ──
        "gold-flash":   { "0%":{ backgroundColor:"rgba(232,172,12,0.22)" }, "100%":{ backgroundColor:"transparent" }       },
        "shimmer":      { from:{ backgroundPosition:"-200% 0" },              to:{ backgroundPosition:"200% 0" }            },
        // ── Pulse animations — shared with staff dashboard ──
        "ping-gold":    { "0%":{ boxShadow:"0 0 0 0 rgba(201,142,8,0.5)"   }, "70%":{ boxShadow:"0 0 0 8px rgba(201,142,8,0)"   }, "100%":{ boxShadow:"0 0 0 0 rgba(201,142,8,0)"   } },
        "pulse-ring":   { "0%":{ boxShadow:"0 0 0 0 rgba(245,158,11,0.5)"  }, "70%":{ boxShadow:"0 0 0 8px rgba(245,158,11,0)"  }, "100%":{ boxShadow:"0 0 0 0 rgba(245,158,11,0)"  } },
        "pulse-red":    { "0%":{ boxShadow:"0 0 0 0 rgba(239,68,68,0.5)"   }, "70%":{ boxShadow:"0 0 0 8px rgba(239,68,68,0)"   }, "100%":{ boxShadow:"0 0 0 0 rgba(239,68,68,0)"   } },
        "pulse-violet": { "0%":{ boxShadow:"0 0 0 0 rgba(139,92,246,0.5)"  }, "70%":{ boxShadow:"0 0 0 8px rgba(139,92,246,0)"  }, "100%":{ boxShadow:"0 0 0 0 rgba(139,92,246,0)"  } },
      },
      animation: {
        // ── Shared ──
        "fade-up":     "fade-up    0.4s cubic-bezier(0.16,1,0.3,1) both",
        "fade-in":     "fade-in    0.3s ease-out both",
        "scale-in":    "scale-in   0.35s cubic-bezier(0.16,1,0.3,1) both",
        "slide-down":  "slide-down 0.35s cubic-bezier(0.16,1,0.3,1) both",
        "slide-right": "slide-right 0.3s cubic-bezier(0.16,1,0.3,1) both",
        "alert-in":    "alert-in  0.45s cubic-bezier(0.16,1,0.3,1) both",
        "row-in":      "row-in     0.3s cubic-bezier(0.16,1,0.3,1) both",
        "blink":       "blink      1.2s ease-in-out infinite",
        "count-in":    "count-in  0.25s ease-out both",
        // ── Admin-specific ──
        "gold-flash":  "gold-flash 1.4s ease-out both",
        "shimmer":     "shimmer    2.2s linear infinite",
        // ── Pulse ──
        "ping-gold":   "ping-gold  1.8s ease-out infinite",
        "pulse-ring":  "pulse-ring 1.8s ease-out infinite",
        "pulse-red":   "pulse-red  1.4s ease-out infinite",
        "pulse-violet":"pulse-violet 1.6s ease-out infinite",
      },
    },
  },
  plugins: [],
};
export default config;
