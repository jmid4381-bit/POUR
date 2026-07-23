import type { Config } from "tailwindcss";

const config: Config = {
  content: [
    "./app/**/*.{ts,tsx}",
    "./components/**/*.{ts,tsx}",
    "./lib/**/*.{ts,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        // Surfaces — deep noir
        void:    "#040608",
        base:    "#070c14",
        card:    "#0c1622",
        lift:    "#111f30",
        edge:    "#172435",
        rim:     "#1e3048",
        // Emerald — primary action / casino felt
        felt: {
          300: "#6ee7b7",
          400: "#34d399",
          500: "#10b981",
          600: "#059669",
          700: "#047857",
        },
        // Gold — luxury accent
        gold: {
          200: "#fde68a",
          300: "#fcd34d",
          400: "#f0b429",
          500: "#d4960a",
          600: "#a87006",
          700: "#7c5205",
        },
        // Text ramp
        mist: {
          50:  "#f0f6ff",
          100: "#dce9f8",
          200: "#b5ceee",
          300: "#85aad8",
          400: "#5882bc",
          500: "#3860a0",
          600: "#23447c",
        },
      },
      fontFamily: {
        display: ["var(--font-cormorant)", "Georgia", "serif"],
        body:    ["var(--font-outfit)",    "system-ui", "sans-serif"],
        mono:    ["var(--font-jetbrains)", "monospace"],
      },
      fontSize: {
        "2xs": ["0.6875rem", { lineHeight: "1.4" }],   // 11px — tiny badges
        xs:    ["0.75rem",   { lineHeight: "1.4" }],   // 12px — eyebrow/label
        sm:    ["0.875rem",  { lineHeight: "1.5" }],   // 14px — secondary body
        base:  ["1rem",      { lineHeight: "1.5" }],   // 16px — body copy
        lg:    ["1.125rem",  { lineHeight: "1.4" }],   // 18px — card title
        xl:    ["1.375rem",  { lineHeight: "1.3" }],   // 22px — modal title
        "2xl": ["1.75rem",   { lineHeight: "1.2" }],   // 28px — section heading
        "3xl": ["2.125rem",  { lineHeight: "1.15" }],  // 34px — hero
        "4xl": ["2.75rem",   { lineHeight: "1.1"  }],  // 44px — large hero
      },
      backgroundImage: {
        "felt-grad":     "linear-gradient(135deg,#10b981 0%,#059669 100%)",
        "gold-grad":     "linear-gradient(135deg,#f0b429 0%,#d4960a 100%)",
        "card-sheen":    "linear-gradient(135deg,rgba(255,255,255,0.035) 0%,rgba(255,255,255,0) 55%)",
        "hero-glow":     "radial-gradient(ellipse 80% 40% at 50% 0%,rgba(16,185,129,0.10),transparent)",
        "gold-glow":     "radial-gradient(ellipse 70% 50% at 50% 0%,rgba(212,150,10,0.12),transparent)",
        "dot-grid":      "radial-gradient(circle,rgba(30,48,72,0.6) 1px,transparent 1px)",
        "modal-hero":    "linear-gradient(180deg,rgba(12,22,34,0) 0%,#0c1622 100%)",
      },
      boxShadow: {
        "card":          "0 2px 20px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.035)",
        "card-hover":    "0 4px 32px rgba(0,0,0,0.65), inset 0 1px 0 rgba(255,255,255,0.05)",
        "felt-glow":     "0 0 0 1px rgba(16,185,129,0.25), 0 6px 28px rgba(16,185,129,0.15)",
        "gold-glow":     "0 0 0 1px rgba(212,150,10,0.3),  0 6px 28px rgba(212,150,10,0.15)",
        "modal":         "0 -8px 60px rgba(0,0,0,0.8), 0 0 0 1px rgba(255,255,255,0.04)",
        "cart":          "0 -4px 30px rgba(0,0,0,0.6), 0 0 0 1px rgba(16,185,129,0.15)",
        "btn-felt":      "0 4px 16px rgba(16,185,129,0.35)",
        "btn-gold":      "0 4px 16px rgba(212,150,10,0.35)",
        "inner-rim":     "inset 0 1px 0 rgba(255,255,255,0.04)",
      },
      keyframes: {
        // Page entry
        "fade-up":      { from:{ opacity:"0", transform:"translateY(14px)" }, to:{ opacity:"1", transform:"translateY(0)" } },
        "fade-in":      { from:{ opacity:"0" },                               to:{ opacity:"1" }                           },
        // Modal
        "sheet-up":     { from:{ opacity:"0", transform:"translateY(100%)" }, to:{ opacity:"1", transform:"translateY(0)" } },
        "sheet-down":   { from:{ opacity:"1", transform:"translateY(0)" },    to:{ opacity:"0", transform:"translateY(100%)" } },
        // Confirmation
        "scale-in":     { from:{ opacity:"0", transform:"scale(0.88)" },      to:{ opacity:"1", transform:"scale(1)" }     },
        "check-draw":   { from:{ strokeDashoffset:"24" },                     to:{ strokeDashoffset:"0" }                  },
        // Utility
        "pulse-dot":    { "0%,100%":{ opacity:"1", transform:"scale(1)" }, "50%":{ opacity:"0.5", transform:"scale(0.9)" } },
        "shimmer":      { from:{ backgroundPosition:"-200% 0" },              to:{ backgroundPosition:"200% 0" }            },
        "bounce-sm":    { "0%,100%":{ transform:"translateY(0)" },            "50%":{ transform:"translateY(-4px)" }        },
        "qty-pop":      { "0%":{ transform:"scale(0.8)" }, "60%":{ transform:"scale(1.15)" }, "100%":{ transform:"scale(1)" } },
        "row-in":       { from:{ opacity:"0", transform:"translateX(-6px)" }, to:{ opacity:"1", transform:"translateX(0)" } },
        "toast-up":     { from:{ opacity:"0", transform:"translateY(10px) scale(0.96)" }, to:{ opacity:"1", transform:"translateY(0) scale(1)" } },
        // Hint chevron — gentle horizontal nudge
        "bounce-x":     { "0%,100%":{ transform:"translateX(0)"    }, "50%":{ transform:"translateX(3px)" } },
        // Fireworks — order confirmation celebration
        "firework-particle": {
          "0%":   { transform: "translate(0,0) scale(1)",   opacity: "1" },
          "65%":  { opacity: "1" },
          "100%": { transform: "translate(var(--dx,0px), var(--dy,0px)) scale(0.25)", opacity: "0" },
        },
        "firework-flash": {
          "0%":   { transform: "scale(0)",   opacity: "0.9" },
          "100%": { transform: "scale(1)",   opacity: "0"   },
        },
      },
      animation: {
        "fade-up":   "fade-up  0.45s cubic-bezier(0.16,1,0.3,1) both",
        "fade-in":   "fade-in  0.3s  ease-out both",
        "sheet-up":  "sheet-up 0.5s  cubic-bezier(0.16,1,0.3,1) both",
        "scale-in":  "scale-in 0.35s cubic-bezier(0.16,1,0.3,1) both",
        "pulse-dot": "pulse-dot 2s ease-in-out infinite",
        "shimmer":   "shimmer  2.5s linear infinite",
        "bounce-sm": "bounce-sm 1.2s ease-in-out infinite",
        "qty-pop":   "qty-pop  0.25s cubic-bezier(0.16,1,0.3,1) both",
        "row-in":    "row-in   0.3s  cubic-bezier(0.16,1,0.3,1) both",
        "toast-up":  "toast-up 0.4s  cubic-bezier(0.16,1,0.3,1) both",
        "bounce-x":  "bounce-x 1.4s  ease-in-out infinite",
        "firework-particle": "firework-particle 0.9s cubic-bezier(0.2,0.7,0.3,1) both",
        "firework-flash":    "firework-flash 0.5s ease-out both",
      },
    },
  },
  plugins: [],
};
export default config;
